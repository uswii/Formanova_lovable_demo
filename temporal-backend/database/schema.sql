-- ============================================================
-- TEMPORAL-AGENTIC PIPELINE DATABASE SCHEMA (B2B2C Edition)
-- ============================================================
--
-- This schema implements the B2B2C multi-tenant model from
-- TEMPORAL_PIPELINE_SPEC.md and AUTH_SERVICE_SPEC.md
--
-- HOW TO RUN:
--   psql -h YOUR_HOST -U postgres -d pipeline -f schema.sql
--
-- ============================================================

-- ============================================
-- ENUMS
-- ============================================

DO $$ BEGIN
    CREATE TYPE workflow_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE tenant_tier AS ENUM ('free', 'starter', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('topup', 'reserve', 'charge', 'refund', 'release', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================
-- TENANTS (B2B Layer - Clients)
-- ============================================
-- Each tenant is a business client that owns their own user base
-- They configure their own identity provider (OIDC/JWKS)

CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,  -- Format: ten_xxx
    name TEXT NOT NULL,
    
    -- OIDC Configuration (JWT Binding)
    issuer_url TEXT NOT NULL UNIQUE,  -- Must match JWT 'iss' claim
    jwks_uri TEXT NOT NULL,           -- Public keys for signature verification
    audience TEXT,                     -- Expected JWT 'aud' claim
    
    -- Machine-to-Machine Auth
    api_key_hash TEXT,                -- SHA-256 hash of tap_live_xxx key
    
    -- Tier/Limits
    tier tenant_tier NOT NULL DEFAULT 'free',
    rate_limit_rpm INTEGER DEFAULT 100,
    max_concurrent_workflows INTEGER DEFAULT 10,
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT issuer_url_valid CHECK (issuer_url ~ '^https?://')
);

CREATE INDEX IF NOT EXISTS idx_tenants_issuer_url ON tenants(issuer_url);
CREATE INDEX IF NOT EXISTS idx_tenants_api_key_hash ON tenants(api_key_hash);


-- ============================================
-- USERS (B2C Layer - End Consumers)
-- ============================================
-- Users belong to tenants and have credit wallets
-- They are auto-created (JIT provisioning) on first auth

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identity (from JWT or OAuth)
    external_id TEXT NOT NULL,  -- 'sub' claim from JWT or OAuth provider ID
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    
    -- Auth metadata (for standalone auth service)
    hashed_password TEXT,       -- bcrypt hash (null for OAuth-only users)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- ═══════ WALLET (Dual Ledger) ═══════
    balance BIGINT NOT NULL DEFAULT 0,           -- Total credits owned
    reserved_balance BIGINT NOT NULL DEFAULT 0,  -- Credits held for running workflows
    -- Available = balance - reserved_balance
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    
    -- Each external_id must be unique within a tenant
    CONSTRAINT unique_tenant_external_id UNIQUE (tenant_id, external_id),
    CONSTRAINT balance_non_negative CHECK (balance >= 0),
    CONSTRAINT reserved_non_negative CHECK (reserved_balance >= 0),
    CONSTRAINT reserved_not_exceed_balance CHECK (reserved_balance <= balance)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_user_external ON users(tenant_id, external_id);


-- ============================================
-- CREDIT TRANSACTIONS (Audit Trail)
-- ============================================
-- Every credit movement is logged for reconciliation

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Transaction details
    type transaction_type NOT NULL,
    amount BIGINT NOT NULL,  -- Positive for credits in, negative for credits out
    
    -- Related entities
    workflow_id TEXT,  -- Links to workflow_executions if applicable
    
    -- Balance snapshot (for reconciliation)
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    reserved_before BIGINT,
    reserved_after BIGINT,
    
    -- Metadata
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_workflow_id ON credit_transactions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);


-- ============================================
-- WORKFLOW EXECUTIONS
-- ============================================
-- Each workflow run with billing attribution

CREATE TABLE IF NOT EXISTS workflow_executions (
    id TEXT PRIMARY KEY,  -- Temporal workflow ID
    
    -- Attribution
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Workflow details
    dag_name TEXT NOT NULL,
    input_payload JSONB NOT NULL DEFAULT '{}',
    output_payload JSONB,
    
    -- Status
    status workflow_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    
    -- ═══════ FINANCIAL (B2B2C) ═══════
    projected_cost BIGINT NOT NULL DEFAULT 0,     -- Estimated cost (reserved)
    actual_cost BIGINT NOT NULL DEFAULT 0,        -- User pays this (Revenue)
    total_provider_cost BIGINT NOT NULL DEFAULT 0, -- Tenant pays this (Expense)
    -- Tenant margin = actual_cost - total_provider_cost
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant_id ON workflow_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_billing ON workflow_executions(id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_workflows_latest ON workflow_executions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_workflows_latest ON workflow_executions(user_id, created_at DESC);


-- ============================================
-- TOOL INVOCATIONS
-- ============================================
-- Per-step execution records for caching, billing, and RLHF

CREATE TABLE IF NOT EXISTS tool_invocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id TEXT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    
    -- Attribution (denormalized for fast queries)
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Tool details
    tool_name TEXT NOT NULL,
    tool_version TEXT DEFAULT '1.0.0',
    node_id TEXT,  -- DAG node identifier
    
    -- Caching (SHA-256 of canonical input)
    input_hash TEXT NOT NULL,
    input_data JSONB NOT NULL DEFAULT '{}',
    output_data JSONB,
    
    -- ═══════ EXECUTION FLAGS ═══════
    is_success BOOLEAN NOT NULL DEFAULT FALSE,
    is_cached BOOLEAN NOT NULL DEFAULT FALSE,
    is_retry BOOLEAN NOT NULL DEFAULT FALSE,
    is_skipped BOOLEAN NOT NULL DEFAULT FALSE,  -- Skipped by 'when' gate
    is_deterministic BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- ═══════ FINANCIAL AUDIT ═══════
    cost BIGINT NOT NULL DEFAULT 0,  -- Credits charged for this invocation
    provider_cost BIGINT NOT NULL DEFAULT 0,  -- Infra cost (even on failure)
    latency_ms INTEGER,
    
    -- ═══════ RLHF (Reinforcement Learning from Human Feedback) ═══════
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- Cache lookup index (most important for performance)
CREATE INDEX IF NOT EXISTS idx_tool_cache_lookup 
    ON tool_invocations(tool_name, tool_version, input_hash) 
    WHERE is_deterministic = TRUE AND is_success = TRUE;

CREATE INDEX IF NOT EXISTS idx_tool_invocations_workflow_id ON tool_invocations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tool_invocations_tenant_id ON tool_invocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_tool_history ON tool_invocations(tenant_id, created_at DESC);


-- ============================================
-- ARTIFACTS (Content-Addressable Storage)
-- ============================================
-- Stores metadata for Azure Blob artifacts (images, etc.)

CREATE TABLE IF NOT EXISTS artifacts (
    sha256 TEXT PRIMARY KEY,  -- Content hash
    
    -- Storage location
    uri TEXT NOT NULL,  -- azure://container/path or https://...
    
    -- File info
    mime_type TEXT,
    size_bytes BIGINT,
    
    -- Attribution
    tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_uri ON artifacts(uri);
CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_id ON artifacts(tenant_id);


-- ============================================
-- USER GENERATIONS (Gallery)
-- ============================================
-- Stores jewelry try-on generation results for user gallery

CREATE TABLE IF NOT EXISTS user_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Attribution
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id TEXT REFERENCES workflow_executions(id) ON DELETE SET NULL,
    
    -- ═══════ AZURE BLOB URLS (not base64!) ═══════
    original_image_url TEXT NOT NULL,
    mask_url TEXT,
    result_image_url TEXT,
    thumbnail_url TEXT,
    
    -- Generation details
    jewelry_type TEXT,  -- 'necklace', 'earring', 'bracelet', 'ring'
    prompt TEXT,
    model_used TEXT,
    generation_params JSONB NOT NULL DEFAULT '{}',
    
    -- Quality metrics (from fidelity analysis)
    fidelity_metrics JSONB,  -- { precision, recall, iou, growth_ratio }
    
    -- User actions
    title TEXT,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Processing info
    processing_time_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_generations_user_id ON user_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_generations_tenant_id ON user_generations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_generations_workflow_id ON user_generations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_user_generations_created_at ON user_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_generations_favorites ON user_generations(user_id, is_favorite) WHERE is_favorite = TRUE;


-- ============================================
-- FUNCTIONS: Credit System (Dual Ledger)
-- ============================================

-- Reserve credits for a workflow (atomic hold)
CREATE OR REPLACE FUNCTION reserve_credits(
    p_user_id UUID,
    p_workflow_id TEXT,
    p_amount BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance BIGINT;
    v_reserved BIGINT;
    v_tenant_id TEXT;
BEGIN
    -- Lock the user row to prevent race conditions
    SELECT balance, reserved_balance, tenant_id 
    INTO v_balance, v_reserved, v_tenant_id
    FROM users 
    WHERE id = p_user_id 
    FOR UPDATE;
    
    -- Check available balance
    IF (v_balance - v_reserved) < p_amount THEN
        RETURN FALSE;  -- Insufficient credits
    END IF;
    
    -- Update reserved balance
    UPDATE users 
    SET reserved_balance = reserved_balance + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Log transaction
    INSERT INTO credit_transactions (
        user_id, tenant_id, type, amount, workflow_id,
        balance_before, balance_after, reserved_before, reserved_after,
        description
    ) VALUES (
        p_user_id, v_tenant_id, 'reserve', p_amount, p_workflow_id,
        v_balance, v_balance, v_reserved, v_reserved + p_amount,
        'Credit hold for workflow ' || p_workflow_id
    );
    
    RETURN TRUE;
END;
$$;


-- Settle credits after workflow completion
CREATE OR REPLACE FUNCTION settle_credits(
    p_user_id UUID,
    p_workflow_id TEXT,
    p_projected_cost BIGINT,
    p_actual_cost BIGINT,
    p_is_success BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance BIGINT;
    v_reserved BIGINT;
    v_tenant_id TEXT;
    v_charge_amount BIGINT;
BEGIN
    -- Lock the user row
    SELECT balance, reserved_balance, tenant_id 
    INTO v_balance, v_reserved, v_tenant_id
    FROM users 
    WHERE id = p_user_id 
    FOR UPDATE;
    
    IF p_is_success THEN
        -- Charge actual cost (User Revenue)
        v_charge_amount := p_actual_cost;
        
        UPDATE users 
        SET balance = balance - v_charge_amount,
            reserved_balance = reserved_balance - p_projected_cost,
            updated_at = NOW()
        WHERE id = p_user_id;
        
        -- Log charge
        INSERT INTO credit_transactions (
            user_id, tenant_id, type, amount, workflow_id,
            balance_before, balance_after, reserved_before, reserved_after,
            description
        ) VALUES (
            p_user_id, v_tenant_id, 'charge', -v_charge_amount, p_workflow_id,
            v_balance, v_balance - v_charge_amount, 
            v_reserved, v_reserved - p_projected_cost,
            'Charged for completed workflow ' || p_workflow_id
        );
    ELSE
        -- Refund: release hold without charging
        UPDATE users 
        SET reserved_balance = reserved_balance - p_projected_cost,
            updated_at = NOW()
        WHERE id = p_user_id;
        
        -- Log refund
        INSERT INTO credit_transactions (
            user_id, tenant_id, type, amount, workflow_id,
            balance_before, balance_after, reserved_before, reserved_after,
            description
        ) VALUES (
            p_user_id, v_tenant_id, 'release', 0, p_workflow_id,
            v_balance, v_balance, 
            v_reserved, v_reserved - p_projected_cost,
            'Released hold for failed workflow ' || p_workflow_id
        );
    END IF;
END;
$$;


-- Top up user credits (called by tenant backend)
CREATE OR REPLACE FUNCTION topup_credits(
    p_user_id UUID,
    p_amount BIGINT,
    p_description TEXT DEFAULT 'Credit top-up'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance BIGINT;
    v_tenant_id TEXT;
BEGIN
    SELECT balance, tenant_id INTO v_balance, v_tenant_id
    FROM users WHERE id = p_user_id FOR UPDATE;
    
    UPDATE users 
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    INSERT INTO credit_transactions (
        user_id, tenant_id, type, amount,
        balance_before, balance_after,
        description
    ) VALUES (
        p_user_id, v_tenant_id, 'topup', p_amount,
        v_balance, v_balance + p_amount,
        p_description
    );
END;
$$;


-- Get available credits (balance - reserved)
CREATE OR REPLACE FUNCTION get_available_credits(p_user_id UUID)
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
    SELECT GREATEST(0, balance - reserved_balance)
    FROM users WHERE id = p_user_id
$$;


-- ============================================
-- TRIGGERS: Updated Timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_executions_updated_at ON workflow_executions;
CREATE TRIGGER update_workflow_executions_updated_at
    BEFORE UPDATE ON workflow_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_generations_updated_at ON user_generations;
CREATE TRIGGER update_user_generations_updated_at
    BEFORE UPDATE ON user_generations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE tenants IS 'B2B clients that own user bases and configure their own OIDC providers';
COMMENT ON TABLE users IS 'End consumers with credit wallets, belonging to tenants';
COMMENT ON TABLE credit_transactions IS 'Audit trail for all credit movements (reserve, charge, refund, topup)';
COMMENT ON TABLE workflow_executions IS 'Each Temporal workflow run with billing attribution';
COMMENT ON TABLE tool_invocations IS 'Per-step execution records for caching, billing, and RLHF';
COMMENT ON TABLE artifacts IS 'Content-addressable storage metadata for Azure Blob artifacts';
COMMENT ON TABLE user_generations IS 'Gallery of jewelry try-on results with Azure Blob URLs';

COMMENT ON COLUMN users.balance IS 'Total credits owned by user';
COMMENT ON COLUMN users.reserved_balance IS 'Credits held for running workflows (available = balance - reserved)';
COMMENT ON COLUMN workflow_executions.actual_cost IS 'Credits charged to user (Revenue)';
COMMENT ON COLUMN workflow_executions.total_provider_cost IS 'Infrastructure cost borne by tenant (Expense)';
COMMENT ON COLUMN tool_invocations.input_hash IS 'SHA-256 of canonical input for cache lookup';

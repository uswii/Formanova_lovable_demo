-- ============================================================
-- FORMANOVA B2B2C DATABASE SCHEMA
-- ============================================================
-- This schema covers:
-- 1. AUTH SERVICE DB (users, oauth_accounts) - for auth server
-- 2. PIPELINE DB (tenants, wallets, generations, billing) - for temporal server
-- 
-- Run on your own PostgreSQL server
-- ============================================================

-- ============================================================
-- PART 1: AUTH SERVICE DATABASE
-- ============================================================
-- This is for your FastAPI Auth Service at 20.173.91.22:8002
-- Handles: Registration, Login, Google OAuth, JWT issuance

-- Users table (core authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),  -- bcrypt hashed, NULL for OAuth-only users
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,  -- Email verified
    is_superuser BOOLEAN DEFAULT FALSE,
    
    -- Optional profile fields
    full_name VARCHAR(100),
    avatar_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth accounts (Google, etc.)
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    oauth_name VARCHAR(50) NOT NULL,  -- "google"
    access_token TEXT NOT NULL,
    expires_at INTEGER,
    refresh_token TEXT,
    account_id VARCHAR(255) NOT NULL,  -- Google's user ID
    account_email VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(oauth_name, account_id)
);

-- Index for fast OAuth lookups
CREATE INDEX IF NOT EXISTS idx_oauth_lookup ON oauth_accounts(oauth_name, account_id);
CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);


-- ============================================================
-- PART 2: TEMPORAL PIPELINE DATABASE (B2B2C)
-- ============================================================
-- This is for your Temporal Agentic Pipeline
-- Handles: Multi-tenancy, Credit wallets, Billing, Generation history

-- Tenants (B2B Clients - businesses using your platform)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,  -- "ten_xxx" format
    name TEXT NOT NULL,
    
    -- OIDC Configuration (for JWT validation)
    issuer_url TEXT UNIQUE NOT NULL,  -- e.g., "http://20.173.91.22:8002"
    jwks_uri TEXT NOT NULL,           -- e.g., "http://20.173.91.22:8002/.well-known/jwks.json"
    audience TEXT,                     -- e.g., "fastapi-users:auth"
    
    -- API Key for machine-to-machine calls
    api_key_hash TEXT UNIQUE,  -- SHA-256 hash of the API key
    
    -- Tenant tier/plan
    tier TEXT DEFAULT 'free',  -- 'free', 'pro', 'enterprise'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline Users (End consumers with credit wallets)
-- These are JIT-provisioned when users authenticate via JWT
CREATE TABLE IF NOT EXISTS pipeline_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    
    -- External identity (from Auth Service)
    external_id TEXT NOT NULL,  -- User ID from JWT 'sub' claim
    email TEXT,
    
    -- Credit Wallet
    balance BIGINT DEFAULT 0,           -- Total credits owned
    reserved_balance BIGINT DEFAULT 0,  -- Credits locked during active workflows
    -- Available = balance - reserved_balance
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, external_id)
);

-- Credit Transactions (Audit trail for all credit movements)
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES pipeline_users(id) ON DELETE CASCADE NOT NULL,
    tenant_id TEXT REFERENCES tenants(id) NOT NULL,
    
    -- Transaction details
    type TEXT NOT NULL,  -- 'topup', 'hold', 'release', 'charge', 'refund'
    amount BIGINT NOT NULL,  -- Positive for credits in, negative for credits out
    balance_after BIGINT NOT NULL,  -- Balance after this transaction
    
    -- Reference to what caused this transaction
    workflow_id TEXT,  -- If related to a workflow
    description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Executions (Generation jobs with billing)
CREATE TABLE IF NOT EXISTS workflow_executions (
    id TEXT PRIMARY KEY,  -- Temporal workflow ID
    tenant_id TEXT REFERENCES tenants(id) NOT NULL,
    user_id UUID REFERENCES pipeline_users(id) NOT NULL,
    
    -- Workflow metadata
    workflow_name TEXT NOT NULL,  -- e.g., "jewelry_generation", "default_chain"
    workflow_type TEXT DEFAULT 'generation',  -- 'generation', 'preprocessing', 'full'
    
    -- Input/Output (store URLs, not binary data!)
    input_payload JSONB,  -- Workflow parameters (NOT images)
    input_image_url TEXT,  -- Azure blob URL
    output_urls JSONB,    -- Array of result image URLs
    
    -- Status tracking
    status TEXT DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    current_step TEXT,
    progress INTEGER DEFAULT 0,  -- 0-100
    error_message TEXT,
    
    -- Financial tracking (Dual Ledger)
    credit_hold_amount BIGINT DEFAULT 0,      -- Reserved at start
    actual_user_billed BIGINT DEFAULT 0,      -- What user paid (Revenue)
    internal_provider_cost BIGINT DEFAULT 0,  -- Infrastructure cost (Expense)
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

-- Tool Invocations (Per-step billing + RLHF data)
CREATE TABLE IF NOT EXISTS tool_invocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id TEXT REFERENCES workflow_executions(id) ON DELETE CASCADE NOT NULL,
    tenant_id TEXT REFERENCES tenants(id) NOT NULL,
    user_id UUID REFERENCES pipeline_users(id) NOT NULL,
    
    -- Tool details
    tool_name TEXT NOT NULL,  -- e.g., "segment", "refine_mask", "flux_generate"
    tool_version TEXT DEFAULT '1.0',
    
    -- Caching (for deterministic tools)
    input_hash TEXT,  -- SHA-256 of normalized inputs
    is_deterministic BOOLEAN DEFAULT FALSE,
    
    -- Execution details
    input_data JSONB,   -- Tool inputs (NOT images, just parameters)
    output_data JSONB,  -- Tool outputs (URLs, metrics, etc.)
    
    -- Status
    is_success BOOLEAN DEFAULT FALSE,
    is_cached BOOLEAN DEFAULT FALSE,  -- Cache hit = no cost
    is_retry BOOLEAN DEFAULT FALSE,
    is_skipped BOOLEAN DEFAULT FALSE,  -- Gated/conditional skip
    
    -- Cost tracking
    cost BIGINT DEFAULT 0,  -- Credits charged for this invocation
    provider_cost BIGINT DEFAULT 0,  -- Actual infrastructure cost
    
    -- RLHF fields (for model improvement)
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER
);

-- User Generations (High-level gallery view)
CREATE TABLE IF NOT EXISTS user_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES pipeline_users(id) ON DELETE CASCADE NOT NULL,
    tenant_id TEXT REFERENCES tenants(id) NOT NULL,
    workflow_id TEXT REFERENCES workflow_executions(id),
    
    -- Generation details
    jewelry_type TEXT,  -- 'necklace', 'earring', 'bracelet', 'ring'
    
    -- Image URLs (stored in Azure Blob, NOT in DB!)
    original_image_url TEXT NOT NULL,
    mask_url TEXT,
    result_image_url TEXT,
    
    -- Metadata
    title TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,  -- Visible in gallery
    
    -- Quality metrics
    metrics JSONB,  -- { precision, recall, iou, growth_ratio }
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenant_issuer ON tenants(issuer_url);
CREATE INDEX IF NOT EXISTS idx_tenant_api_key ON tenants(api_key_hash);

-- User lookups
CREATE INDEX IF NOT EXISTS idx_user_tenant_external ON pipeline_users(tenant_id, external_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON pipeline_users(email);

-- Credit transactions
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_workflow ON credit_transactions(workflow_id);

-- Workflow lookups
CREATE INDEX IF NOT EXISTS idx_workflow_user ON workflow_executions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_tenant ON workflow_executions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow_executions(status);

-- Tool invocations (for caching)
CREATE INDEX IF NOT EXISTS idx_tool_cache ON tool_invocations(tool_name, tool_version, input_hash) 
    WHERE is_deterministic = TRUE AND is_success = TRUE;
CREATE INDEX IF NOT EXISTS idx_tool_workflow ON tool_invocations(workflow_id);

-- User generations (gallery)
CREATE INDEX IF NOT EXISTS idx_generation_user ON user_generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_favorites ON user_generations(user_id, is_favorite) 
    WHERE is_favorite = TRUE;


-- ============================================================
-- FUNCTIONS FOR CREDIT MANAGEMENT
-- ============================================================

-- Reserve credits (atomic hold)
CREATE OR REPLACE FUNCTION reserve_credits(
    p_user_id UUID,
    p_amount BIGINT,
    p_workflow_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_available BIGINT;
BEGIN
    -- Lock the user row
    SELECT balance - reserved_balance INTO v_available
    FROM pipeline_users
    WHERE id = p_user_id
    FOR UPDATE;
    
    -- Check if enough credits
    IF v_available < p_amount THEN
        RETURN FALSE;
    END IF;
    
    -- Reserve the credits
    UPDATE pipeline_users
    SET reserved_balance = reserved_balance + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Log the transaction
    INSERT INTO credit_transactions (user_id, tenant_id, type, amount, balance_after, workflow_id, description)
    SELECT p_user_id, tenant_id, 'hold', -p_amount, balance - reserved_balance, p_workflow_id, 'Credit hold for workflow'
    FROM pipeline_users WHERE id = p_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Settle credits (release hold and charge actual amount)
CREATE OR REPLACE FUNCTION settle_credits(
    p_user_id UUID,
    p_workflow_id TEXT,
    p_hold_amount BIGINT,
    p_actual_cost BIGINT,
    p_success BOOLEAN
) RETURNS VOID AS $$
BEGIN
    -- Release the hold
    UPDATE pipeline_users
    SET reserved_balance = reserved_balance - p_hold_amount,
        -- Only deduct from balance if successful
        balance = CASE WHEN p_success THEN balance - p_actual_cost ELSE balance END,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Log release transaction
    INSERT INTO credit_transactions (user_id, tenant_id, type, amount, balance_after, workflow_id, description)
    SELECT p_user_id, tenant_id, 'release', p_hold_amount, balance, p_workflow_id, 'Credit hold released'
    FROM pipeline_users WHERE id = p_user_id;
    
    -- Log charge transaction (if successful)
    IF p_success AND p_actual_cost > 0 THEN
        INSERT INTO credit_transactions (user_id, tenant_id, type, amount, balance_after, workflow_id, description)
        SELECT p_user_id, tenant_id, 'charge', -p_actual_cost, balance, p_workflow_id, 'Workflow completed'
        FROM pipeline_users WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Top up credits (add credits to wallet)
CREATE OR REPLACE FUNCTION topup_credits(
    p_user_id UUID,
    p_amount BIGINT,
    p_description TEXT DEFAULT 'Credit top-up'
) RETURNS BIGINT AS $$
DECLARE
    v_new_balance BIGINT;
BEGIN
    UPDATE pipeline_users
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING balance INTO v_new_balance;
    
    -- Log the transaction
    INSERT INTO credit_transactions (user_id, tenant_id, type, amount, balance_after, description)
    SELECT p_user_id, tenant_id, 'topup', p_amount, v_new_balance, p_description
    FROM pipeline_users WHERE id = p_user_id;
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- INITIAL SETUP: Register your Auth Service as a Tenant
-- ============================================================
-- Run this ONCE after creating the tables:

-- INSERT INTO tenants (id, name, issuer_url, jwks_uri, audience, tier)
-- VALUES (
--     'ten_formanova_001',
--     'FormaNova Auth',
--     'http://20.173.91.22:8002',
--     'http://20.173.91.22:8002/.well-known/jwks.json',
--     'fastapi-users:auth',
--     'enterprise'
-- );

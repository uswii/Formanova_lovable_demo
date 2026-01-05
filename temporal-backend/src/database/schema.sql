-- FormaNova Database Schema
-- Run this SQL to create all tables on your PostgreSQL server

-- ============================================
-- ENUMS
-- ============================================

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'pro', 'admin', 'moderator');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE jewelry_type AS ENUM ('necklace', 'bracelet', 'ring', 'earring', 'pendant', 'other');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE image_type AS ENUM ('original', 'processed', 'mask', 'flux_result', 'flux_fidelity', 'gemini_result', 'gemini_fidelity');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    status user_status NOT NULL DEFAULT 'active',
    
    -- Generation credits
    free_generations_used INTEGER NOT NULL DEFAULT 0,
    free_generations_limit INTEGER NOT NULL DEFAULT 2,
    paid_generations_available INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT free_generations_used_non_negative CHECK (free_generations_used >= 0),
    CONSTRAINT free_generations_limit_non_negative CHECK (free_generations_limit >= 0),
    CONSTRAINT paid_generations_non_negative CHECK (paid_generations_available >= 0)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);


-- ============================================
-- USER ROLES TABLE (Separate for security!)
-- ============================================

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);


-- ============================================
-- PAYMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Payment details
    amount_cents INTEGER NOT NULL DEFAULT 1900,  -- $19.00
    currency TEXT NOT NULL DEFAULT 'usd',
    generations_purchased INTEGER NOT NULL DEFAULT 1,
    
    -- Status
    status payment_status NOT NULL DEFAULT 'pending',
    
    -- Stripe fields (placeholder)
    stripe_payment_intent_id TEXT,
    stripe_session_id TEXT,
    stripe_customer_id TEXT,
    
    -- Metadata (JSON for flexibility)
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    CONSTRAINT amount_positive CHECK (amount_cents > 0),
    CONSTRAINT generations_positive CHECK (generations_purchased > 0)
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent ON payments(stripe_payment_intent_id);


-- ============================================
-- GENERATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Workflow tracking
    workflow_id TEXT,
    status generation_status NOT NULL DEFAULT 'pending',
    
    -- Generation details
    jewelry_type jewelry_type,
    prompt TEXT,
    
    -- Payment tracking
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    
    -- Error handling
    error_message TEXT,
    
    -- Metadata (mask points, brush strokes, etc.)
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_workflow_id ON generations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);


-- ============================================
-- GENERATION IMAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS generation_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    
    -- Image details
    image_type image_type NOT NULL,
    azure_path TEXT NOT NULL,
    azure_url TEXT,
    
    -- Ordering
    sequence INTEGER NOT NULL DEFAULT 0,
    
    -- File info
    file_size_bytes BIGINT,
    width INTEGER,
    height INTEGER,
    
    -- Fidelity metrics
    fidelity_precision FLOAT,
    fidelity_recall FLOAT,
    fidelity_iou FLOAT,
    fidelity_growth_ratio FLOAT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_images_generation_id ON generation_images(generation_id);
CREATE INDEX IF NOT EXISTS idx_generation_images_type ON generation_images(image_type);


-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user has a specific role (prevents recursive RLS)
CREATE OR REPLACE FUNCTION has_role(check_user_id UUID, check_role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = check_user_id AND role = check_role
    )
$$;

-- Function to get remaining generations
CREATE OR REPLACE FUNCTION get_remaining_generations(check_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
    SELECT GREATEST(0, free_generations_limit - free_generations_used) + paid_generations_available
    FROM users WHERE id = check_user_id
$$;

-- Function to check if user can generate
CREATE OR REPLACE FUNCTION can_user_generate(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT get_remaining_generations(check_user_id) > 0
    AND EXISTS (SELECT 1 FROM users WHERE id = check_user_id AND status = 'active')
$$;

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_generations_updated_at ON generations;
CREATE TRIGGER update_generations_updated_at
    BEFORE UPDATE ON generations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- INITIAL DATA (Optional)
-- ============================================

-- You can add initial admin users or test data here if needed
-- INSERT INTO users (id, email, full_name) VALUES ('...', 'admin@example.com', 'Admin User');
-- INSERT INTO user_roles (user_id, role) VALUES ('...', 'admin');

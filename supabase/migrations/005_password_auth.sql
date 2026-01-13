-- Password Authentication Migration
-- Adds password support to users table

-- Password hash field
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Login attempt tracking for brute force protection
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;

-- Lockout timestamp (blocked until this time)
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- Index for faster phone lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Grant permissions
GRANT ALL ON users TO anon, authenticated, service_role;

-- Clean slate
DROP TABLE IF EXISTS otp_codes CASCADE;

-- Recreate table
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_otp_phone ON otp_codes(phone);

-- Security
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Only Allow Service Role (Backend) to access
-- This prevents public clients from reading OTP codes
CREATE POLICY "Service role access" ON otp_codes 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

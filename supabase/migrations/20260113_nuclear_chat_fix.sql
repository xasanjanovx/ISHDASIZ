-- NUCLEAR FIX FOR CHAT SYSTEM
-- Run this in Supabase SQL Editor to fix delete and read issues

-- ============================================
-- STEP 1: Fix RLS on conversations table
-- ============================================

-- Disable RLS temporarily to allow all operations
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;

-- Or if you want RLS, create permissive policies:
-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow all for conversations" ON conversations;
-- CREATE POLICY "Allow all for conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STEP 2: Fix RLS on messages table  
-- ============================================

-- Disable RLS temporarily to allow all operations
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Or if you want RLS, create permissive policies:
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow all for messages" ON messages;
-- CREATE POLICY "Allow all for messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STEP 3: Grant permissions (if needed)
-- ============================================

GRANT ALL ON conversations TO authenticated;
GRANT ALL ON conversations TO anon;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON messages TO anon;

-- ============================================
-- VERIFICATION: Check tables exist
-- ============================================

SELECT 'conversations' as table_name, count(*) as row_count FROM conversations
UNION ALL
SELECT 'messages' as table_name, count(*) as row_count FROM messages;

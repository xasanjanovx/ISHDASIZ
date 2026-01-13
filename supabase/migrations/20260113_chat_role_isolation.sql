-- Add role columns to conversations for chat isolation by user role
-- This allows same user with different roles to have separate conversations

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS user1_role VARCHAR(20) DEFAULT 'job_seeker',
ADD COLUMN IF NOT EXISTS user2_role VARCHAR(20) DEFAULT 'employer';

-- Add deleted_by column for soft delete functionality
-- When a user deletes a chat, it's only hidden from them, not the other user
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS deleted_by_user1 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_by_user2 BOOLEAN DEFAULT false;

-- Create index for role-based filtering
CREATE INDEX IF NOT EXISTS idx_conversations_roles ON conversations(user1_id, user1_role, user2_id, user2_role);

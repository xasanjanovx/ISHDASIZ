-- Fix RLS policies for messages and conversations to allow delete
-- This enables users to delete their own conversations and messages

-- Allow users to delete messages in conversations they participate in
DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON messages;
CREATE POLICY "Users can delete messages in their conversations" ON messages
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM conversations c 
        WHERE c.id = messages.conversation_id 
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
);

-- Allow users to delete conversations they participate in
DROP POLICY IF EXISTS "Users can delete their conversations" ON conversations;
CREATE POLICY "Users can delete their conversations" ON conversations
FOR DELETE USING (
    user1_id = auth.uid() OR user2_id = auth.uid()
);

-- Enable RLS on these tables if not already enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

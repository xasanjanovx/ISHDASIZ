-- Deploy together with the account chat API. No rows are deleted.
-- Custom SMS sessions are checked on the application server; the browser must
-- never read password hashes, OTPs, Telegram sessions, or chat tables directly.
BEGIN;

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user1_role text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user2_role text;

-- A person can have both profiles. Keep their conversations for opposite
-- roles separate, while preserving every existing conversation and message.
DO $role_uniqueness$
DECLARE pair_constraint text;
BEGIN
    FOR pair_constraint IN
        SELECT c.conname FROM pg_constraint c
        WHERE c.conrelid = 'public.conversations'::regclass AND c.contype = 'u'
          AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
               FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey))
              = ARRAY['user1_id', 'user2_id']::text[]
    LOOP
        EXECUTE format('ALTER TABLE public.conversations DROP CONSTRAINT %I', pair_constraint);
    END LOOP;
END;
$role_uniqueness$;
CREATE UNIQUE INDEX IF NOT EXISTS account_chat_participants_roles_idx
    ON public.conversations (user1_id, user2_id, COALESCE(user1_role, ''), COALESCE(user2_role, ''));

CREATE TABLE IF NOT EXISTS public.conversation_preferences (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    hidden_at timestamptz,
    PRIMARY KEY (user_id, conversation_id)
);

DO $private_tables$
DECLARE
    table_name text;
    column_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['users', 'otp_codes', 'telegram_sessions', 'conversations', 'messages', 'conversation_preferences'] LOOP
        IF to_regclass(format('public.%I', table_name)) IS NULL THEN CONTINUE; END IF;
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        -- Revocation also protects tables that have historical permissive policies.
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
        FOR column_name IN SELECT a.attname FROM pg_attribute a
            WHERE a.attrelid = to_regclass(format('public.%I', table_name)) AND a.attnum > 0 AND NOT a.attisdropped
        LOOP
            EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.%I FROM PUBLIC, anon, authenticated',
                column_name, column_name, column_name, column_name, table_name);
        END LOOP;
        EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
    END LOOP;
END;
$private_tables$;

CREATE INDEX IF NOT EXISTS conversations_user1_updated_idx ON public.conversations (user1_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_user2_updated_idx ON public.conversations (user2_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_cursor_idx ON public.messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS messages_unread_conversation_idx ON public.messages (conversation_id, sender_id) WHERE is_read = false;

-- Repair ordering for older messages that were saved without touching the chat.
UPDATE public.conversations c SET updated_at = latest.created_at
FROM (SELECT conversation_id, max(created_at) AS created_at FROM public.messages GROUP BY conversation_id) latest
WHERE c.id = latest.conversation_id AND (c.updated_at IS NULL OR c.updated_at < latest.created_at);

CREATE OR REPLACE FUNCTION public.account_chat_updated_at() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $function$
BEGIN
    UPDATE public.conversations SET updated_at = GREATEST(COALESCE(updated_at, NEW.created_at), NEW.created_at)
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.account_chat_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_chat_updated_at() TO service_role;
DROP TRIGGER IF EXISTS account_chat_message_timestamp ON public.messages;
CREATE TRIGGER account_chat_message_timestamp AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.account_chat_updated_at();

DO $maintenance_functions$
BEGIN
    IF to_regprocedure('public.cleanup_old_telegram_sessions()') IS NOT NULL THEN
        REVOKE ALL ON FUNCTION public.cleanup_old_telegram_sessions() FROM PUBLIC, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.cleanup_old_telegram_sessions() TO service_role;
    END IF;
END;
$maintenance_functions$;

COMMIT;

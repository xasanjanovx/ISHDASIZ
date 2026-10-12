-- Atomic custom-session chat writes. Client message UUIDs make ambiguous retries safe.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_chat_action(
 p_user_id uuid,p_session_version integer,p_role text,p_action text,
 p_conversation_id uuid DEFAULT NULL,p_partner_id uuid DEFAULT NULL,
 p_request_id uuid DEFAULT NULL,p_content text DEFAULT NULL,p_through uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account public.users%ROWTYPE;chat public.conversations%ROWTYPE;initial public.conversations%ROWTYPE;
 peer uuid;other_role text;first_id uuid;second_id uuid;first_role text;second_role text;
 peer_open boolean;peer_profile boolean;saved public.messages%ROWTYPE;anchor public.messages%ROWTYPE;body text;created boolean:=false;
BEGIN
 IF p_user_id IS NULL OR p_session_version IS NULL OR p_session_version<0 OR p_role IS NULL OR p_role NOT IN('employer','job_seeker') OR
  p_action IS NULL OR p_action NOT IN('open','inspect','send','read','archive','restore') THEN RAISE EXCEPTION 'Invalid chat action' USING ERRCODE='22023';END IF;
 other_role:=CASE p_role WHEN 'employer' THEN 'job_seeker' ELSE 'employer' END;
 IF p_action='open' THEN
  IF p_partner_id IS NULL OR p_partner_id=p_user_id THEN RAISE EXCEPTION 'Invalid partner' USING ERRCODE='22023';END IF;peer:=p_partner_id;
 ELSE
  IF p_conversation_id IS NULL THEN RAISE EXCEPTION 'Chat unavailable' USING ERRCODE='P0002';END IF;
  SELECT * INTO initial FROM public.conversations WHERE id=p_conversation_id AND(p_user_id=user1_id OR p_user_id=user2_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Chat unavailable' USING ERRCODE='P0002';END IF;
  peer:=CASE WHEN initial.user1_id=p_user_id THEN initial.user2_id ELSE initial.user1_id END;
 END IF;
 -- Closure/restore take account locks first; the same order prevents stale writes.
 PERFORM id FROM public.users WHERE id IN(p_user_id,peer) ORDER BY id FOR SHARE;
 SELECT * INTO account FROM public.users WHERE id=p_user_id;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version<>p_session_version THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE='42501';END IF;
 IF p_role='employer' THEN PERFORM 1 FROM public.employer_profiles WHERE user_id=p_user_id FOR SHARE;
 ELSE PERFORM 1 FROM public.job_seeker_profiles WHERE user_id=p_user_id FOR SHARE;END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='28000';END IF;
 peer_open:=EXISTS(SELECT 1 FROM public.users WHERE id=peer AND closed_at IS NULL);
 IF other_role='employer' THEN PERFORM 1 FROM public.employer_profiles WHERE user_id=peer FOR SHARE;
 ELSE PERFORM 1 FROM public.job_seeker_profiles WHERE user_id=peer FOR SHARE;END IF;peer_profile:=FOUND;
 IF p_action='open' THEN
  first_id:=least(p_user_id,peer);second_id:=greatest(p_user_id,peer);
  first_role:=CASE WHEN first_id=p_user_id THEN p_role ELSE other_role END;
  second_role:=CASE WHEN second_id=p_user_id THEN p_role ELSE other_role END;
  PERFORM pg_advisory_xact_lock(hashtextextended('ishdasiz-chat:'||first_id||':'||first_role||':'||second_id||':'||second_role,0));
  SELECT * INTO chat FROM public.conversations WHERE
   (user1_id=first_id AND user2_id=second_id AND(user1_role=first_role OR user1_role IS NULL) AND(user2_role=second_role OR user2_role IS NULL)) OR
   (user1_id=second_id AND user2_id=first_id AND(user1_role=second_role OR user1_role IS NULL) AND(user2_role=first_role OR user2_role IS NULL))
   ORDER BY created_at,id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
   IF NOT peer_open OR NOT peer_profile THEN RAISE EXCEPTION 'Partner unavailable' USING ERRCODE='P0001';END IF;
   INSERT INTO public.conversations(user1_id,user2_id,user1_role,user2_role,updated_at)
    VALUES(first_id,second_id,first_role,second_role,clock_timestamp()) RETURNING * INTO chat;created:=true;
  END IF;
  RETURN jsonb_build_object('id',chat.id,'created',created);
 END IF;
 SELECT * INTO chat FROM public.conversations WHERE id=p_conversation_id FOR UPDATE;
 IF NOT FOUND OR chat.user1_id IS DISTINCT FROM initial.user1_id OR chat.user2_id IS DISTINCT FROM initial.user2_id THEN RAISE EXCEPTION 'Chat changed' USING ERRCODE='40001';END IF;
 IF (chat.user1_id=p_user_id AND((chat.user1_role IS NOT NULL AND chat.user1_role<>p_role) OR(chat.user2_role IS NOT NULL AND chat.user2_role<>other_role))) OR
  (chat.user2_id=p_user_id AND((chat.user2_role IS NOT NULL AND chat.user2_role<>p_role) OR(chat.user1_role IS NOT NULL AND chat.user1_role<>other_role))) THEN RAISE EXCEPTION 'Profile mismatch' USING ERRCODE='28000';END IF;
 IF p_action='inspect' THEN RETURN jsonb_build_object('conversation',jsonb_build_object('id',chat.id,'user1_id',chat.user1_id,'user2_id',chat.user2_id,'user1_role',chat.user1_role,'user2_role',chat.user2_role),'can_send',peer_open AND peer_profile);END IF;
 IF p_action='send' THEN
  body:=regexp_replace(p_content,'^[[:space:]]+|[[:space:]]+$','','g');
  IF p_request_id IS NULL OR body IS NULL OR length(body)<1 OR length(body)>4000 THEN RAISE EXCEPTION 'Invalid message' USING ERRCODE='22023';END IF;
  SELECT * INTO saved FROM public.messages WHERE id=p_request_id FOR SHARE;
  IF FOUND THEN
   IF saved.conversation_id IS DISTINCT FROM chat.id OR saved.sender_id IS DISTINCT FROM p_user_id OR saved.content IS DISTINCT FROM body THEN RAISE EXCEPTION 'Message request changed' USING ERRCODE='40001';END IF;
  ELSE
   IF NOT peer_open OR NOT peer_profile THEN RAISE EXCEPTION 'Partner unavailable' USING ERRCODE='P0001';END IF;
   -- Also preserves the cursor order of conversations with legacy future timestamps.
   INSERT INTO public.messages(id,conversation_id,sender_id,content,is_read,created_at)
    VALUES(p_request_id,chat.id,p_user_id,body,false,greatest(clock_timestamp(),coalesce((SELECT max(created_at)+interval '1 microsecond' FROM public.messages WHERE conversation_id=chat.id),clock_timestamp())))
    ON CONFLICT(id) DO NOTHING RETURNING * INTO saved;
   IF NOT FOUND THEN
    SELECT * INTO saved FROM public.messages WHERE id=p_request_id FOR SHARE;
    IF saved.conversation_id IS DISTINCT FROM chat.id OR saved.sender_id IS DISTINCT FROM p_user_id OR saved.content IS DISTINCT FROM body THEN RAISE EXCEPTION 'Message request changed' USING ERRCODE='40001';END IF;
   END IF;
  END IF;
  RETURN jsonb_build_object('message',jsonb_build_object('id',saved.id,'content',saved.content,'sender_id',saved.sender_id,'created_at',saved.created_at));
 ELSIF p_action='read' THEN
  SELECT * INTO anchor FROM public.messages WHERE id=p_through AND conversation_id=chat.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE='22023';END IF;
  UPDATE public.messages SET is_read=true WHERE conversation_id=chat.id AND sender_id<>p_user_id AND is_read IS NOT TRUE AND(created_at,id)<=(anchor.created_at,anchor.id);
 ELSIF p_action='archive' THEN
  INSERT INTO public.conversation_preferences(user_id,conversation_id,hidden_at)
   VALUES(p_user_id,chat.id,greatest(clock_timestamp(),coalesce((SELECT max(created_at) FROM public.messages WHERE conversation_id=chat.id),clock_timestamp())))
   ON CONFLICT(user_id,conversation_id) DO UPDATE SET hidden_at=EXCLUDED.hidden_at;
 ELSE
  UPDATE public.conversation_preferences SET hidden_at=NULL WHERE user_id=p_user_id AND conversation_id=chat.id;
 END IF;
 RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_chat_action(uuid,integer,text,text,uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_chat_action(uuid,integer,text,text,uuid,uuid,uuid,text,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

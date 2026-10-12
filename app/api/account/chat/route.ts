import { chatTimestamp } from '@/lib/chat-messages';
import { chatAction } from '@/lib/chat-actions';
import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, checkSameOrigin, isUuid, requireAccount } from '@/lib/auth/account';
import { belongsToChat, chatRole, chatScope, participantName, requireChatRole, roleMatches } from '@/lib/account-chat';

export async function GET(request: NextRequest) {
    try {
        const { client, user } = await requireAccount(request);
        const role = chatRole(request.nextUrl.searchParams.get('role'));
        await requireChatRole(client, user.id, role);
        const offset = Number(request.nextUrl.searchParams.get('offset') || 0);
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw new AccountError(400, 'Некорректная страница');
        const { data, error } = await client.from('conversations').select('*')
            .or(chatScope(user.id, role)).order('updated_at', { ascending: false }).order('id')
            .range(offset, offset + 24);
        if (error) throw error;
        const { data: preferences, error: prefError } = await client.from('conversation_preferences').select('conversation_id, hidden_at').eq('user_id', user.id);
        // During rollout old databases can still read chats; archiving requires the new migration.
        if (prefError && !['42P01', 'PGRST205'].includes(prefError.code)) throw prefError;
        const hidden = new Map((preferences || []).map(p => [p.conversation_id, p.hidden_at]));
        const conversations = await Promise.all((data || []).filter(c => belongsToChat(c, user.id) && roleMatches(c, user.id, role)).map(async c => {
            const partner = c.user1_id === user.id ? c.user2_id : c.user1_id;
            let unreadQuery = client.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id).neq('sender_id', user.id).eq('is_read', false);
            const hiddenAt = hidden.get(c.id);
            if (hiddenAt) unreadQuery = unreadQuery.gt('created_at', hiddenAt);
            const [name, last, unread] = await Promise.all([
                participantName(client, partner, role === 'employer' ? 'job_seeker' : 'employer'),
                client.from('messages').select('id, content, created_at').eq('conversation_id', c.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
                unreadQuery,
            ]);
            if (last.error || unread.error) throw new Error('Chat summary unavailable');
            if (hiddenAt && (!last.data || chatTimestamp(last.data.created_at) <= chatTimestamp(hiddenAt))) return null;
            return { id: c.id, name, lastMessage: last.data?.content || '', lastMessageAt: last.data?.created_at || c.created_at, unread: unread.count || 0 };
        }));
        return accountResult({ conversations: conversations.filter(Boolean), nextOffset: data?.length === 25 ? offset + 25 : null });
    } catch (error) { return accountFailure(error); }
}

export async function POST(request: NextRequest) {
    try {
        checkSameOrigin(request);
        const { client,user } = await requireAccount(request);
        const body = await request.json().catch(() => null);
        const role = chatRole(body?.role);
        if (!isUuid(body?.userId) || body.userId === user.id) throw new AccountError(400,'Выберите собеседника / Suhbatdoshni tanlang');
        const data = await chatAction(client,user,role,'open',{ partnerId: body.userId });
        if (!isUuid(data.id) || typeof data.created !== 'boolean') throw new AccountError(503,'Чат временно недоступен / Chat vaqtincha mavjud emas');
        return accountResult({ id: data.id },data.created ? 201 : 200);
    } catch(error) { return accountFailure(error); }
}

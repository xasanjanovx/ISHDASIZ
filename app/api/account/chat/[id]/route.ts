import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, checkSameOrigin, isUuid, requireAccount } from '@/lib/auth/account';
import { chatRole, participantName } from '@/lib/account-chat';
import { chatAction } from '@/lib/chat-actions';

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Context) {
    try {
        const { client, user } = await requireAccount(request);
        const id = (await params).id.toLowerCase();
        if (!isUuid(id)) throw new AccountError(404,'Чат недоступен / Chat mavjud emas');
        const role = chatRole(request.nextUrl.searchParams.get('role'));
        const access = await chatAction(client,user,role,'inspect',{ conversationId: id });
        const conversation = access.conversation;
        if (conversation?.id !== id || ![conversation.user1_id,conversation.user2_id].includes(user.id) || typeof access.can_send !== 'boolean') throw new AccountError(503,'Чат временно недоступен / Chat vaqtincha mavjud emas');
        let query = client.from('messages').select('id, content, sender_id, created_at')
            .eq('conversation_id', conversation.id);
        const before = request.nextUrl.searchParams.get('before');
        const after = request.nextUrl.searchParams.get('after');
        if (before && after) throw new AccountError(400, 'Некорректный запрос');
        if (before || after) {
            const cursor = before || after;
            if (!isUuid(cursor)) throw new AccountError(400, 'Некорректный курсор');
            const anchor = await client.from('messages').select('id, created_at').eq('id', cursor).eq('conversation_id', conversation.id).maybeSingle();
            if (anchor.error) throw anchor.error;
            if (!anchor.data) throw new AccountError(400, 'Сообщение не найдено / Xabar topilmadi');
            const direction = before ? 'lt' : 'gt';
            query = query.or(`created_at.${direction}.${anchor.data.created_at},and(created_at.eq.${anchor.data.created_at},id.${direction}.${anchor.data.id})`);
        }
        const result = await query.order('created_at', { ascending: !!after }).order('id', { ascending: !!after }).limit(51);
        if (result.error) throw result.error;
        const messages = (result.data || []).slice(0, 50);
        if (!after) messages.reverse();
        const partner = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;
        return accountResult({ messages, can_send: access.can_send, name: await participantName(client, partner, role === 'employer' ? 'job_seeker' : 'employer'),
            more: (result.data?.length || 0) > 50, cursor: after ? messages.at(-1)?.id : messages[0]?.id });
    } catch (error) { return accountFailure(error); }
}

export async function POST(request: NextRequest,{ params }: Context) {
  try {
    checkSameOrigin(request);
    const { client,user } = await requireAccount(request);
    const id = (await params).id.toLowerCase();
    if (!isUuid(id)) throw new AccountError(404,'Чат недоступен / Chat mavjud emas');
    const body = await request.json().catch(() => null),role = chatRole(body?.role);
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (!content || content.length > 4000 || !isUuid(body?.request_id)) throw new AccountError(400,'Некорректное сообщение / Noto‘g‘ri xabar');
    const data = await chatAction(client,user,role,'send',{ conversationId: id,requestId: body.request_id,content });
    const message = data.message;
    if (message?.id?.toLowerCase() !== body.request_id.toLowerCase() || message.sender_id !== user.id || message.content !== content || typeof message.created_at !== 'string' || !Number.isFinite(Date.parse(message.created_at))) throw new AccountError(503,'Не удалось подтвердить сообщение / Xabarni tasdiqlab bo‘lmadi');
    return accountResult({ message: { id: message.id,content: message.content,sender_id: message.sender_id,created_at: message.created_at } },201);
  } catch(error) { return accountFailure(error); }
}

export async function PATCH(request: NextRequest,{ params }: Context) {
  try {
    checkSameOrigin(request);
    const { client,user } = await requireAccount(request);
    const id = (await params).id.toLowerCase();
    if (!isUuid(id)) throw new AccountError(404,'Чат недоступен / Chat mavjud emas');
    const body = await request.json().catch(() => null),role = chatRole(body?.role);
    if (body?.action !== 'restore' && (body?.action !== 'read' || !isUuid(body?.through))) throw new AccountError(400,'Некорректное действие / Noto‘g‘ri amal');
    const data = await chatAction(client,user,role,body.action,{ conversationId: id,...(body.action === 'read' ? { through: body.through } : {}) });
    if (data.success !== true) throw new AccountError(503,'Не удалось подтвердить действие / Amalni tasdiqlab bo‘lmadi');
    return accountResult({ success: true });
  } catch(error) { return accountFailure(error); }
}

export async function DELETE(request: NextRequest,{ params }: Context) {
  try {
    checkSameOrigin(request);
    const { client,user } = await requireAccount(request);
    const id = (await params).id.toLowerCase();
    if (!isUuid(id)) throw new AccountError(404,'Чат недоступен / Chat mavjud emas');
    const role = chatRole(request.nextUrl.searchParams.get('role'));
    const data = await chatAction(client,user,role,'archive',{ conversationId: id });
    if (data.success !== true) throw new AccountError(503,'Не удалось подтвердить действие / Amalni tasdiqlab bo‘lmadi');
    return accountResult({ success: true });
  } catch(error) { return accountFailure(error); }
}

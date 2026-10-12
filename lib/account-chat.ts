import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountError, isUuid } from './auth/account';

export type ChatRole = 'job_seeker' | 'employer';
export function chatRole(value: unknown): ChatRole {
    if (value !== 'job_seeker' && value !== 'employer') throw new AccountError(400, 'Выберите роль / Rolni tanlang');
    return value;
}

export async function requireChatRole(client: SupabaseClient, userId: string, role: ChatRole) {
    const table = role === 'employer' ? 'employer_profiles' : 'job_seeker_profiles';
    const { data, error } = await client.from(table).select('id').eq('user_id', userId).maybeSingle();
    if (error) throw new AccountError(503, 'Не удалось загрузить профиль / Profilni yuklab bo‘lmadi');
    if (!data) throw new AccountError(403, 'Сначала создайте профиль / Avval profil yarating');
    return data;
}

export function belongsToChat(conversation: any, userId: string) {
    return conversation?.user1_id === userId || conversation?.user2_id === userId;
}

export function roleMatches(conversation: any, userId: string, role: ChatRole) {
    const actual = conversation.user1_id === userId ? conversation.user1_role : conversation.user2_role;
    return !actual || actual === role;
}

export function chatScope(userId: string, role: ChatRole) {
    return `and(user1_id.eq.${userId},or(user1_role.eq.${role},user1_role.is.null)),and(user2_id.eq.${userId},or(user2_role.eq.${role},user2_role.is.null))`;
}

export async function requireConversation(client: SupabaseClient, userId: string, id: string) {
    if (!isUuid(id)) throw new AccountError(404, 'Чат не найден / Chat topilmadi');
    // The participation constraint is applied in the database as well as checked below.
    const { data, error } = await client.from('conversations').select('*').eq('id', id)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`).maybeSingle();
    if (error) throw new AccountError(503, 'Не удалось загрузить чат / Chatni yuklab bo‘lmadi');
    if (!data || !belongsToChat(data, userId)) throw new AccountError(404, 'Чат не найден / Chat topilmadi');
    return data;
}

export async function participantName(client: SupabaseClient, id: string, role: ChatRole) {
    const employer = role === 'employer';
    const { data, error } = await client.from(employer ? 'employer_profiles' : 'job_seeker_profiles')
        .select(employer ? 'company_name' : 'full_name').eq('user_id', id).maybeSingle();
    if (error) throw new AccountError(503, 'Не удалось загрузить собеседника / Suhbatdoshni yuklab bo‘lmadi');
    return (data as any)?.[employer ? 'company_name' : 'full_name'] || (employer ? 'Компания / Kompaniya' : 'Соискатель / Nomzod');
}

export async function unreadMessages(client: SupabaseClient, userId: string, role: ChatRole) {
    let total = 0;
    // Page the conversations; do not silently truncate counters at Supabase's row limit.
    for (let offset = 0; ; offset += 200) {
        const { data, error } = await client.from('conversations').select('*')
            .or(chatScope(userId, role)).order('id').range(offset, offset + 199);
        if (error) throw new AccountError(503, 'Не удалось загрузить сообщения / Xabarlarni yuklab bo‘lmadi');
        const ids = (data || []).filter(c => belongsToChat(c, userId) && roleMatches(c, userId, role)).map(c => c.id);
        if (ids.length) {
            const preferences = await client.from('conversation_preferences').select('conversation_id, hidden_at')
                .eq('user_id', userId).in('conversation_id', ids).not('hidden_at', 'is', null);
            if (preferences.error && !['42P01', 'PGRST205'].includes(preferences.error.code)) throw preferences.error;
            const hidden = new Map((preferences.data || []).map(p => [p.conversation_id, p.hidden_at]));
            const result = await client.from('messages').select('id', { count: 'exact', head: true })
                .in('conversation_id', ids.filter(id => !hidden.has(id))).neq('sender_id', userId).eq('is_read', false);
            if (result.error) throw new AccountError(503, 'Не удалось загрузить сообщения / Xabarlarni yuklab bo‘lmadi');
            total += result.count || 0;
            // Archive hides existing unread messages without falsely marking them read.
            for (const [conversationId, hiddenAt] of Array.from(hidden.entries())) {
                const revived = await client.from('messages').select('id', { count: 'exact', head: true })
                    .eq('conversation_id', conversationId).neq('sender_id', userId).eq('is_read', false).gt('created_at', hiddenAt);
                if (revived.error) throw revived.error;
                total += revived.count || 0;
            }
        }
        if (!data || data.length < 200) break;
    }
    return total;
}

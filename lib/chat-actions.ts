import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountError } from './auth/account';
import type { ChatRole } from './account-chat';
export async function chatAction(client: SupabaseClient,user: { id: string;session_version?: number },role: ChatRole,action: 'open' | 'inspect' | 'send' | 'read' | 'archive' | 'restore',fields: { conversationId?: string;partnerId?: string;requestId?: string;content?: string;through?: string } = {}) {
  const epoch = user.session_version ?? 0;
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new AccountError(401,'Войдите повторно / Qayta kiring');
  const { data,error } = await client.rpc('ishdasiz_chat_action',{ p_user_id: user.id,p_session_version: epoch,p_role: role,p_action: action,
    p_conversation_id: fields.conversationId || null,p_partner_id: fields.partnerId || null,p_request_id: fields.requestId || null,p_content: fields.content ?? null,p_through: fields.through || null }).abortSignal(AbortSignal.timeout(15000));
  if (error) {
    if (error.code === '42501') throw new AccountError(401,'Войдите повторно / Qayta kiring');
    if (error.code === '28000') throw new AccountError(403,'Откройте чат в соответствующем профиле / Mos profilda chatni oching');
    if (error.code === 'P0002') throw new AccountError(404,'Чат недоступен / Chat mavjud emas');
    if (error.code === 'P0001') throw new AccountError(423,'Собеседник временно недоступен / Suhbatdosh vaqtincha mavjud emas');
    if (error.code === '40001') throw new AccountError(409,'Данные изменились. Проверьте сообщение / Ma’lumotlar o‘zgardi. Xabarni tekshiring');
    if (error.code === '22023') throw new AccountError(400,'Некорректное действие / Noto‘g‘ri amal');
    throw new AccountError(503,'Не удалось выполнить действие. Попробуйте ещё раз / Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AccountError(503,'Чат временно недоступен / Chat vaqtincha mavjud emas');
  return data;
}

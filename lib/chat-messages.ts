export interface ChatMessage { id: string;content: string;sender_id: string;created_at: string }
// Preserve the database's microseconds while comparing different ISO timezone offsets.
export function chatTimestamp(value: string) {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return value;
  const fraction = value.match(/\.(\d{1,6})(?:Z|[+-]\d{2}:?\d{2})$/i)?.[1] || '';
  return new Date(millis).toISOString().replace(/Z$/,fraction.padEnd(6,'0').slice(3)+'Z');
}
export function orderChatMessages(rows: ChatMessage[]) {
  return Array.from(new Map(rows.map(message => [message.id,message])).values()).sort((a,b) => chatTimestamp(a.created_at).localeCompare(chatTimestamp(b.created_at)) || a.id.localeCompare(b.id));
}

import { AccountError } from './auth/account';
import { interviewFromLocal } from './interview-time';
export type ApplicationDecisionDetails = { interview_date?: string | null; interview_address?: string | null; employer_phone?: string | null; employer_message?: string | null; rejection_reason?: string | null };
export function applicationDecisionDetails(value: unknown,status: string): ApplicationDecisionDetails {
  const invalid = () => new AccountError(400,'Проверьте дату и сообщение / Sana va xabarni tekshiring');
  if (value === undefined) value = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const result: Record<string,string | null> = {},limits: Record<string,number> = { interview_date: 64,interview_address: 1000,employer_phone: 40,employer_message: 4000,rejection_reason: 4000 };
  for (const [key,item] of Object.entries(value)) {
    if (!Object.prototype.hasOwnProperty.call(limits,key) || item !== null && typeof item !== 'string' || typeof item === 'string' && item.length > limits[key]) throw invalid();
    result[key] = typeof item === 'string' ? item.trim() || null : null;
  }
  if (result.interview_date && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(result.interview_date) || !Number.isFinite(Date.parse(result.interview_date)) || !interviewFromLocal(result.interview_date.slice(0,16)))) throw invalid();
  if (status === 'interview_set' && !result.interview_date) throw invalid();
  return result;
}

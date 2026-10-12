import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountError, isUuid } from './auth/account';
import { employerJobScope } from './account-jobs';
import { APPLICATION_STATUSES, type ApplicationStatus } from './application-status';
import type { ChatRole } from './account-chat';
import type { AccountApplication, ApplicationStats } from './application-api';

const JOB_FIELDS = 'id,title_uz,title_ru,company_name,salary_min,salary_max,employer_id,user_id,created_by,regions(name_uz,name_ru),districts(name_uz,name_ru)';
const ROOT_FIELDS = 'id,job_id,user_id,full_name,phone,email,message,status,created_at,viewed_at,responded_at,is_seen_by_job_seeker,resume_id,interview_date,interview_address,employer_phone,employer_message,rejection_reason';
const RESUME_FIELDS = 'resumes(id,user_id,status,title,full_name,about,skills,experience)';
export const APPLICATION_STATUS_ALIASES: Record<ApplicationStatus, string[]> = {
  pending: ['pending'], reviewed: ['reviewed', 'viewed'],
  interview_set: ['interview_set', 'invited', 'interview', 'interviewed'], accepted: ['accepted'], rejected: ['rejected'], hired: ['hired'],
};
const relation = (value: any) => Array.isArray(value) ? value[0] || null : value || null;

export function applicationQuery(client: SupabaseClient, userId: string, role: ChatRole, profileId: string, options: { head?: boolean; detail?: boolean } = {}) {
  const fields = options.head ? 'id' : options.detail === false ? 'id,user_id,created_at,status,responded_at,is_seen_by_job_seeker,viewed_at' : `${ROOT_FIELDS},${RESUME_FIELDS}`;
  const clause: string = `${fields},jobs${role === 'employer' ? '!inner' : ''}(${options.head ? 'id' : JOB_FIELDS})`;
  let query = client.from('job_applications').select(clause, options.head ? { count: 'exact', head: true } : {});
  if (role === 'employer') query = query.or(employerJobScope(userId, profileId), { referencedTable: 'jobs' });
  else query = query.eq('user_id', userId);
  return query;
}

export async function requireApplication(client: SupabaseClient, userId: string, role: ChatRole, profileId: string, id: unknown) {
  if (!isUuid(id)) throw new AccountError(404, 'Отклик недоступен / Ariza mavjud emas');
  const result = await applicationQuery(client, userId, role, profileId).eq('id', id).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new AccountError(404, 'Отклик недоступен / Ariza mavjud emas');
  return result.data as any;
}

export function publicApplication(row: any, role: ChatRole): AccountApplication {
  const job = relation(row.jobs), resume = relation(row.resumes);
  // A forged old link must never reveal somebody else's private or draft resume.
  const permittedResume = resume && row.user_id && resume.user_id === row.user_id && (role === 'job_seeker' || resume.status === 'active');
  const result: any = {};
  for (const key of ROOT_FIELDS.split(',')) if (key !== 'user_id') result[key] = row[key] ?? null;
  result.is_seen_by_job_seeker = row.is_seen_by_job_seeker === true;
  result.jobs = job ? { id: job.id, title_uz: job.title_uz, title_ru: job.title_ru, company_name: job.company_name,
    salary_min: job.salary_min, salary_max: job.salary_max, regions: relation(job.regions), districts: relation(job.districts) } : null;
  result.resumes = permittedResume ? { id: resume.id, title: resume.title, full_name: resume.full_name, about: resume.about,
    skills: Array.isArray(resume.skills) ? resume.skills.filter((s: unknown) => typeof s === 'string') : [],
    experience: Array.isArray(resume.experience) ? resume.experience : [] } : null;
  if (!permittedResume) result.resume_id = null;
  return result;
}

export function filterApplications(query: any, status: string) {
  if (status === 'all') return query;
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) throw new AccountError(400, 'Некорректный статус / Noto‘g‘ri holat');
  return query.in('status', APPLICATION_STATUS_ALIASES[status as ApplicationStatus]);
}
export async function applicationStats(client: SupabaseClient, userId: string, role: ChatRole, profileId: string): Promise<ApplicationStats> {
  const keys = ['total', ...APPLICATION_STATUSES] as const;
  const results = await Promise.all(keys.map(key => {
    const query = applicationQuery(client, userId, role, profileId, { head: true });
    return key === 'total' ? query : filterApplications(query, key);
  }));
  const stats: any = {};
  for (let index = 0; index <keys.length; index++) {
    if (results[index].error) throw results[index].error;
    stats[keys[index]] = results[index].count || 0;
  }
  return stats;
}

export function validApplicationVersion(value: any) {
  const status = value?.status;
  const responded = value?.responded_at;
  return (status === null || typeof status === 'string' && /^[a-z_]{1,30}$/i.test(status))
    && (responded === null || typeof responded === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(responded) && Number.isFinite(Date.parse(responded)));
}
export function sameApplicationVersion(first: any, second: any) {
  return first.status === second.status && (first.responded_at || null) === (second.responded_at || null);
}
export function constrainApplicationVersion(query: any, row: any) {
  query = row.status == null ? query.is('status', null) : query.eq('status', row.status);
  return row.responded_at == null ? query.is('responded_at', null) : query.eq('responded_at', row.responded_at);
}
export function applicationVersionFilter(row: any) {
  return `and(id.eq.${row.id},status.${row.status === null ? 'is.null' : `eq.${row.status}`},responded_at.${row.responded_at === null ? 'is.null' : `eq.${row.responded_at}`})`;
}

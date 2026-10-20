import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountError, isUuid } from './auth/account';
import { expandExperienceFilterValues, normalizeExperienceCode } from './experience-compat';
import { resumeSkills } from './resume-api';

const PAGE_SIZE = 24;
const SCAN_SIZE = 500;
export const RESUME_CARD_FIELDS = 'id,title,full_name,city,region_id,district_id,experience,experience_years,skills,expected_salary_min,expected_salary_max,created_at,regions(name_uz,name_ru),districts(name_uz,name_ru)';
type Cursor = { date: string; id: string };
export type ResumeCatalogFilters = { q: string; category: string | null; region: number | null; district: number | null; experience: string[] | null; education: string | null; gender: string | null; min: number; max: number; before: Cursor | null };
const invalid = (): never => { throw new AccountError(400, 'Проверьте параметры поиска / Qidiruv parametrlarini tekshiring'); };
export function catalogFilters(params: URLSearchParams): ResumeCatalogFilters {
  const value = (name: string) => { const text = params.get(name); return !text || text === 'all' ? null : text; };
  const number = (name: string) => { const text = value(name); if (text === null) return null; if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) <= 0 || Number(text) > 2147483647) return invalid(); return Number(text); };
  const option = (name: string, choices: string[]) => { const text = value(name); if (text && !choices.includes(text)) return invalid(); return text; };
  const q = (params.get('q') || '').trim(); if (q.length > 150) invalid();
  const category = value('category'); if (category && !isUuid(category)) invalid();
  const experience = value('experience'); if (experience && !normalizeExperienceCode(experience)) invalid();
  let min = 0, max = 20000000;
  const salary = value('salary');
  if (salary) { if (!/^\d+-\d+$/.test(salary)) invalid(); [min, max] = salary.split('-').map(Number); if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max || max > 20000000) invalid(); }
  let before: Cursor | null = null;
  const token = value('before');
  if (token) {
    try {
      if (token.length > 250 || !/^[A-Za-z0-9_-]+$/.test(token)) invalid();
      const parsed = JSON.parse(Buffer.from(token, 'base64url').toString());
      if (!isUuid(parsed.id) || typeof parsed.date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(parsed.date) || !Number.isFinite(Date.parse(parsed.date))) invalid();
      before = { date: parsed.date, id: parsed.id };
    } catch { invalid(); }
  }
  return { q, category, region: number('region'), district: number('district'), experience: experience ? expandExperienceFilterValues(experience) : null,
    education: option('education', ['any', 'secondary', 'vocational', 'higher', 'master']), gender: option('gender', ['any', 'male', 'female']), min, max, before };
}
function cursor(row: any) {
  return Buffer.from(JSON.stringify({ date: row.created_at, id: row.id })).toString('base64url');
}
export function publicResumeCard(row: any) {
  // The public response deliberately omits contacts, birthday, owner and work history.
  const keys = ['id', 'title', 'full_name', 'city', 'region_id', 'district_id', 'experience', 'experience_years', 'expected_salary_min', 'expected_salary_max', 'created_at'];
  const place = (value: any) => value && typeof value === 'object' && !Array.isArray(value) ? { name_uz: value.name_uz || '', name_ru: value.name_ru || '' } : null;
  return { ...Object.fromEntries(keys.map(key => [key, row[key] ?? null])), skills: resumeSkills(row.skills), regions: place(row.regions), districts: place(row.districts) };
}
export async function searchResumes(client: SupabaseClient, filters: ResumeCatalogFilters, signal?: AbortSignal) {
  const rpc = client.rpc('ishdasiz_public_resume_search', { p_query: filters.q, p_category: filters.category, p_region: filters.region, p_district: filters.district,
    p_experience: filters.experience, p_education: filters.education, p_gender: filters.gender, p_salary_min: filters.min, p_salary_max: filters.max,
    p_before_created: filters.before?.date || null, p_before_id: filters.before?.id || null, p_page_size: PAGE_SIZE });
  const result = await (signal ? rpc.abortSignal(signal) : rpc);
  if (!result.error) {
    const rows = (result.data || []).map((row: any) => row.card);
    const page = rows.slice(0, PAGE_SIZE);
    return { resumes: page.map(publicResumeCard), nextCursor: rows.length > PAGE_SIZE ? cursor(page.at(-1)) : null };
  }
  // Older databases keep working until the additive search function is installed.
  if (!['PGRST202', '42883'].includes(result.error.code) || !result.error.message?.includes('ishdasiz_public_resume_search')) throw result.error;
  let query = client.from('resumes').select(`${RESUME_CARD_FIELDS}${filters.q ? ',about' : ''}`).eq('ishdasiz_resume_available', true).eq('is_public', true).eq('status', 'active');
  if (filters.category) query = query.eq('category_id', filters.category);
  if (filters.region) query = query.eq('region_id', filters.region);
  if (filters.district) query = query.eq('district_id', filters.district);
  if (filters.education) query = query.eq('education_level', filters.education);
  if (filters.gender) query = query.eq('gender', filters.gender);
  if (filters.min > 0) query = query.or(`expected_salary_max.is.null,expected_salary_max.gte.${filters.min}`);
  if (filters.max < 20000000) query = query.or(`expected_salary_min.is.null,expected_salary_min.lte.${filters.max}`);
  if (filters.before) query = query.or(`created_at.lt.${filters.before.date},and(created_at.eq.${filters.before.date},id.lt.${filters.before.id})`);
  // Historic schemas store experience as either text or a JSONB string.
  const scan = Boolean(filters.q || filters.experience);
  query = query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(scan ? SCAN_SIZE + 1 : PAGE_SIZE + 1);
  const fallback = await (signal ? query.abortSignal(signal) : query);
  if (fallback.error) throw fallback.error;
  const batch: any[] = (fallback.data || []).slice(0, scan ? SCAN_SIZE : PAGE_SIZE + 1);
  const needle = filters.q.toLowerCase();
  const matches = batch.filter(row => (!filters.experience || filters.experience.includes(String(row.experience).trim().toLowerCase()))
    && (!needle || [row.title, row.full_name, row.about, ...resumeSkills(row.skills)].some(value => typeof value === 'string' && value.toLowerCase().includes(needle))));
  const page = matches.slice(0, PAGE_SIZE);
  const nextCursor = matches.length > PAGE_SIZE ? cursor(page.at(-1)) : scan && (fallback.data?.length || 0) > SCAN_SIZE ? cursor(batch.at(-1)) : null;
  return { resumes: page.map(publicResumeCard), nextCursor };
}

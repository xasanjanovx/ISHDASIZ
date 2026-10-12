import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountError, isUuid } from './auth/account';
import { normalizePhone } from './auth/server';
import { resumeLanguages } from './resume-languages';

export const RESUME_FIELDS = 'id,title,full_name,birth_date,phone,city,region_id,district_id,category_id,employment_type,experience,experience_years,education_level,gender,about,skills,experience_details,education,languages,expected_salary_min,expected_salary_max,is_public,status,created_at,updated_at';
export async function resumeFeatures(client: SupabaseClient) {
  const probe = await client.from('resumes').select('found_job,found_job_at').limit(0);
  if (probe.error?.code === '42703' && /resumes\.(found_job|found_job_at)/.test(probe.error.message)) return false;
  if (probe.error) throw probe.error;
  return true;
}
export const resumeFields = (features: boolean, list = false) => `${RESUME_FIELDS}${features ? ',found_job,found_job_at' : ''}${list ? ',regions(name_uz,name_ru),districts(name_uz,name_ru)' : ''}`;
export const ownResumeResult = (data: any, features: boolean) => ({ ...data, languages: resumeLanguages(data.languages), found_job: features && data.found_job === true, found_job_at: features ? data.found_job_at || null : null, supports_found_job: features });
export async function resumeStoragePayload(client: SupabaseClient, data: any) {
  const probe = await client.from('resumes').select('languages::jsonb').limit(0);
  if (probe.error?.code === '42846' && probe.error.message.includes('text[]')) return { ...data, languages: data.languages.map((row: any) => JSON.stringify(row)) };
  if (probe.error) throw probe.error;
  return data;
}
const invalid = (ru: string, uz: string): never => { throw new AccountError(400, `${ru} / ${uz}`); };
function text(value: unknown, limit: number, required = false): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > limit || required && !value.trim()) invalid('Проверьте текстовые поля и их длину', 'Matn maydonlari va uzunligini tekshiring');
  return (value as string).trim();
}
function option(value: unknown, choices: string[], fallback: string) {
  const key = value == null ? fallback : value;
  if (typeof key !== 'string' || !choices.includes(key)) invalid('Некорректный вариант в форме', 'Formadagi variant noto‘g‘ri');
  return key as string;
}
function number(value: unknown, max = 2147483647): number | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) invalid('Число должно быть целым и неотрицательным', 'Son butun va manfiy bo‘lmasligi kerak');
  return value as number;
}
function items(value: unknown, max: number): any[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max || value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) invalid('Проверьте список опыта, образования или языков', 'Tajriba, ta’lim yoki tillar ro‘yxatini tekshiring');
  return value as any[];
}
function month(value: unknown) {
  const result = text(value, 7);
  if (result && !/^\d{4}(?:-(0[1-9]|1[0-2]))?$/.test(result)) invalid('Проверьте даты работы', 'Ish sanalarini tekshiring');
  return result;
}
function year(value: unknown): number | null {
  if (value === '' || value == null || value === 0 || value === '0') return null;
  if (typeof value === 'string' && /^\d{4}$/.test(value)) value = Number(value);
  const result = number(value, new Date().getFullYear() + 10);
  if (result !== null && result < 1900) invalid('Проверьте годы образования', 'Ta’lim yillarini tekshiring');
  return result;
}
export function validResumeVersion(value: unknown) {
  return value === null || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
export async function ownResume(client: SupabaseClient, userId: string, id: unknown, features?: boolean) {
  if (!isUuid(id)) throw new AccountError(404, 'Резюме недоступно / Rezyume mavjud emas');
  features ??= await resumeFeatures(client);
  const result = await client.from('resumes').select(resumeFields(features)).eq('id', id).eq('user_id', userId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new AccountError(404, 'Резюме недоступно / Rezyume mavjud emas');
  return ownResumeResult(result.data, features);
}
export async function resumeInput(client: SupabaseClient, body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Некорректная форма', 'Forma noto‘g‘ri');
  const status = option(body.status, ['active', 'draft'], 'active'), active = status === 'active';
  const title = text(body.title, 255, active) || 'Резюме / Rezyume', full_name = text(body.full_name, 255, active), about = text(body.about, 10000, active);
  const rawPhone = text(body.phone, 25, active), phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) invalid('Введите телефон +998 и 9 цифр', '+998 va 9 raqamli telefon kiriting');
  const birth_date = text(body.birth_date, 10) || null;
  if (birth_date && (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date) || !Number.isFinite(Date.parse(birth_date)) || new Date(birth_date).toISOString().slice(0, 10) !== birth_date || birth_date < '1900-01-01' || birth_date > new Date().toISOString().slice(0, 10))) invalid('Проверьте дату рождения', 'Tug‘ilgan sanani tekshiring');
  if (active && !birth_date) invalid('Укажите дату рождения', 'Tug‘ilgan sanani kiriting');
  const district_id = number(body.district_id), region_id = number(body.region_id);
  if (active && !district_id) invalid('Выберите район', 'Tumanni tanlang');
  const category_id = body.category_id || null;
  if (category_id !== null && !isUuid(category_id)) invalid('Выберите профессию', 'Kasbni tanlang');
  if (active && !category_id) invalid('Выберите профессию', 'Kasbni tanlang');
  const experience = option(body.experience, ['no_experience', '1_year', '3_years', '5_years', '10_years', '1', '2', '3', '4', '5'], 'no_experience');
  const education_level = option(body.education_level, ['any', 'secondary', 'vocational', 'higher', 'master'], 'secondary');
  const employment_type = option(body.employment_type, ['full_time', 'part_time', 'contract', 'internship', 'remote'], 'full_time');
  const gender = option(body.gender, ['any', 'male', 'female'], 'any');
  const expected_salary_min = number(body.expected_salary_min), expected_salary_max = number(body.expected_salary_max);
  if (expected_salary_min !== null && expected_salary_max !== null && expected_salary_min > expected_salary_max) invalid('Минимальная зарплата выше максимальной', 'Eng kam maosh eng ko‘p maoshdan yuqori');
  if (body.is_public != null && typeof body.is_public !== 'boolean') invalid('Проверьте видимость резюме', 'Rezyume ko‘rinishini tekshiring');
  if (body.skills != null && (!Array.isArray(body.skills) || body.skills.length > 100)) invalid('Не более 100 навыков', '100 tadan ortiq ko‘nikma bo‘lmasin');
  const skills = Array.from(new Set((body.skills || []).map((value: unknown) => text(value, 100, true))));
  const experience_details = items(body.experience_details, 30).map(row => {
    const is_current = row.is_current === true || row.end_date === 'current';
    const start_date = month(row.start_date), end_date = is_current ? '' : month(row.end_date);
    if (start_date && end_date && start_date > end_date) invalid('Начало работы позже окончания', 'Ish boshlanishi tugashidan keyin');
    return { company: text(row.company, 255, active), position: text(row.position, 255, active), start_date, end_date, is_current, description: text(row.description, 5000) };
  });
  const education = items(body.education, 30).map(row => {
    const start_year = year(row.start_year), end_year = row.end_year === 'current' ? null : year(row.end_year);
    if (start_year && end_year && start_year > end_year) invalid('Начало обучения позже окончания', 'Ta’lim boshlanishi tugashidan keyin');
    return { institution: text(row.institution, 255, active), degree: text(row.degree, 255), field: text(row.field, 255, active), start_year, end_year };
  });
  const languages = items(body.languages, 20).map(row => ({ name: option(row.name, ['uzbek', 'russian', 'english', 'korean', 'chinese', 'german'], 'uzbek'), level: option(row.level, ['unspecified', 'beginner', 'intermediate', 'advanced', 'native'], 'unspecified') }));
  if (active && !['no_experience', '1'].includes(experience) && !experience_details.length) invalid('Добавьте место работы', 'Ish joyini qo‘shing');
  if (active && ['higher', 'master'].includes(education_level) && !education.length) invalid('Добавьте образование', 'Ta’limni qo‘shing');
  const [district, region, category] = await Promise.all([
    district_id ? client.from('districts').select('id,region_id,name_uz').eq('id', district_id).maybeSingle() : { data: null, error: null },
    region_id ? client.from('regions').select('id').eq('id', region_id).maybeSingle() : { data: null, error: null },
    category_id ? client.from('categories').select('id').eq('id', category_id).maybeSingle() : { data: null, error: null },
  ]);
  if (district.error || region.error || category.error) throw new AccountError(503, 'Не удалось проверить справочники / Ma’lumotnomalarni tekshirib bo‘lmadi');
  if (district_id && !district.data || region_id && !region.data || category_id && !category.data || district.data && region_id && district.data.region_id !== region_id) invalid('Проверьте регион, район и профессию', 'Viloyat, tuman va kasbni tekshiring');
  const experience_years = ({ no_experience: 0, '1_year': 1, '3_years': 3, '5_years': 5, '10_years': 10, '1': 0, '2': 1, '3': 3, '4': 5, '5': 10 } as Record<string, number>)[experience];
  return { title, full_name, birth_date, phone, about, category_id, region_id: district.data?.region_id || region_id, district_id, city: district.data?.name_uz || '',
    experience, experience_years, experience_details, education_level, education, languages, skills, employment_type, gender,
    expected_salary_min, expected_salary_max, status, is_public: active && (body.is_public ?? true) };
}

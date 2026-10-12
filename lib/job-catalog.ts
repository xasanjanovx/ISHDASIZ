import type { SupabaseClient } from '@supabase/supabase-js';
import { parseAgeRange, parseSalaryRange } from './search-ranges';
import { expandExperienceFilterValues, normalizeExperienceCode } from './experience-compat';

export const JOB_PAGE_SIZE = 12;
export const JOB_CATALOG_FIELDS = 'id,title_uz,title_ru,description_uz,description_ru,requirements_uz,requirements_ru,company_name,salary_min,salary_max,employment_type,created_at,region_id,district_id,views_count,payment_type,work_mode,is_for_students,is_for_graduates,is_for_disabled,is_for_women,categories(id,name_uz,name_ru,icon),regions(name_uz,name_ru),districts(name_uz,name_ru)';
export type JobFiltersState = {
  q: string; category: string; region: string; district: string; special: string[];
  salary: [number, number]; age: [number | undefined, number | undefined];
  type: string; experience: string; education: string; gender: string;
  payment_type: string; work_mode: string; working_days: string; page: number;
};
export function readJobFilters(query: string): JobFiltersState {
  const params = new URLSearchParams(query);
  const option = (key: string, choices: string[]) => choices.includes(params.get(key) || '') ? params.get(key)! : 'all';
  const number = (key: string) => /^\d+$/.test(params.get(key) || '') && Number(params.get(key)) > 0 && Number(params.get(key)) <= 2147483647 ? String(Number(params.get(key))) : 'all';
  const category = params.get('category') || '';
  const page = Number(params.get('page') || 1);
  return {
    q: (params.get('q') || '').slice(0, 150),
    category: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category) ? category : 'all',
    region: number('region'), district: number('district'),
    special: ['students', 'graduates', 'disabled', 'women'].filter(value => (params.get('special') || '').split(',').includes(value)),
    salary: parseSalaryRange(params.get('salary')), age: parseAgeRange(params.get('age')),
    type: option('type', ['full_time', 'part_time', 'contract', 'internship', 'remote', 'freelance']),
    experience: normalizeExperienceCode(params.get('experience')) ? params.get('experience')! : 'all',
    education: option('education', ['any', 'secondary', 'vocational', 'higher', 'master']),
    gender: option('gender', ['any', 'male', 'female', '1', '2', '3']),
    payment_type: option('payment_type', ['1', '2', '3', '4']), work_mode: option('work_mode', ['onsite', 'remote', 'hybrid']), working_days: option('working_days', ['1', '2']),
    page: Number.isSafeInteger(page) && page > 0 && page <= 1000000 ? page : 1,
  };
}
export function encodeJobFilters(filters: JobFiltersState) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  for (const key of ['category', 'region', 'district', 'type', 'experience', 'education', 'gender', 'payment_type', 'work_mode', 'working_days'] as const)
    if (filters[key] !== 'all') params.set(key, filters[key]);
  if (filters.special.length) params.set('special', filters.special.join(','));
  if (filters.salary[0] !== 0 || filters.salary[1] !== 20000000) params.set('salary', filters.salary.join('-'));
  if (filters.age.some(value => value !== undefined)) params.set('age', filters.age.map(value => value ?? '').join('-'));
  if (filters.page !== 1) params.set('page', String(filters.page));
  return params.toString();
}
export function jobCatalogQuery(client: SupabaseClient, filters: JobFiltersState) {
  let query = client.from('jobs').select(JOB_CATALOG_FIELDS, { count: 'exact' }).eq('ishdasiz_job_available', true);
  const clauses: string[] = [];
  const anyGender = 'gender.eq.any,gender.eq.3,gender.is.null';
  const gender = { male: `gender.eq.male,gender.eq.1,${anyGender}`, female: `gender.eq.female,gender.eq.2,${anyGender}`, any: anyGender };
  if (filters.special.includes('students')) clauses.push('or(is_for_students.eq.true,is_for_graduates.eq.true)');
  if (filters.special.includes('graduates')) query = query.eq('is_for_graduates', true);
  if (filters.special.includes('disabled')) query = query.eq('is_for_disabled', true);
  if (filters.special.includes('women')) clauses.push(`or(is_for_women.eq.true,${gender.female})`);
  for (const [key, field] of [['category', 'category_id'], ['education', 'education_level'], ['working_days', 'working_days']] as const)
    if (filters[key] !== 'all') query = query.eq(field, filters[key]);
  const location = [['region', 'region_id'], ['district', 'district_id']].filter(([key]) => filters[key as 'region' | 'district'] !== 'all').map(([key, field]) => field + '.eq.' + filters[key as 'region' | 'district']);
  if (location.length) clauses.push('or(' + (location.length > 1 ? 'and(' + location.join(',') + ')' : location[0]) + ',ishdasiz_job_work_mode.eq.remote)');
  if (filters.type === 'remote') query = query.eq('ishdasiz_job_work_mode', 'remote');
  else if (filters.type !== 'all') query = query.eq('employment_type', filters.type);
  if (filters.work_mode !== 'all') query = query.eq('ishdasiz_job_work_mode', filters.work_mode);
  if (filters.experience !== 'all') query = query.in('experience', expandExperienceFilterValues(filters.experience));
  if (filters.payment_type !== 'all') query = query.eq('payment_type', Number(filters.payment_type));
  const selectedGender = ({ '1': 'male', '2': 'female', '3': 'any' } as Record<string, string>)[filters.gender] || filters.gender;
  if (selectedGender in gender) clauses.push(`or(${gender[selectedGender as keyof typeof gender]})`);
  if (filters.age[0] !== undefined) clauses.push(`or(age_max.gte.${filters.age[0]},age_max.is.null)`);
  if (filters.age[1] !== undefined) clauses.push(`or(age_min.lte.${filters.age[1]},age_min.is.null)`);
  if (filters.salary[0] > 0) clauses.push(`or(salary_max.gte.${filters.salary[0]},salary_max.is.null)`);
  if (filters.salary[1] < 20000000) clauses.push(`or(salary_min.lte.${filters.salary[1]},salary_min.is.null)`);
  const needle = filters.q.trim().toLowerCase().replace(/[,().%_*"\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (needle) clauses.push(`or(title_uz.ilike.%${needle}%,title_ru.ilike.%${needle}%,description_uz.ilike.%${needle}%,description_ru.ilike.%${needle}%,company_name.ilike.%${needle}%)`);
  // A single explicit AND keeps every optional OR group together.
  if (clauses.length) query = query.or(`and(${clauses.join(',')})`);
  const offset = (filters.page - 1) * JOB_PAGE_SIZE;
  return query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + JOB_PAGE_SIZE - 1);
}

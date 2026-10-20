import type { SupabaseClient } from '@supabase/supabase-js';
import { parseAgeRange, parseJobSalaryRange, type JobSalaryRange } from './search-ranges';
import { expandExperienceFilterValues, normalizeExperienceCode } from './experience-compat';
import { expandEducationFilterValues, normalizeEducationFilter } from './education-compat';

export const JOB_PAGE_SIZE = 12;
export const JOB_CATALOG_FIELDS = 'id,title_uz,title_ru,description_uz,description_ru,requirements_uz,requirements_ru,company_name,salary_min,salary_max,employment_type,created_at,region_id,district_id,views_count,payment_type,work_mode,is_for_students,is_for_graduates,is_for_disabled,is_for_women,categories(id,name_uz,name_ru,icon),regions(name_uz,name_ru),districts(name_uz,name_ru)';
export type JobFiltersState = {
  q: string; category: string; region: string; district: string; special: string[];
  salary: JobSalaryRange; age: [number | undefined, number | undefined];
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
    salary: parseJobSalaryRange(params.get('salary')), age: parseAgeRange(params.get('age')),
    type: option('type', ['full_time', 'part_time', 'contract', 'internship', 'remote', 'freelance']),
    experience: normalizeExperienceCode(params.get('experience')) ? params.get('experience')! : 'all',
    education: normalizeEducationFilter(params.get('education')),
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
  if (filters.salary[0] !== 0 || filters.salary[1] !== undefined) params.set('salary', filters.salary.join('-'));
  if (filters.age.some(value => value !== undefined)) params.set('age', filters.age.map(value => value ?? '').join('-'));
  if (filters.page !== 1) params.set('page', String(filters.page));
  return params.toString();
}
export function jobCatalogQuery(client: SupabaseClient, filters: JobFiltersState, options: { remoteIds?: string[]; count?: 'exact' | 'none' | 'only'; salaryBranch?: 'min' | 'max' } = {}) {
  let query = client.from('jobs').select(options.count === 'only' ? 'id' : JOB_CATALOG_FIELDS, { count: options.count === 'none' ? undefined : 'exact' }).eq('is_active', true).eq('ishdasiz_job_available', true);
  const clauses: string[] = [];
  const anyGender = 'gender.eq.any,gender.eq.3,gender.is.null';
  const gender = { male: `gender.eq.male,gender.eq.1,${anyGender}`, female: `gender.eq.female,gender.eq.2,${anyGender}`, any: anyGender };
  if (filters.special.includes('students')) clauses.push('or(is_for_students.eq.true,is_for_graduates.eq.true)');
  if (filters.special.includes('graduates')) query = query.eq('is_for_graduates', true);
  if (filters.special.includes('disabled')) query = query.eq('is_for_disabled', true);
  if (filters.special.includes('women')) clauses.push(`or(is_for_women.eq.true,${gender.female})`);
  for (const [key, field] of [['category', 'category_id'], ['working_days', 'working_days']] as const)
    if (filters[key] !== 'all') query = query.eq(field, filters[key]);
  if (filters.education !== 'all') query = query.in('education_level', expandEducationFilterValues(filters.education));
  const location = [['region', 'region_id'], ['district', 'district_id']].filter(([key]) => filters[key as 'region' | 'district'] !== 'all').map(([key, field]) => field + '.eq.' + filters[key as 'region' | 'district']);
  const remoteIds = options.remoteIds;
  const remoteClause = remoteIds === undefined ? 'ishdasiz_job_work_mode.eq.remote'
    : remoteIds.length ? `id.in.(${remoteIds.join(',')})` : null;
  if (location.length) clauses.push('or(' + (location.length > 1 ? 'and(' + location.join(',') + ')' : location[0]) + (remoteClause ? ',' + remoteClause : '') + ')');
  if (filters.type === 'remote') query = remoteIds === undefined ? query.eq('ishdasiz_job_work_mode', 'remote') : query.in('id', remoteIds);
  else if (filters.type !== 'all') query = query.eq('employment_type', filters.type);
  if (filters.work_mode !== 'all') query = filters.work_mode === 'remote' && remoteIds !== undefined
    ? query.in('id', remoteIds) : query.eq('ishdasiz_job_work_mode', filters.work_mode);
  if (filters.experience !== 'all') query = query.in('experience', expandExperienceFilterValues(filters.experience));
  if (filters.payment_type !== 'all') query = query.eq('payment_type', Number(filters.payment_type));
  const selectedGender = ({ '1': 'male', '2': 'female', '3': 'any' } as Record<string, string>)[filters.gender] || filters.gender;
  if (selectedGender in gender) clauses.push(`or(${gender[selectedGender as keyof typeof gender]})`);
  if (filters.age[0] !== undefined) clauses.push(`or(age_max.gte.${filters.age[0]},age_max.is.null)`);
  if (filters.age[1] !== undefined) clauses.push(`or(age_min.lte.${filters.age[1]},age_min.is.null)`);
  const [minimum, maximum] = filters.salary;
  if (minimum > 0) {
    if (options.salaryBranch === 'min') query = query.gte('salary_min', minimum);
    else if (options.salaryBranch === 'max') {
      query = query.gte('salary_max', minimum);
      clauses.push(`or(salary_min.lt.${minimum},salary_min.is.null)`);
    } else clauses.push(`or(salary_min.gte.${minimum},salary_max.gte.${minimum})`);
  }
  if (maximum !== undefined) {
    if (minimum === 0 && options.salaryBranch === 'min') query = query.gt('salary_min', 0).lte('salary_min', maximum);
    else if (minimum === 0 && options.salaryBranch === 'max') {
      query = query.gt('salary_max', 0).lte('salary_max', maximum);
      clauses.push(`or(salary_min.is.null,salary_min.lte.0,salary_min.gt.${maximum})`);
    } else clauses.push(`or(and(salary_min.gt.0,salary_min.lte.${maximum}),and(salary_max.gt.0,salary_max.lte.${maximum}))`);
  }
  const needle = filters.q.trim().toLowerCase().replace(/[,().%_*"\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (needle) clauses.push(`or(title_uz.ilike.%${needle}%,title_ru.ilike.%${needle}%,description_uz.ilike.%${needle}%,description_ru.ilike.%${needle}%,company_name.ilike.%${needle}%)`);
  // A single explicit AND keeps every optional OR group together.
  if (clauses.length) query = query.or(clauses.length === 1 && clauses[0].startsWith('or(') ? clauses[0].slice(3, -1) : `and(${clauses.join(',')})`);
  // limit=0 skips finding/serializing a payload row; Content-Range still returns
  // the exact filtered total, independently of the requested page and sorting.
  if (options.count === 'only') return query.limit(0);
  const offset = (filters.page - 1) * JOB_PAGE_SIZE;
  return query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + JOB_PAGE_SIZE - 1);
}

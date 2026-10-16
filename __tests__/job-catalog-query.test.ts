/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { encodeJobFilters, readJobFilters, jobCatalogQuery, JOB_CATALOG_FIELDS } from '@/lib/job-catalog';
const category = '10000000-0000-4000-8000-000000000001';
let requests: URL[];
function client() {
  return createClient('https://example.supabase.co', 'synthetic-anon-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input: any) => {
    requests.push(new URL(String(input))); return new Response('[]', { headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' } });
  } } });
}
beforeEach(() => { requests = []; });
test('all supported filters, including a shared page number, survive URL serialization', () => {
  const filters = readJobFilters(`q=Бухгалтер&category=${category}&region=22&district=100&special=women,students&salary=1000000-5000000&age=18-30&type=remote&experience=2&education=higher&gender=2&payment_type=3&work_mode=hybrid&working_days=2&page=3`);
  expect(readJobFilters(encodeJobFilters(filters))).toEqual(filters);
  expect(filters.special).toEqual(['students', 'women']); expect(filters.page).toBe(3);
});
test('invalid URL values cannot become NaN comparisons, unsupported choices or arbitrary filter syntax', () => {
  const filters = readJobFilters('category=forged&region=22,or&district=-1&age=30-18&salary=500-2&type=unknown&experience=wrong&gender=forged&special=unknown,women,women&payment_type=NaN&page=Infinity');
  expect(filters).toMatchObject({ category: 'all', region: 'all', district: 'all', age: [undefined, undefined], salary: [0, 20000000], type: 'all', experience: 'all', gender: 'all', payment_type: 'all', page: 1, special: ['women'] });
  expect(readJobFilters('q=' + 'x'.repeat(200)).q).toHaveLength(150);
});
test('combined gender, special groups, salary, age and text are one AND expression before stable pagination', async () => {
  await jobCatalogQuery(client(), readJobFilters(`q=Бухгалтер&category=${category}&region=22&district=100&special=women,students,disabled&salary=1000000-5000000&age=18-30&gender=2&experience=2&type=remote&education=higher&payment_type=3&work_mode=hybrid&working_days=2&page=3`));
  const params = requests[0].searchParams;
  expect(params.getAll('or')).toHaveLength(1);
  const expression = params.get('or')!;
  expect(expression.startsWith('(and(')).toBe(true);
  for (const clause of ['or(is_for_students.eq.true,is_for_graduates.eq.true)', 'or(is_for_women.eq.true,gender.eq.female,gender.eq.2,gender.eq.any,gender.eq.3,gender.is.null)', 'or(gender.eq.female,gender.eq.2,gender.eq.any,gender.eq.3,gender.is.null)', 'or(age_max.gte.18,age_max.is.null)', 'or(age_min.lte.30,age_min.is.null)', 'or(salary_max.gte.1000000,salary_max.is.null)', 'or(salary_min.lte.5000000,salary_min.is.null)', 'title_ru.ilike.%бухгалтер%']) expect(expression).toContain(clause);
  expect(params.get('ishdasiz_job_available')).toBe('eq.true'); expect(params.get('is_for_disabled')).toBe('eq.true');
  expect(params.get('category_id')).toBe('eq.' + category); expect(expression).toContain('or(and(region_id.eq.22,district_id.eq.100),ishdasiz_job_work_mode.eq.remote)'); expect(params.has('region_id')).toBe(false); expect(params.has('district_id')).toBe(false);
  expect(params.has('employment_type')).toBe(false); expect(params.getAll('ishdasiz_job_work_mode')).toEqual(['eq.remote', 'eq.hybrid']); expect(params.get('education_level')).toBe('eq.higher'); expect(params.get('payment_type')).toBe('eq.3'); expect(params.has('work_mode')).toBe(false); expect(params.get('working_days')).toBe('eq.2');
  expect(params.get('experience')).toContain('1_year'); expect(params.get('offset')).toBe('24'); expect(params.get('limit')).toBe('12'); expect(params.get('order')).toBe('created_at.desc,id.desc');
});
test('catalog reads an explicit card projection with direct region names and no private ownership/source payload', async () => {
  await jobCatalogQuery(client(), readJobFilters(''));
  expect(requests[0].searchParams.get('select')).toBe(JOB_CATALOG_FIELDS);
  expect(JOB_CATALOG_FIELDS).toContain('regions(name_uz,name_ru)');
  for (const field of ['*', 'employer_id', 'user_id', 'created_by', 'raw_source_json', 'contact_phone']) expect(JOB_CATALOG_FIELDS).not.toContain(field);
});
test('text punctuation is cleaned without discarding real Cyrillic or Uzbek search terms', async () => {
  await jobCatalogQuery(client(), readJobFilters('q=' + encodeURIComponent('Бухгалтер,(Toshkent)%_*"\\')));
  expect(requests[0].searchParams.get('or')).toContain('title_ru.ilike.%бухгалтер toshkent%');
  expect(requests[0].searchParams.getAll('or')).toHaveLength(1);
});

test.each(['region=22', 'district=100', 'region=22&district=100'])('remote jobs share the selected geography without weakening other filters: %s', async scope => {
  await jobCatalogQuery(client(), readJobFilters(scope + '&type=full_time&work_mode=remote&salary=1000000-5000000'));
  const params = requests[0].searchParams;
  expect(params.getAll('or')).toHaveLength(1);
  expect(params.get('or')).toContain('ishdasiz_job_work_mode.eq.remote');
  expect(params.get('or')).toContain('or(salary_max.gte.1000000,salary_max.is.null)');
  expect(params.get('employment_type')).toBe('eq.full_time');
  expect(params.get('ishdasiz_job_work_mode')).toBe('eq.remote');
  expect(params.has('region_id')).toBe(false); expect(params.has('district_id')).toBe(false);
});

test('a legacy remote link searches normalized work mode and keeps full-time remote imports', async () => {
  await jobCatalogQuery(client(), readJobFilters('type=remote'));
  expect(requests[0].searchParams.get('ishdasiz_job_work_mode')).toBe('eq.remote');
  expect(requests[0].searchParams.has('employment_type')).toBe(false);
});

test('a regional lookup uses precomputed remote IDs while retaining every other filter and availability check', async () => {
  const remoteId = '30000000-0000-4000-8000-000000000003';
  await jobCatalogQuery(client(), readJobFilters('region=12&district=100&special=disabled&q=tikuvchi'), { remoteIds: [remoteId] });
  const params = requests[0].searchParams;
  expect(params.get('or')).toContain(`or(and(region_id.eq.12,district_id.eq.100),id.in.(${remoteId}))`);
  expect(params.get('or')).not.toContain('ishdasiz_job_work_mode');
  expect(params.get('ishdasiz_job_available')).toBe('eq.true');
  expect(params.get('is_for_disabled')).toBe('eq.true');
  expect(params.get('or')).toContain('title_uz.ilike.%tikuvchi%');
});
test('an empty remote set keeps regional results and an explicit remote filter stays empty', async () => {
  await jobCatalogQuery(client(), readJobFilters('region=12&type=remote'), { remoteIds: [] });
  expect(requests[0].searchParams.get('or')).toBe('(and(or(region_id.eq.12)))');
  expect(requests[0].searchParams.get('id')).toBe('in.()');
});

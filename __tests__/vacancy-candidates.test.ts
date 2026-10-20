/** @jest-environment node */
import { rankVacancyCandidates } from '@/lib/vacancy-candidates';
const category = 'a0000010-0010-4000-8000-000000000010';
const job = { id: 'job', title_uz: 'Sotuvchi', title_ru: 'Продавец', category_id: category, region_id: 12, district_id: 100, salary_min: 2000000, salary_max: 4000000, experience: 'no_experience', education_level: 'any', work_mode: 'onsite' };
const resume = (patch: any = {}) => ({ id: 'resume', title: 'Sotuvchi', full_name: 'Test', category_id: category, region_id: 12, district_id: 100, expected_salary_min: 2000000, expected_salary_max: 3500000, experience: 'no_experience', education_level: 'secondary', skills: ['Savdo'], phone: 'private-phone', birth_date: 'private-birthday', user_id: 'private-owner', ...patch });
test('recommendations enforce professional fit and never return contacts or private fields', () => {
  const result = rankVacancyCandidates(job, [resume(), resume({ id: 'far', region_id: 9 }), resume({ id: 'expensive', expected_salary_min: 20000000, expected_salary_max: 30000000 })]);
  expect(result.map(row => row.resume.id)).toEqual(['resume']);
  expect(JSON.stringify(result)).not.toMatch(/private-phone|private-birthday|private-owner|birth_date|user_id/);
});
test('personal traits do not determine employment recommendations', () => {
  const a = rankVacancyCandidates({ ...job, gender: 'male', age_min: 30, age_max: 35 }, [resume({ gender: 'female', birth_date: '2004-01-01' })]);
  const b = rankVacancyCandidates({ ...job, gender: 'female', age_min: 18, age_max: 65 }, [resume({ gender: 'male', birth_date: '1970-01-01' })]);
  expect(a).toEqual(b); expect(a).toHaveLength(1);
});
test('a fully remote job can recommend candidates from another region', () => {
  expect(rankVacancyCandidates({ ...job, work_mode: 'remote' }, [resume({ region_id: 9 })])).toHaveLength(1);
});

import { resumeRows,resumeSkills } from './resume-api';
import { resumeLanguages } from './resume-languages';
import { normalizeExperienceCode } from './experience-compat';
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const year = (value: unknown) => typeof value === 'number' && Number.isInteger(value) ? String(value) : typeof value === 'string' ? value : null;
const place = (value: any) => value && typeof value === 'object' && !Array.isArray(value) ? { name_ru: text(value.name_ru),name_uz: text(value.name_uz) } : null;
export function submittedResume(row: Record<string,any>) {
  const detailed = resumeRows(row.experience_details);
  return {
    id: row.id as string,title: text(row.title) || text(row.desired_position) || text(row.field_title),full_name: text(row.full_name),
    birth_date: text(row.birth_date),phone: text(row.phone),city: text(row.city),about: text(row.about),skills: resumeSkills(row.skills),
    experience: normalizeExperienceCode(row.experience),experience_years: numeric(row.experience_years),
    experience_details: (detailed.length ? detailed : resumeRows(row.experience)).map(item => ({ company: text(item.company) || text(item.company_name),position: text(item.position) || text(item.title),start_date: text(item.start_date),end_date: text(item.end_date),is_current: item.is_current === true || item.end_date === 'current',description: text(item.description) })),
    education_level: text(row.education_level),education: resumeRows(row.education).map(item => ({ institution: text(item.institution),degree: text(item.degree),field: text(item.field),start_year: year(item.start_year),end_year: year(item.end_year) })),
    languages: resumeLanguages(row.languages),employment_type: text(row.employment_type),gender: text(row.gender),expected_salary_min: numeric(row.expected_salary_min),expected_salary_max: numeric(row.expected_salary_max),regions: place(row.regions),districts: place(row.districts),
  };
}
export type SubmittedResumeDocument = ReturnType<typeof submittedResume>;

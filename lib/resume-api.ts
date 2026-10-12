import { AccountApiError } from './account-api';
export function resumeRows(value: unknown): any[] {
  if (Array.isArray(value)) return value.filter(row => row && typeof row === 'object' && !Array.isArray(row));
  if (typeof value === 'string') { try { return resumeRows(JSON.parse(value)); } catch { return []; } }
  return value && typeof value === 'object' ? [value] : [];
}
export function resumeSkills(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === 'string') { try { parsed = JSON.parse(value); } catch { parsed = value.split(/[,;\n]/); } }
  const rows = Array.isArray(parsed) ? parsed : parsed == null ? [] : [parsed];
  return Array.from(new Set(rows.map(row => typeof row === 'string' ? row.trim() : typeof row?.name === 'string' ? row.name.trim() : '').filter(Boolean)));
}
export function resumeErrorText(error: unknown, lang: 'ru' | 'uz') {
  const status = error instanceof AccountApiError ? error.status : 0;
  if (status === 401) return lang === 'ru' ? 'Войдите повторно.' : 'Qayta kiring.';
  if (status === 403) return lang === 'ru' ? 'Откройте профиль соискателя.' : 'Ish izlovchi profilini oching.';
  if (status === 404) return lang === 'ru' ? 'Резюме недоступно.' : 'Rezyume mavjud emas.';
  if ((status === 400 || status === 409) && error instanceof AccountApiError && error.detail) {
    const parts = error.detail.split(' / '); return parts[lang === 'ru' ? 0 : 1] || parts[0];
  }
  if (status === 409) return lang === 'ru' ? 'Резюме уже изменилось. Обновите страницу.' : 'Rezyume o‘zgargan. Sahifani yangilang.';
  return lang === 'ru' ? 'Не удалось загрузить или сохранить резюме. Попробуйте ещё раз.' : 'Rezyumeni yuklab yoki saqlab bo‘lmadi. Qayta urinib ko‘ring.';
}
export function resumePayload(form: any, skills: string[], experiences: any[], educations: any[], languages: any[], draft: boolean) {
  const numeric = (value: unknown) => value == null || value === '' ? null : Number(value);
  const plain = (rows: any[]) => rows.map(({ id: _id, ...data }) => data);
  return { title: form.title, full_name: form.full_name, birth_date: form.birth_date || null, phone: form.phone,
    region_id: numeric(form.region_id), district_id: numeric(form.district_id), category_id: form.category_id || null,
    experience: form.experience_level, education_level: form.education_level, gender: form.gender, employment_type: form.employment_type,
    about: form.about, skills, experience_details: plain(experiences), education: plain(educations), languages: plain(languages),
    expected_salary_min: form.salary_negotiable ? null : numeric(form.salary_min), expected_salary_max: form.salary_negotiable ? null : numeric(form.salary_max),
    is_public: form.is_visible, status: draft ? 'draft' : 'active' };
}

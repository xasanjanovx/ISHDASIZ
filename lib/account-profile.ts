import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountError } from './auth/account';
import { normalizePhone } from './auth/server';
import type { ChatRole } from './account-chat';
import { validResumeVersion } from './account-resumes';

const common = 'id,phone,telegram,region_id,district_id,city,updated_at';
const seeker = 'full_name,birth_date,about';
const employer = 'company_name,industry,address,email,website,description,inn,director_name,company_size,is_verified';
export const profileTable = (role: ChatRole) => role === 'employer' ? 'employer_profiles' : 'job_seeker_profiles';
export const profileFields = (role: ChatRole) => `${common},${role === 'employer' ? employer : seeker}`;
export async function ownProfile(client: SupabaseClient, userId: string, role: ChatRole) {
  const result = await client.from(profileTable(role)).select(profileFields(role)).eq('user_id', userId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new AccountError(403, 'Сначала создайте профиль этой роли / Avval ushbu rol profilini yarating');
  return result.data as any;
}
const invalid = (ru: string, uz: string): never => { throw new AccountError(400, `${ru} / ${uz}`); };
function text(value: unknown, max: number, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || value.length > max || required && !value.trim()) return invalid('Проверьте текстовые поля', 'Matn maydonlarini tekshiring');
  return value.trim() || null;
}
function locationId(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > 2147483647) return invalid('Выберите регион и район из списка', 'Viloyat va tumanni ro‘yxatdan tanlang');
  return value;
}
export async function profileInput(client: SupabaseClient, role: ChatRole, body: any, saved: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('Некорректная форма', 'Forma noto‘g‘ri');
  const payload: any = {};
  const fields = role === 'employer'
    ? { company_name: 255, industry: 100, address: 1000, email: 254, website: 2048, description: 10000, inn: 20, director_name: 255, company_size: 100 }
    : { full_name: 255, birth_date: 10, about: 10000 };
  for (const [key, limit] of Object.entries(fields)) if (key in body) payload[key] = text(body[key], limit, key === 'company_name' || key === 'full_name');
  if ('phone' in body) {
    const raw = text(body.phone, 25); payload.phone = raw ? normalizePhone(raw) : null;
    if (raw && !payload.phone) invalid('Введите телефон +998 и 9 цифр', '+998 va 9 raqamli telefon kiriting');
  }
  if ('telegram' in body) {
    const raw = text(body.telegram, 100); const name = raw?.replace(/^https:\/\/t\.me\//i, '').replace(/^@/, '') || null;
    if (name && !/^[a-zA-Z0-9_]{5,32}$/.test(name)) invalid('Проверьте имя пользователя Telegram', 'Telegram foydalanuvchi nomini tekshiring');
    payload.telegram = name;
  }
  if (payload.birth_date && (!/^\d{4}-\d{2}-\d{2}$/.test(payload.birth_date) || !Number.isFinite(Date.parse(payload.birth_date)) || new Date(payload.birth_date).toISOString().slice(0, 10) !== payload.birth_date || payload.birth_date < '1900-01-01' || payload.birth_date > new Date().toISOString().slice(0, 10))) invalid('Проверьте дату рождения', 'Tug‘ilgan sanani tekshiring');
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) invalid('Проверьте email', 'Emailni tekshiring');
  if (payload.website) {
    try { const url = new URL(payload.website); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch { invalid('Введите адрес сайта с https:// или http://', 'Sayt manzilini https:// yoki http:// bilan kiriting'); }
  }
  if (role === 'employer') {
    for (const key of ['company_name', 'inn', 'director_name']) if (saved.is_verified === true && key in payload && payload[key] !== (saved[key] || null))
      throw new AccountError(409, 'Реквизиты подтверждённой компании меняются через подтверждение компании / Tasdiqlangan kompaniya rekvizitlari tasdiqlash orqali o‘zgartiriladi');
    if (payload.inn && payload.inn !== saved.inn && !/^\d{9}$/.test(payload.inn)) invalid('ИНН должен содержать 9 цифр', 'STIR 9 ta raqamdan iborat bo‘lsin');
  }
  if ('region_id' in body || 'district_id' in body) {
    const region_id = locationId('region_id' in body ? body.region_id : saved.region_id), district_id = locationId('district_id' in body ? body.district_id : saved.district_id);
    const [region, district] = await Promise.all([
      region_id ? client.from('regions').select('id').eq('id', region_id).maybeSingle() : { data: null, error: null },
      district_id ? client.from('districts').select('id,region_id,name_uz').eq('id', district_id).maybeSingle() : { data: null, error: null },
    ]);
    if (region.error || district.error) throw new AccountError(503, 'Не удалось проверить местоположение / Joylashuvni tekshirib bo‘lmadi');
    if (region_id && !region.data || district_id && !district.data || region_id && district.data && district.data.region_id !== region_id) invalid('Район не соответствует выбранному региону', 'Tuman tanlangan viloyatga mos emas');
    payload.region_id = district.data?.region_id || region_id;
    payload.district_id = district_id;
    payload.city = district.data?.name_uz || null;
  }
  return payload;
}
export async function profileResult(client: SupabaseClient, row: any, role: ChatRole, accountPhone: string) {
  const profile: any = Object.fromEntries(profileFields(role).split(',').map(key => [key, row[key] ?? null]));
  profile.account_phone = accountPhone;
  if (!profile.district_id && typeof profile.city === 'string' && /^\d+$/.test(profile.city)) profile.district_id = Number(profile.city);
  const district = profile.district_id ? await client.from('districts').select('id,region_id,name_uz,name_ru').eq('id', profile.district_id).maybeSingle() : { data: null, error: null };
  if (district.error) throw district.error;
  if (district.data) profile.region_id = district.data.region_id;
  const region = profile.region_id ? await client.from('regions').select('name_uz,name_ru').eq('id', profile.region_id).maybeSingle() : { data: null, error: null };
  if (region.error) throw region.error;
  profile.districts = district.data ? { name_uz: district.data.name_uz, name_ru: district.data.name_ru } : null;
  profile.regions = region.data || null;
  return profile;
}
export async function saveProfile(client: SupabaseClient, userId: string, role: ChatRole, body: any) {
  if (!body || !('expected_updated_at' in body) || !validResumeVersion(body.expected_updated_at)) invalid('Обновите профиль перед сохранением', 'Saqlashdan oldin profilni yangilang');
  const saved = await ownProfile(client, userId, role);
  if ((saved.updated_at || null) !== body.expected_updated_at) throw new AccountError(409, 'Профиль уже изменился. Обновите его перед сохранением / Profil o‘zgargan. Saqlashdan oldin uni yangilang');
  const payload = await profileInput(client, role, body, saved);
  if (!Object.keys(payload).length) invalid('Нет изменений для сохранения', 'Saqlash uchun o‘zgarish yo‘q');
  const nextTime = Math.max(Date.now(), (Date.parse(saved.updated_at || '') || 0) + 1);
  let query = client.from(profileTable(role)).update({ ...payload, updated_at: new Date(nextTime).toISOString() }).eq('id', saved.id).eq('user_id', userId);
  query = saved.updated_at == null ? query.is('updated_at', null) : query.eq('updated_at', saved.updated_at);
  // A concurrent verification must never be undone by an old company form.
  if (role === 'employer') for (const key of ['is_verified', 'company_name', 'inn', 'director_name']) query = saved[key] == null ? query.is(key, null) : query.eq(key, saved[key]);
  const result = await query.select(profileFields(role)).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new AccountError(409, 'Профиль изменился во время сохранения. Обновите страницу / Saqlash paytida profil o‘zgargan. Sahifani yangilang');
  return result.data;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { ISHDASIZ_CATEGORIES } from '@/lib/mappers/osonish-mapper';
import { fetchOsonishConfigs } from '@/lib/scrapers/osonish-config';
import { createHash } from 'node:crypto';

// The ten top-level directions in the public OsonIsh catalogue. Stable IDs keep
// existing vacancies, filters and saved searches attached to the same direction.
const directions = [
  ['IT', 'Axborot texnologiyalari', 'Информационные технологии', 'it', 'Monitor'],
  ['PRODUCTION', 'Sanoat va ishlab chiqarish', 'Промышленность и производство', 'sanoat-ishlab-chiqarish', 'Factory'],
  ['SERVICES', 'Xizmatlar', 'Услуги', 'xizmatlar', 'Wrench'],
  ['EDUCATION', 'Ta’lim, madaniyat, sport', 'Образование, культура, спорт', 'talim-madaniyat-sport', 'GraduationCap'],
  ['HEALTHCARE', 'Sog‘liqni saqlash', 'Здравоохранение', 'sogliqni-saqlash', 'Heart'],
  ['FINANCE', 'Moliya, iqtisod, boshqaruv', 'Финансы, экономика, управление', 'moliya-iqtisod-boshqaruv', 'Wallet'],
  ['CONSTRUCTION', 'Qurilish', 'Строительство', 'qurilish', 'Building2'],
  ['AGRICULTURE', 'Qishloq xo‘jaligi', 'Сельское хозяйство', 'qishloq-xojaligi', 'Wheat'],
  ['TRANSPORT', 'Transport', 'Транспорт', 'transport', 'Truck'],
  ['SALES', 'Savdo va marketing', 'Продажи и маркетинг', 'savdo-marketing', 'ShoppingBag'],
] as const;
const sourceKeys: Record<number, typeof directions[number][0]> = { 21: 'PRODUCTION', 48: 'SERVICES', 42: 'EDUCATION', 47: 'HEALTHCARE', 7: 'AGRICULTURE', 1: 'FINANCE', 41: 'CONSTRUCTION', 36: 'TRANSPORT', 64: 'SALES', 12: 'IT' };
function sourceId(id: number) {
  const bytes = createHash('sha1').update(Buffer.from('c34296e2b3584fbca70b0489ba24a501', 'hex')).update('osonish-main-field:' + id).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const normalized = (value: string) => value.toLowerCase().replace(/['‘’ʻʼ`]/g, '').replace(/\s+/g, ' ').trim();
export async function ensureSourceCategories(client: SupabaseClient, signal?: AbortSignal) {
  const source = (await fetchOsonishConfigs(signal))?.mainFields;
  if (!source?.length) throw new Error('Source directions unavailable');
  const query = client.from('categories').select('id,name_uz,name_ru,slug');
  const current = await (signal ? query.abortSignal(signal) : query);
  if (current.error || !Array.isArray(current.data)) throw new Error('Categories unavailable');
  const existing = new Set(current.data.map(row => row.id));
  const missing = source.flatMap(item => {
    const key = sourceKeys[item.id], known = directions.find(row => row[0] === key);
    const id = key ? ISHDASIZ_CATEGORIES[key] : sourceId(item.id);
    const matchedName = current.data!.some(row => [row.name_uz, row.name_ru].some(name => typeof name === 'string' && normalized(name) === normalized(item.name)));
    return existing.has(id) || matchedName ? [] : [{ id, name_uz: item.name, name_ru: item.name_ru || known?.[2] || item.name, slug: known?.[3] || `osonish-soha-${item.id}`, icon: known?.[4] || 'Briefcase' }];
  });
  if (missing.length) {
    const insert = client.from('categories').upsert(missing, { onConflict: 'id', ignoreDuplicates: true });
    const result = await (signal ? insert.abortSignal(signal) : insert);
    if (result.error) throw new Error('Category sync unavailable');
  }
  return { checked: source.length, added: missing.length };
}

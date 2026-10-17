export type HomeOverview = {
  categoryCounts: Record<string, number>;
  specialCounts: { students: number; disabled: number; women: number };
  asOf: string;
};
export function validHomeOverview(value: unknown): value is HomeOverview {
  if (!value || typeof value !== 'object') return false;
  const item = value as HomeOverview;
  const count = (number: unknown) => typeof number === 'number' && Number.isSafeInteger(number) && number >= 0;
  const date = (stamp: unknown) => typeof stamp === 'string' && Number.isFinite(Date.parse(stamp));
  if (!item.categoryCounts || typeof item.categoryCounts !== 'object' || Array.isArray(item.categoryCounts)
    || Object.entries(item.categoryCounts).some(([id, total]) => !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) || !count(total))
    || !item.specialCounts || ![item.specialCounts.students, item.specialCounts.disabled, item.specialCounts.women].every(count)
    || !date(item.asOf)) return false;
  return true;
}

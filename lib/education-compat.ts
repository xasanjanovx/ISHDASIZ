const aliases: Record<string, string[]> = {
  secondary: ['secondary', '1'], vocational: ['vocational', '2'],
  higher: ['higher', '3', '5'], master: ['master', '4'], any: ['any', '0'],
};
export function normalizeEducationFilter(value: string | null): string {
  return Object.keys(aliases).find(key => aliases[key].includes(value || '')) || 'all';
}
export const expandEducationFilterValues = (value: string) => aliases[value] || [value];

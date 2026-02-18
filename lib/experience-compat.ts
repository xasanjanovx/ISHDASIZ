export type AppLang = 'uz' | 'ru';

const EXPERIENCE_CANONICAL_ALIASES: Record<string, string[]> = {
  '1': ['1', '0', 'no_experience', 'tajribasiz', 'без опыта', 'talab etilmaydi'],
  '2': ['2', '1_year', '1 yil', '1 год', '1 yilgacha', 'до 1 года'],
  '3': ['3', '3_years', '1_3_years', '1-3 yil', '1-3 года'],
  '4': ['4', '5_years', '3_5_years', '3-5 yil', '3-5 лет'],
  '5': ['5', '10_years', '5_plus', '5+ yil', '5+ лет', '5 yildan ortiq'],
};

const EXPERIENCE_LABELS: Record<string, { uz: string; ru: string }> = {
  '1': { uz: 'Tajribasiz', ru: 'Без опыта' },
  '2': { uz: '1 yil', ru: '1 год' },
  '3': { uz: '1-3 yil', ru: '1-3 года' },
  '4': { uz: '3-5 yil', ru: '3-5 лет' },
  '5': { uz: '5+ yil', ru: '5+ лет' },
};

export function normalizeExperienceCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  for (const [canonical, aliases] of Object.entries(EXPERIENCE_CANONICAL_ALIASES)) {
    if (aliases.includes(raw)) return canonical;
  }

  if (['1', '2', '3', '4', '5'].includes(raw)) return raw;
  return null;
}

export function expandExperienceFilterValues(value: string): string[] {
  const code = normalizeExperienceCode(value);
  if (!code) return [value];
  return EXPERIENCE_CANONICAL_ALIASES[code] || [value];
}

export function getExperienceLabel(value: unknown, years: unknown, lang: AppLang): string {
  const yearsNum = typeof years === 'number' ? years : Number(years);
  if (Number.isFinite(yearsNum) && yearsNum > 0) {
    const rounded = Math.round(yearsNum);
    return lang === 'uz' ? `${rounded} yil` : `${rounded} лет`;
  }

  const code = normalizeExperienceCode(value);
  if (code && EXPERIENCE_LABELS[code]) {
    return EXPERIENCE_LABELS[code][lang];
  }

  return lang === 'uz' ? 'Tajribasiz' : 'Без опыта';
}


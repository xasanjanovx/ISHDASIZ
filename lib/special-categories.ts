/**
 * Special Categories (Alohida toifalar) for job vacancies
 * Used in job form, job cards, job details, and Telegram posts
 */

export interface SpecialCategory {
    key: 'is_for_students' | 'is_for_disabled' | 'is_for_women';
    slug: 'students' | 'disabled' | 'women';
    label_uz: string;
    label_ru: string;
    badge_uz: string;
    badge_ru: string;
    icon?: any; // We'll handle icons in the component
}

export const SPECIAL_CATEGORIES: SpecialCategory[] = [
    {
        key: 'is_for_students',
        slug: 'students',
        label_uz: 'Talaba va bitiruvchilar uchun',
        label_ru: 'Для студентов и выпускников',
        badge_uz: 'Talaba va bitiruvchilar ham mos keladi',
        badge_ru: 'Подходит для студентов',
    },
    {
        key: 'is_for_disabled',
        slug: 'disabled',
        label_uz: "Nogironligi bo'lgan shaxslar uchun",
        label_ru: 'Для лиц с инвалидностью',
        badge_uz: "Nogironligi bo'lgan shaxslar uchun ham mos keladi",
        badge_ru: 'Подходит для людей с инвалидностью',
    },
    {
        key: 'is_for_women',
        slug: 'women',
        label_uz: 'Ayollar uchun',
        label_ru: 'Для женщин',
        badge_uz: 'Ayollar uchun ham mos keladi',
        badge_ru: 'Подходит для женщин',
    },
];


/**
 * Get active special categories from job data
 */
export function getActiveSpecialCategories(job: {
    is_for_students?: boolean;
    is_for_disabled?: boolean;
    is_for_women?: boolean;
}): SpecialCategory[] {
    return SPECIAL_CATEGORIES.filter((cat) => job[cat.key] === true);
}

/**
 * Check if job has any special categories
 */
export function hasSpecialCategories(job: {
    is_for_students?: boolean;
    is_for_disabled?: boolean;
    is_for_women?: boolean;
}): boolean {
    return getActiveSpecialCategories(job).length > 0;
}

/**
 * Format special categories for Telegram post
 */
export function formatSpecialCategoriesForTelegram(
    job: {
        is_for_students?: boolean;
        is_for_disabled?: boolean;
        is_for_women?: boolean;
    },
    lang: 'uz' | 'ru'
): string {
    const active = getActiveSpecialCategories(job);
    if (active.length === 0) return '';

    const title = lang === 'ru' ? '👥 Особые категории:' : '👥 Alohida toifalar:';
    const items = active
        .map((cat) => `– ${lang === 'ru' ? cat.label_ru : cat.label_uz}`)
        .join('\n');

    return `\n\n${title}\n${items}`;
}

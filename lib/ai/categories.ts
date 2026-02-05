/**
 * Category Mapping for AI Search
 * Aligned with osonish.uz categories (10 core)
 */

interface CategoryDef {
    id: string;
    name_uz: string;
    name_ru: string;
    slug: string;
    keywords: string[];
    exclude?: string[];
}

// Category definitions aligned with osonish.uz - VALID UUIDs
export const CATEGORIES: Record<string, CategoryDef> = {
    IT: {
        id: 'a0000001-0001-4000-8000-000000000001',
        name_uz: 'Axborot texnologiyalari',
        name_ru: 'Информационные технологии',
        slug: 'it',
        keywords: [
            'dasturchi', 'developer', 'frontend', 'backend', 'fullstack', 'full-stack',
            'programmer', 'programmist', 'QA', 'tester', 'devops', 'IT', 'web', 'mobile',
            'react', 'vue', 'angular', 'node', 'python', 'java', 'javascript', 'typescript',
            'android', 'ios', 'flutter', 'swift', 'kotlin', 'php', 'laravel', 'django',
            'data analyst', 'data scientist', 'machine learning', 'AI', 'ML',
            'system admin', 'network', 'database', 'sql', 'mongodb', 'postgres',
            'designer', 'ui', 'ux', 'figma', 'photoshop', 'graphic', 'axborot'
        ],
        exclude: ['SMM', 'operator', 'call center', 'sotuvchi', 'kassir', 'hamshira']
    },
    PRODUCTION: {
        id: 'a0000002-0002-4000-8000-000000000002',
        name_uz: 'Sanoat va ishlab chiqarish',
        name_ru: 'Промышленность и производство',
        slug: 'sanoat-ishlab-chiqarish',
        keywords: [
            'ishlab chiqarish', 'production', 'zavod', 'factory', 'fabrika', 'sanoat',
            'operator', 'texnolog', 'technologist', 'mexanik', 'mechanic',
            'tikuvchi', 'sewer', 'togrin', 'sewing', 'stanok', 'tokar'
        ]
    },
    SERVICES: {
        id: 'a0000003-0003-4000-8000-000000000003',
        name_uz: 'Xizmatlar',
        name_ru: 'Услуги',
        slug: 'xizmatlar',
        keywords: [
            'xizmat', 'service', 'ofitsiant', 'waiter', 'barmen', 'bartender',
            'oshpaz', 'cook', 'chef', 'farrosh', 'cleaner', 'qorovul', 'security',
            'tozalash', 'yuvish', 'dazmollash', 'povar'
        ]
    },
    EDUCATION: {
        id: 'a0000004-0004-4000-8000-000000000004',
        name_uz: "Ta'lim, madaniyat, sport",
        name_ru: 'Образование, культура, спорт',
        slug: 'talim-madaniyat-sport',
        keywords: [
            'oqituvchi', 'teacher', 'ustoz', 'tutor', 'repetitor', 'professor',
            'talim', 'education', 'maktab', 'school', 'universitet', 'university',
            'madaniyat', 'sport', 'murabbiy', 'trener', 'coach'
        ]
    },
    HEALTHCARE: {
        id: 'a0000005-0005-4000-8000-000000000005',
        name_uz: "Sog'liqni saqlash",
        name_ru: 'Здравоохранение',
        slug: 'sogliqni-saqlash',
        keywords: [
            'shifokor', 'doctor', 'vrach', 'hamshira', 'nurse', 'tibbiyot', 'medical',
            'stomatolog', 'dentist', 'jarroh', 'surgeon', 'terapevt', 'pediatr',
            'farmacevt', 'pharmacist', 'laborant', 'apteka'
        ]
    },
    FINANCE: {
        id: 'a0000006-0006-4000-8000-000000000006',
        name_uz: 'Moliya, iqtisod, boshqaruv',
        name_ru: 'Финансы, экономика, управление',
        slug: 'moliya-iqtisod-boshqaruv',
        keywords: [
            'buxgalter', 'accountant', 'moliya', 'finance', 'iqtisod', 'economist',
            'bank', 'kredit', 'audit', 'auditor', 'hisobchi', 'direktor', 'boshqaruv',
            'menejer', 'manager', 'rahbar'
        ]
    },
    CONSTRUCTION: {
        id: 'a0000007-0007-4000-8000-000000000007',
        name_uz: 'Qurilish',
        name_ru: 'Строительство',
        slug: 'qurilish',
        keywords: [
            'qurilish', 'stroitel', 'builder', 'ishchi', 'worker', 'usta', 'master',
            'elektrik', 'electrician', 'santexnik', 'plumber', 'slessar', 'architect',
            'prораб', 'inshoot'
        ]
    },
    AGRICULTURE: {
        id: 'a0000008-0008-4000-8000-000000000008',
        name_uz: "Qishloq xo'jaligi",
        name_ru: 'Сельское хозяйство',
        slug: 'qishloq-xojaligi',
        keywords: [
            'qishloq', 'fermer', 'farmer', 'dehqon', 'agronomist', 'veterinar',
            'chorvachilik', 'parranda', 'bog', 'agro'
        ]
    },
    TRANSPORT: {
        id: 'a0000009-0009-4000-8000-000000000009',
        name_uz: 'Transport',
        name_ru: 'Транспорт',
        slug: 'transport',
        keywords: [
            'haydovchi', 'driver', 'yuk', 'logist', 'logistics', 'kurier', 'courier',
            'taksi', 'taxi', 'avtobus', 'bus', 'transport', 'ekspeditor'
        ]
    },
    SALES: {
        id: 'a0000010-0010-4000-8000-000000000010',
        name_uz: 'Savdo va marketing',
        name_ru: 'Продажи и маркетинг',
        slug: 'savdo-marketing',
        keywords: [
            'sotuvchi', 'seller', 'kassir', 'cashier', 'merchandiser', 'sales',
            'menedjer', 'manager', 'konsultant', 'consultant', 'savdo', 'marketing',
            'smm', 'reklama', 'promotion', 'торговля'
        ]
    },
};

/**
 * Detect category from user query
 */
export function detectCategory(query: string): { id: string; name_uz: string; name_ru: string; slug: string } | null {
    const lowerQuery = query.toLowerCase();

    for (const [key, cat] of Object.entries(CATEGORIES)) {
        if (key === 'OTHER') continue;

        for (const keyword of cat.keywords) {
            if (lowerQuery.includes(keyword.toLowerCase())) {
                if (cat.exclude?.some(ex => lowerQuery.includes(ex.toLowerCase()))) {
                    continue;
                }
                return {
                    id: cat.id,
                    name_uz: cat.name_uz,
                    name_ru: cat.name_ru,
                    slug: cat.slug
                };
            }
        }
    }

    return null;
}

/**
 * Get category by ID
 */
export function getCategoryById(id: string): CategoryDef | null {
    for (const cat of Object.values(CATEGORIES)) {
        if (cat.id === id) return cat;
    }
    return null;
}

/**
 * Get category by slug
 */
export function getCategoryBySlug(slug: string): CategoryDef | null {
    for (const cat of Object.values(CATEGORIES)) {
        if (cat.slug === slug) return cat;
    }
    return null;
}

/**
 * Check if a job is relevant to a category
 */
export function isJobRelevantToCategory(job: any, categoryId: string): boolean {
    const category = getCategoryById(categoryId);
    if (!category) return true;

    const title = (job.title_uz || job.title_ru || '').toLowerCase();
    const description = (job.description_uz || job.description_ru || '').toLowerCase();
    const combined = `${title} ${description}`;

    const hasKeyword = category.keywords.some(kw => combined.includes(kw.toLowerCase()));
    const hasExclusion = category.exclude?.some(ex => combined.includes(ex.toLowerCase()));

    return hasKeyword && !hasExclusion;
}

/**
 * Get all categories for prompt
 */
export function getCategoriesForPrompt(): string {
    return Object.entries(CATEGORIES)
        .map(([_, cat]) => `- "${cat.name_uz}" (id: ${cat.id}): ${cat.keywords.slice(0, 5).join(', ')}...`)
        .join('\n');
}

/**
 * Get default category ID
 */
export function getDefaultCategoryId(): string {
    return Object.values(CATEGORIES)[0]?.id || '';
}

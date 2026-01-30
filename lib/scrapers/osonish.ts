/**
 * OsonIsh.uz Scraper v3 - 2-Step List → Detail Pipeline
 * 
 * Architecture:
 * 1. List API for IDs (fast, per_page=100)
 * 2. Detail API for full data (concurrent, 5 parallel)
 * 
 * Features:
 * - Full field mapping from detail endpoint
 * - Concurrent requests with rate limiting
 * - Retry with exponential backoff
 * - Only imports vacancies with contacts
 * - DYNAMIC CONFIG SUPPORT (v4)
 */

import { OsonishConfigs } from './osonish-config';

// ==================== INTERFACES ====================

export interface OsonishListItem {
    id: number;
    title: string;
    status: number;
    updated_at: string;
}

export interface OsonishDetailResponse {
    success: boolean;
    data: OsonishDetail;
}

export interface OsonishDetail {
    id: number;
    title: string;
    status: number;
    info?: string; // HTML description
    count?: number; // Number of vacancies

    // Salary
    min_salary?: number;
    max_salary?: number;
    payment_type?: number; // 1 = monthly

    // Work type
    busyness_type?: number; // 1: Doimiy, 2: Muddatli
    work_type?: number; // 1: Odatiy, 3: Masofaviy, 4: Gibrid
    working_days_id?: number;
    working_time_from?: string;
    working_time_to?: string;

    // Requirements
    min_education?: number; // 2: O'rta-maxsus, 3: Oliy
    work_experiance?: number;
    age_from?: number;
    age_to?: number;
    gender?: number; // 1: Erkak, 2: Ayol, 3: Ahamiyatsiz

    // Special criteria
    for_whos?: number[]; // 1: nogiron, 2: bitiruvchi, 3: talaba

    // Skills & Education details
    skills_details?: Array<{ skill_id: number; skill_name: string }>;
    edu_directions?: Array<{ id: number; name_uz: string }>;
    languages?: Array<{ language: number; level: number }>;
    benefit_ids?: number[];

    // Category info
    mmk_group?: {
        id: number;
        cat1: string; // e.g. "PROFESSIONAL-MUTAXASSISLAR"
        cat2: string; // e.g. "SOGʻLIQNI SAQLASH SOHASIDA..."
        cat3: string; // e.g. "SHIFOKORLAR"
    };

    mmk_position?: {
        id: number;
        position_name: string;
        mmk_code?: number;
    };

    // Location
    filial?: {
        id: number;
        address?: string;
        lat?: number | null;
        long?: number | null;
        region?: {
            id: number;
            name_uz?: string;
            name_ru?: string;
        };
        city?: {
            id: number;
            name_uz?: string;
            name_ru?: string;
        };
    };

    // Contacts
    hr?: {
        id: number;
        fio?: string;
        phone?: string;
    };
    additional_phone?: string;
    another_network?: string; // Telegram

    // Company
    company?: {
        id: number;
        name?: string;
        logo_url?: string;
    };

    // Timestamps
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;

    // Views
    views_count?: number;
}

export interface TransformedVacancy {
    // Source tracking
    source: 'osonish';
    source_id: string;
    source_url: string;

    // Basic info
    title: string;
    company_name: string;
    description?: string;

    // Salary
    salary_min?: number;
    salary_max?: number;
    payment_type?: number;

    // Work type
    employment_type?: string; // "full_time", "contract", "internship"
    work_mode?: string | null; // "onsite", "remote", "hybrid"
    working_days?: string;
    working_hours?: string;

    // Requirements
    education_level?: number;
    experience_years?: number;
    age_min?: number;
    age_max?: number;
    gender?: number;

    // Special criteria (boolean flags for filters)
    is_for_disabled: boolean;
    is_for_graduates: boolean;
    is_for_students: boolean;
    is_for_women: boolean;

    // Location
    address?: string;
    region_name?: string;
    district_name?: string;
    latitude?: number;
    longitude?: number;

    // Contacts
    contact_phone?: string;
    contact_email?: string;
    contact_telegram?: string;
    additional_phone?: string;
    hr_name?: string;
    has_contact: boolean;

    // Skills
    skills?: string[];

    // Additional UI fields
    vacancy_count?: number;
    views_count?: number;

    // Timestamps
    source_created_at?: string;
    source_updated_at?: string;

    // Raw JSON for full UI parity
    raw_source_json?: Record<string, unknown>;

    // Source category info (for debugging / filters)
    source_category?: string;
    source_subcategory?: string;
}

export interface ScrapeResult {
    vacancies: TransformedVacancy[];
    active_ids: string[];
    removed_ids: string[];
    filled_ids: string[];

    debug: {
        list_items_count: number;
        detail_fetched_count: number;
        detail_success_count: number;
        detail_fail_count: number;
        vacancies_with_contacts: number;
        vacancies_without_contacts: number;
        sample_detail_urls: string[];
        sample_detail_preview_keys: string[];
        errors: string[];
    };
}

// ==================== CONSTANTS ====================

const API_BASE = 'https://osonish.uz/api/api/v1';
const PER_PAGE = 100;
const CONCURRENCY = 5;
const DETAIL_DELAY_MS = 300;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Company contacts cache to avoid duplicate API calls
const companyContactsCache = new Map<number, { phone?: string; email?: string; website?: string } | null>();

/**
 * Fetch company details for fallback contact info (with caching)
 */
async function fetchCompanyContacts(companyId: number): Promise<{ phone?: string; email?: string; website?: string } | null> {
    // Check cache first
    if (companyContactsCache.has(companyId)) {
        return companyContactsCache.get(companyId) || null;
    }

    try {
        const url = `${API_BASE}/companies/${companyId}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            companyContactsCache.set(companyId, null);
            return null;
        }

        const json = await response.json();
        const data = json.data;
        if (!data) {
            companyContactsCache.set(companyId, null);
            return null;
        }

        // Extract contacts
        // Priority: Top level phone -> Nested data.phone -> HR phone
        const phone = data.phone || data.data?.phone || data.hrs?.[0]?.phone;
        const email = data.mail;
        const website = data.web_site;

        const result = { phone, email, website };
        companyContactsCache.set(companyId, result);

        return result;
    } catch (e) {
        companyContactsCache.set(companyId, null);
        return null; // Fail silently
    }
}

/**
 * Check if vacancy has valid contact
 * Valid: hr.phone, additional_phone, or telegram (@/t.me)
 */
function hasValidContact(detail: OsonishDetail): boolean {
    // Check hr.phone
    if (detail.hr?.phone && detail.hr.phone.match(/998\d{9}/)) {
        return true;
    }

    // Check additional_phone
    if (detail.additional_phone && detail.additional_phone.match(/998\d{9}/)) {
        return true;
    }

    // Check another_network for Telegram
    if (detail.another_network) {
        const tg = detail.another_network.toLowerCase();
        if (tg.includes('t.me/') || tg.includes('@') || tg.match(/998\d{9}/)) {
            return true;
        }
    }

    return false;
}

/**
 * Extract and normalize phone number
 */
function normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.match(/^\+?998\d{9}$/)) {
        return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    }
    return undefined;
}

/**
 * Extract Telegram from another_network
 */
function extractTelegram(another_network?: string): string | undefined {
    if (!another_network) return undefined;

    // @username
    const usernameMatch = another_network.match(/@([a-zA-Z][a-zA-Z0-9_]{4,31})/);
    if (usernameMatch) return usernameMatch[0];

    // t.me/username
    const linkMatch = another_network.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]+)/i);
    if (linkMatch) return `@${linkMatch[1]}`;

    // Phone number as Telegram
    const phoneMatch = another_network.match(/998\d{9}/);
    if (phoneMatch) return `+${phoneMatch[0]}`;

    return undefined;
}

/**
 * Strip HTML tags
 */
function stripHtml(html?: string): string {
    if (!html) return '';
    // Replace block tags with newlines
    let cleaned = html
        .replace(/<\/div>/ig, '\n')
        .replace(/<\/p>/ig, '\n')
        .replace(/<br\s*\/?>/ig, '\n')
        .replace(/<\/li>/ig, '\n');
    // Remove all other tags
    cleaned = cleaned.replace(/<[^>]*>/g, ' ');
    // Collapse multiple spaces
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    // Collapse multiple newlines
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();
    return cleaned;
}

/**
 * Extract benefits from HTML description
 * Looks for "Ijtimоiy paketlar:" section
 */
function extractBenefitsFromHtml(html?: string): number[] {
    if (!html) return [];
    const benefits: number[] = [];

    // Normalize HTML content for searching
    const content = html.toLowerCase();

    // Common mappings based on text
    const textToId: Record<string, number> = {
        'ovqat': 1, // Ovqat bilan ta'minlanadi
        'transport': 2, // Transport xizmati mavjud
        'maxsus kiyim': 3, // Maxsus kiyim bilan ta'minlanadi
        'yotoqxona': 4, // Yotoqxona yoki turar joy bilan ta'minlanadi
        'turar joy': 4, // Yotoqxona yoki turar joy bilan ta'minlanadi
        'tibbiy ko': 5, // Tibbiy ko'rik mavjud
        'moddiy rag': 6, // Moddiy rag'batlantirish mavjud
        'ijtimoiy paket': 7 // Boshqa ijtimoiy paketlar mavjud
    };

    // Check roughly if "Ijtimоiy paketlar" or "Qulayliklar" context exists? 
    // Actually, just searching for the phrases is safer as they are quite specific using "mavjud" often.

    for (const [key, id] of Object.entries(textToId)) {
        if (content.includes(key)) {
            benefits.push(id);
        }
    }

    return benefits;
}

/**
 * Extract structured sections from HTML textual content
 */
function extractSectionsFromHtml(html?: string): { talablar: string[], ish_vazifalari: string[], qulayliklar: string[] } {
    if (!html) return { talablar: [], ish_vazifalari: [], qulayliklar: [] };

    const text = stripHtml(html);

    const sections = {
        talablar: [] as string[],
        ish_vazifalari: [] as string[],
        qulayliklar: [] as string[]
    };

    const headerTokens = {
        ish_vazifalari: /(?:Ish vazifalari|Vazifalar|Majburiyatlar|Obyazannosti|Обязанности)/i,
        talablar: /(?:Talablar|Ish talablari|Nomzodga talablar|Trebovaniya|Требования)/i,
        qulayliklar: /(?:Imkoniyatlar|Qulayliklar|Sharoitlar|Usloviya|Условия|Ijtim[oо]iy(?:\s+paketlar)?|Ijtimoiiy|Preimushchestva|Sotsialniy|Социальн\w*)/i
    };

    const markSection = (input: string, key: keyof typeof headerTokens, regex: RegExp) => {
        return input.replace(new RegExp(`${regex.source}\\s*[:\\-–—\\.]`, 'gi'), `\n__SECTION_${key}__\n`);
    };

    let marked = text;
    marked = markSection(marked, 'ish_vazifalari', headerTokens.ish_vazifalari);
    marked = markSection(marked, 'talablar', headerTokens.talablar);
    marked = markSection(marked, 'qulayliklar', headerTokens.qulayliklar);

    const headerGuard = new RegExp(
        `${headerTokens.ish_vazifalari.source}|${headerTokens.talablar.source}|${headerTokens.qulayliklar.source}`,
        'i'
    );

    const splitToItems = (content: string): string[] => {
        let normalized = content
            .replace(/\r/g, '\n')
            // Handle bullets right after headers like "Vazifalar: -Backend"
            .replace(/:\s*[\u2013\u2014-]\s*/g, ':\n- ')
            // Normalize explicit bullet characters
            .replace(/[\u2022\u00b7]/g, '\n- ')
            // Handle dashes at the start of a line (with or without a space)
            .replace(/^\s*[\u2013\u2014-]\s*/gm, '\n- ')
            // Handle dashes used as list separators mid-line
            .replace(/(?:^|\s)[\u2013\u2014-]\s+/g, '\n- ')
            // Handle numbered lists
            .replace(/(?:^|\s)\d+\.\s+/g, '\n- ')
            // Split on semicolons too
            .replace(/;/g, '\n')
            .replace(/\n{2,}/g, '\n');

        const items = normalized
            .split('\n')
            .map(line => line.trim().replace(/^[\u2013\u2014\u2022\u00b7*\-]+\s*/, '').trim())
            .filter(line => line.length > 2 && !headerGuard.test(line));

        return items;
    };

    const parts = marked.split(/__SECTION_(ish_vazifalari|talablar|qulayliklar)__/);
    for (let i = 1; i < parts.length; i += 2) {
        const key = parts[i] as keyof typeof sections;
        const content = parts[i + 1] || '';
        const items = splitToItems(content);
        if (items.length > 0) {
            sections[key].push(...items);
        }
    }

    return sections;
}

/**
 * Map employment type ID to DB-allowed enum values
 * Constraint: 'full_time', 'part_time', 'contract', 'internship', 'remote'
 */
function mapEmploymentType(busyness_type?: number): string {
    const map: Record<number, string> = {
        1: 'full_time',   // Doimiy
        2: 'contract',    // Muddatli
        3: 'contract',    // Mavsumiy
        4: 'internship'   // Stajirovka/Amaliyot
    };
    return busyness_type ? (map[busyness_type] || 'full_time') : 'full_time';
}

/**
 * Map work mode from dynamic config or ID fallback
 */
function mapWorkMode(id?: number, configs?: OsonishConfigs): string | null {
    if (!id) return null;

    // 1. Dynamic Map (if config available)
    if (configs?.workMode[id]) {
        const label = configs.workMode[id].toLowerCase();
        if (label.includes('masofaviy') || label.includes('uydan')) return 'remote';
        if (label.includes('gibrid')) return 'hybrid';
        if (label.includes('ofis') || label.includes('odatiy') || label.includes('joyida')) return 'onsite';
    }

    // 2. Fallback ID Map
    const map: Record<number, string> = {
        1: 'onsite',   // Odatiy/Ish joyida
        2: 'remote',   // Uydan
        3: 'remote',   // Masofaviy
        4: 'hybrid'    // Gibrid
    };
    return map[id] || null;
}

/**
 * Map experience from dynamic config or ID fallback
 */
function mapExperience(id?: number, configs?: OsonishConfigs): number {
    if (!id) return 0;

    // 1. Dynamic Map (if config available)
    if (configs?.experience[id]) {
        const label = configs.experience[id].toLowerCase();
        if (label.includes('talab etilmaydi') || label.includes('bez opita')) return 0;

        // Parse "1-3 yil", "3-6 yil", "5 yildan"
        const numbers = label.match(/\d+/g)?.map(Number);
        if (numbers && numbers.length > 0) {
            // "1-3" -> avg 2? Or min 1? Existing logic used approx values.
            // "1-3" was 2. "3-6" was 5. "6+" was 7.
            const val = numbers[0];
            if (val >= 6) return 7;
            if (val >= 5) return 6; // 5+
            if (val >= 3) return 5; // 3-6
            if (val >= 1) return 2; // 1-3
        }
    }

    // 2. Fallback ID Map
    const map: Record<number, number> = {
        1: 0,   // No experience
        2: 2,   // 1-3 years
        3: 5,   // 3-6 years
        4: 7    // 6+ years
    };
    return map[id] || 0;
}

// ==================== API FUNCTIONS ====================

/**
 * Fetch with retry and backoff
 */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'uz-UZ,uz;q=0.9,ru;q=0.8',
                    'Referer': 'https://osonish.uz/vacancies'
                }
            });

            // Rate limited - backoff
            if (response.status === 429) {
                const waitMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
                console.log(`Rate limited, waiting ${waitMs}ms...`);
                await sleep(waitMs);
                continue;
            }

            // Server error - retry
            if (response.status >= 500 && attempt < retries) {
                await sleep(BACKOFF_BASE_MS * attempt);
                continue;
            }

            return response;
        } catch (error) {
            if (attempt === retries) throw error;
            await sleep(BACKOFF_BASE_MS * attempt);
        }
    }
    throw new Error('Max retries exceeded');
}

/**
 * Step 1: Fetch vacancy IDs from list
 */
export async function fetchVacancyIdList(page: number = 1): Promise<{
    ids: number[];
    total: number;
    lastPage: number;
}> {
    const url = `${API_BASE}/vacancies?page=${page}&per_page=${PER_PAGE}&status=2&is_offer=0&sort_key=created_at&sort_type=desc`;

    try {
        const response = await fetchWithRetry(url);
        if (!response.ok) {
            return { ids: [], total: 0, lastPage: 0 };
        }

        const json = await response.json();
        const items = json?.data?.data ?? [];
        const ids = items.map((item: OsonishListItem) => item.id);

        return {
            ids,
            total: json?.data?.total ?? 0,
            lastPage: json?.data?.last_page ?? 0
        };
    } catch (error) {
        console.error('Error fetching list:', error);
        return { ids: [], total: 0, lastPage: 0 };
    }
}

/**
 * Step 2: Fetch single vacancy detail
 */
export async function fetchVacancyDetail(id: number): Promise<{
    success: boolean;
    detail?: OsonishDetail;
    status: number;
    error?: string;
}> {
    const url = `${API_BASE}/vacancies/${id}`;

    try {
        const response = await fetchWithRetry(url);

        if (response.status === 404) {
            return { success: false, status: 404, error: 'Not found' };
        }

        if (!response.ok) {
            return { success: false, status: response.status, error: response.statusText };
        }

        const json: OsonishDetailResponse = await response.json();
        return { success: true, detail: json.data, status: 200 };
    } catch (error: any) {
        return { success: false, status: 0, error: error.message };
    }
}

/**
 * Fetch multiple details with concurrency control
 */
async function fetchDetailsWithConcurrency(
    ids: number[],
    concurrency: number = CONCURRENCY
): Promise<Map<number, { success: boolean; detail?: OsonishDetail; status: number; error?: string }>> {
    const results = new Map<number, { success: boolean; detail?: OsonishDetail; status: number; error?: string }>();

    // Process in batches
    for (let i = 0; i < ids.length; i += concurrency) {
        const batch = ids.slice(i, i + concurrency);

        const batchPromises = batch.map(async (id) => {
            const result = await fetchVacancyDetail(id);
            await sleep(DETAIL_DELAY_MS); // Small delay between requests
            return { id, result };
        });

        const batchResults = await Promise.all(batchPromises);

        for (const { id, result } of batchResults) {
            results.set(id, result);
        }
    }

    return results;
}

/**
 * Transform detail to our format
 */
export function transformDetail(detail: OsonishDetail, configs?: OsonishConfigs): TransformedVacancy {
    // Extract contacts
    const contact_phone = normalizePhone(detail.hr?.phone) || normalizePhone(detail.additional_phone);
    const contact_telegram = extractTelegram(detail.another_network);
    const has_contact = hasValidContact(detail);

    // Extract for_whos flags
    const forWhos = detail.for_whos || [];
    const is_for_disabled = forWhos.includes(1);
    const is_for_graduates = forWhos.includes(2);
    const is_for_students = forWhos.includes(3);

    // Do not infer "Ayollar uchun" from gender; use only explicit special categories
    const is_for_women = false;

    // Extract benefits from HTML too
    const htmlBenefits = extractBenefitsFromHtml(detail.info);
    const apiBenefits = detail.benefit_ids || [];
    const allBenefits = Array.from(new Set([...apiBenefits, ...htmlBenefits]));

    // Extract skills
    const skills = detail.skills_details?.map(s => s.skill_name).filter(Boolean) || [];

    // Build working hours string
    let working_hours: string | undefined;
    if (detail.working_time_from && detail.working_time_to) {
        working_hours = `${detail.working_time_from} - ${detail.working_time_to}`;
    }

    // Extract structured sections
    const extractedSections = extractSectionsFromHtml(detail.info);

    // Merge extracted benefits from text "Imkoniyatlar" into extractedSections.qulayliklar if needed?
    // Already handled by regex logic in extractSectionsFromHtml (Imkoniyatlar -> qulayliklar)

    return {
        // Source
        source: 'osonish',
        source_id: String(detail.id),
        source_url: `https://osonish.uz/vacancies/${detail.id}`,

        // Basic
        title: detail.title || 'Noma\'lum lavozim',
        company_name: detail.company?.name || 'Noma\'lum kompaniya',
        description: stripHtml(detail.info) ||
            (detail.mmk_position?.position_name
                ? `${detail.mmk_position.position_name}${detail.skills_details?.length ? '\n\nTalablar:\n' + detail.skills_details.map(s => '- ' + s.skill_name).join('\n') : ''}`
                : undefined),

        // Salary
        salary_min: detail.min_salary || undefined,
        salary_max: detail.max_salary || undefined,
        payment_type: detail.payment_type,

        // Work type
        employment_type: mapEmploymentType(detail.busyness_type),
        work_mode: mapWorkMode(detail.work_type, configs),
        working_days: detail.working_days_id ? String(detail.working_days_id) : undefined,
        working_hours,

        // Requirements
        education_level: detail.min_education,
        experience_years: mapExperience(detail.work_experiance, configs),
        age_min: detail.age_from,
        age_max: detail.age_to,
        gender: detail.gender,

        // Special criteria flags
        is_for_disabled,
        is_for_graduates,
        is_for_students,
        is_for_women,

        // Location
        address: detail.filial?.address || undefined,
        region_name: detail.filial?.region?.name_uz || undefined,
        district_name: detail.filial?.city?.name_uz || undefined,
        latitude: detail.filial?.lat ?? undefined,
        longitude: detail.filial?.long ?? undefined,

        // Contacts
        contact_phone,
        contact_telegram,
        additional_phone: normalizePhone(detail.additional_phone) || undefined,
        hr_name: detail.hr?.fio || undefined,
        has_contact,

        // Benefits (passed via raw_source_json override or we need to add a benefits field to parsed? 
        // Currently route.ts uses raw_source_json.benefit_ids.
        // We should update the raw_source_json.benefit_ids to include our extracted ones.

        // Skills
        skills: skills.length > 0 ? skills : undefined,

        // Additional UI fields
        vacancy_count: detail.count || 1,
        views_count: detail.views_count || 0,

        // Timestamps
        source_created_at: detail.created_at,
        source_updated_at: detail.updated_at,

        // Raw JSON for full UI parity
        // Update benefit_ids in raw json so route.ts picks it up
        // Raw JSON for full UI parity
        // Update benefit_ids in raw json so route.ts picks it up
        raw_source_json: {
            ...(detail as unknown as Record<string, unknown>),
            benefit_ids: allBenefits,
            sections: extractedSections
        },

        // Source category info (for filtering / debugging)
        source_category: detail.mmk_group?.cat2 || detail.mmk_group?.cat1 || undefined,
        source_subcategory: detail.mmk_group?.cat3 || undefined
    };
}

// ==================== MAIN SCRAPER ====================

/**
 * Main 2-step scraper: List → Detail
 * 
 * @param maxPages Maximum pages to fetch from list
 * @param onlyWithContacts Only include vacancies with valid contacts
 */
export async function scrapeOsonishFull(
    maxPages: number = 20,
    onlyWithContacts: boolean = true,
    configs?: OsonishConfigs
): Promise<ScrapeResult> {
    const vacancies: TransformedVacancy[] = [];
    const activeIds: string[] = [];
    const removedIds: string[] = [];
    const filledIds: string[] = [];

    const debug = {
        list_items_count: 0,
        detail_fetched_count: 0,
        detail_success_count: 0,
        detail_fail_count: 0,
        vacancies_with_contacts: 0,
        vacancies_without_contacts: 0,
        sample_detail_urls: [] as string[],
        sample_detail_preview_keys: [] as string[],
        errors: [] as string[]
    };

    console.log(`[Scraper] Starting 2-step import (max ${maxPages} pages)...`);

    // Step 1: Collect all IDs from list
    const allIds: number[] = [];
    let totalOnSite = 0;

    for (let page = 1; page <= maxPages; page++) {
        const { ids, total, lastPage } = await fetchVacancyIdList(page);

        if (page === 1) {
            totalOnSite = total;
            console.log(`[Scraper] Total vacancies on site: ${total}`);
        }

        if (ids.length === 0) break;

        allIds.push(...ids);
        console.log(`[Scraper] Page ${page}: ${ids.length} IDs`);

        if (page >= lastPage) break;

        await sleep(200); // Small delay between list pages
    }

    debug.list_items_count = allIds.length;
    console.log(`[Scraper] Collected ${allIds.length} IDs, fetching details...`);

    // Step 2: Fetch details with concurrency
    const detailResults = await fetchDetailsWithConcurrency(allIds, CONCURRENCY);
    debug.detail_fetched_count = detailResults.size;

    // Sample URLs for debug
    debug.sample_detail_urls = allIds.slice(0, 3).map(id => `${API_BASE}/vacancies/${id}`);

    // Process results
    for (const [id, result] of Array.from(detailResults)) {
        if (!result.success) {
            debug.detail_fail_count++;

            if (result.status === 404) {
                removedIds.push(String(id));
            } else {
                debug.errors.push(`ID ${id}: ${result.error}`);
            }
            continue;
        }

        debug.detail_success_count++;

        // Sample preview keys from first detail
        if (debug.sample_detail_preview_keys.length === 0 && result.detail) {
            debug.sample_detail_preview_keys = Object.keys(result.detail);
        }

        const detail = result.detail!;

        // Check status
        if (detail.status !== 2) {
            filledIds.push(String(id));
            continue;
        }

        activeIds.push(String(id));

        // Transform
        const transformed = transformDetail(detail, configs);

        // Fallback to company contacts if missing
        if (!transformed.has_contact && detail.company?.id) {
            try {
                const companyContacts = await fetchCompanyContacts(detail.company.id);
                if (companyContacts) {
                    if (companyContacts.phone) transformed.contact_phone = normalizePhone(companyContacts.phone);
                    if (companyContacts.email) transformed.contact_email = companyContacts.email.trim();
                    if (companyContacts.website) transformed.source_url = companyContacts.website; // Or better store separately

                    // Re-evaluate has_contact
                    transformed.has_contact = !!(transformed.contact_phone || transformed.contact_telegram || transformed.contact_email);

                    if (transformed.has_contact) {
                        debug.vacancies_with_contacts++; // Just a counter, careful not to double count if we change logic
                    }
                }
            } catch (err) {
                // Ignore company fetch errors
            }
        }

        // Filter by contact
        if (transformed.has_contact) {
            vacancies.push(transformed);
        } else {
            debug.vacancies_without_contacts++;
            if (!onlyWithContacts) {
                vacancies.push(transformed);
            }
        }
    }

    console.log(`[Scraper] Complete: ${vacancies.length} vacancies imported`);
    console.log(`[Scraper] Stats: ${debug.detail_success_count} success, ${debug.detail_fail_count} failed`);
    console.log(`[Scraper] Contacts: ${debug.vacancies_with_contacts} with, ${debug.vacancies_without_contacts} without`);

    return {
        vacancies,
        active_ids: activeIds,
        removed_ids: removedIds,
        filled_ids: filledIds,
        debug
    };
}

// ==================== LEGACY EXPORT ====================

export type { TransformedVacancy as ScrapedVacancy };

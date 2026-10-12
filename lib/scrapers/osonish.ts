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
import { parseCoordinate } from '../coordinates';
import {collectSourceIds,parseSourcePage,type SourcePage} from './source-list';

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
            name_en?: string;
        };
        city?: {
            id: number;
            name_uz?: string;
            name_ru?: string;
            name_en?: string;
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
    list_complete: boolean;
    list_total: number | null;
    listed_ids: string[];
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

const trimApiBase = (value: string) => value.replace(/\/+$/, '');
const buildApiBaseCandidates = (value: string): string[] => {
    const cleaned = trimApiBase(value);
    if (!cleaned) return [];
    if (cleaned.endsWith('/api/api/v1')) {
        return [cleaned, cleaned.replace('/api/api/v1', '/api/v1')];
    }
    if (cleaned.endsWith('/api/v1')) {
        return [cleaned, cleaned.replace('/api/v1', '/api/api/v1')];
    }
    return [`${cleaned}/api/v1`, `${cleaned}/api/api/v1`];
};
const API_BASE_ENV = process.env.OSONISH_API_BASE?.trim();
const API_BASES = Array.from(new Set([
    'https://osonish.uz/api/v1',
    'https://osonish.uz/api/api/v1',
    ...(API_BASE_ENV ? buildApiBaseCandidates(API_BASE_ENV) : [])
]));
let API_BASE = API_BASES[0] || 'https://osonish.uz/api/v1';
let API_BASE_RESOLVED = false;
const PER_PAGE = 100;
const CONCURRENCY = 5;
const DETAIL_DELAY_MS = 300;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const DEFAULT_HEADERS: Record<string, string> = {
    'Accept': 'application/json',
    'Accept-Language': 'ru,en-US;q=0.9,en;q=0.8,uz;q=0.7',
    'Referer': 'https://osonish.uz/vacancies',
    'Origin': 'https://osonish.uz',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Connection': 'keep-alive',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

function buildOsonishHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS };
    const cookie = process.env.OSONISH_COOKIE;
    const token = process.env.OSONISH_BEARER_TOKEN || process.env.OSONISH_API_TOKEN;
    const userId = process.env.OSONISH_USER_ID || process.env.OSONISH_CURRENT_USER_ID;
    if (cookie) headers.Cookie = cookie;
    if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    if (userId) headers['x-current-user-id'] = userId;
    return headers;
}

function buildPublicOsonishHeaders(): Record<string, string> {
    const headers = buildOsonishHeaders();
    delete headers.Cookie;
    delete headers.Authorization;
    delete headers['x-current-user-id'];
    return headers;
}

function hasOsonishAuthHeaders(): boolean {
    return Boolean(
        process.env.OSONISH_COOKIE
        || process.env.OSONISH_BEARER_TOKEN
        || process.env.OSONISH_API_TOKEN
        || process.env.OSONISH_USER_ID
        || process.env.OSONISH_CURRENT_USER_ID
    );
}

async function ensureApiBase(signal?:AbortSignal): Promise<string> {
    if(signal?.aborted)throw new Error('Source request cancelled');
    if (API_BASE_RESOLVED) return API_BASE;

    const isUsableProbeStatus = (status: number) => {
        if ([401, 403, 404].includes(status)) return false;
        // 2xx is valid; some environments may return 4xx for query shape but still indicate real endpoint.
        return status >= 200 && status < 500;
    };

    for (const base of API_BASES) {
        try {
            const probe = `${base}/vacancies?page=1&per_page=1&status=2&sort_key=created_at&sort_type=desc`;
            let res = await fetchWithRetry(probe, 1, buildOsonishHeaders(),signal);
            if (hasOsonishAuthHeaders() && [401, 403, 404].includes(res.status)) {
                res = await fetchWithRetry(probe, 1, buildPublicOsonishHeaders(),signal);
            }
            if (isUsableProbeStatus(res.status)) {
                API_BASE = base;
                API_BASE_RESOLVED = true;
                return API_BASE;
            }
        } catch {
            if(signal?.aborted)throw new Error('Source request cancelled');
            // ignore and try next base
        }
    }

    API_BASE = 'https://osonish.uz/api/v1';
    API_BASE_RESOLVED = true;
    return API_BASE;
}

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Company contacts cache to avoid duplicate API calls
const companyContactsCache = new Map<number, {at:number;value:{phone?:string;email?:string;website?:string}}>();

/**
 * Fetch company details for fallback contact info (with caching)
 */
export async function fetchCompanyContacts(companyId: number,signal?:AbortSignal): Promise<{ phone?: string; email?: string; website?: string } | null> {
    // Check cache first
    const cached=companyContactsCache.get(companyId);
    if(cached&&Date.now()-cached.at<60000)return cached.value;

    try {
        const base = await ensureApiBase(signal);
        const url = `${base}/companies/${companyId}`;
        const response = await fetchWithRetry(url,1,buildOsonishHeaders(),signal);

        if (!response.ok) {
            return null;
        }

        const json = await response.json();
        const data = json.data;
        if (!data) {
            return null;
        }

        // Extract contacts
        // Priority: Top level phone -> Nested data.phone -> HR phone
        const text=(value:unknown)=>typeof value==='string'?value:undefined;
        const phone = text(data.phone || data.data?.phone || data.hrs?.[0]?.phone);
        const email = text(data.mail);
        const website = text(data.web_site);

        const result = { phone, email, website };
        if(companyContactsCache.size>=256)companyContactsCache.clear();
        companyContactsCache.set(companyId,{at:Date.now(),value:result});

        return result;
    } catch (e) {
        if(signal?.aborted)throw new Error('Source request cancelled');
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
async function fetchWithRetry(
    url: string,
    retries = MAX_RETRIES,
    headers: Record<string, string> = buildOsonishHeaders(),
    signal?:AbortSignal
): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        if(signal?.aborted)throw new Error('Source request cancelled');
        const controller=new AbortController(),abort=()=>controller.abort();
        signal?.addEventListener('abort',abort,{once:true});
        const timeout=setTimeout(abort,5000);
        try {
            const response = await fetch(url, {
                headers,signal:controller.signal,cache:'no-store'
            });
            // Include response-body delivery in the timeout. Returning only the
            // headers would leave a stalled JSON body running after the worker.
            if(Number(response.headers.get('content-length'))>4*1024*1024)throw new Error('Source response too large');
            const bytes=await boundedSourceBody(response,controller.signal);
            const buffered=new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
            clearTimeout(timeout);signal?.removeEventListener('abort',abort);

            // Rate limited - backoff
            if (response.status === 429) {
                const waitMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
                console.log(`Rate limited, waiting ${waitMs}ms...`);
                await sourceDelay(waitMs,signal);
                continue;
            }

            // Server error - retry
            if (response.status >= 500 && attempt < retries) {
                await sourceDelay(BACKOFF_BASE_MS * attempt,signal);
                continue;
            }

            return buffered;
        } catch (error) {
            controller.abort();
            if(signal?.aborted)throw new Error('Source request cancelled');
            if (attempt === retries) throw error;
            await sourceDelay(BACKOFF_BASE_MS * attempt,signal);
        } finally {
            clearTimeout(timeout);signal?.removeEventListener('abort',abort);
        }
    }
    throw new Error('Max retries exceeded');
}
async function boundedSourceBody(response:Response,signal:AbortSignal):Promise<Uint8Array>{
    if(!response.body)return new Uint8Array(0);
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
    const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
    try{
        for(;;){
            if(signal.aborted)throw new Error('Source request cancelled');
            const {done,value}=await reader.read();
            if(signal.aborted)throw new Error('Source request cancelled');
            if(done)break;
            length+=value.byteLength;if(length>4*1024*1024)throw new Error('Source response too large');
            chunks.push(value);
        }
        const bytes=new Uint8Array(length);let offset=0;
        for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
    }catch(error){cancel();throw error;}
    finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
}
function sourceDelay(ms:number,signal?:AbortSignal):Promise<void>{
    return new Promise((resolve,reject)=>{
        if(signal?.aborted){reject(new Error('Source request cancelled'));return;}
        const abort=()=>{clearTimeout(timer);reject(new Error('Source request cancelled'));};
        const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
        signal?.addEventListener('abort',abort,{once:true});
    });
}

/**
 * Step 1: Fetch vacancy IDs from list
 */
export async function fetchVacancyIdList(page: number = 1,signal?:AbortSignal): Promise<SourcePage> {
    try {
        const base = await ensureApiBase(signal);
        const basesToTry = [base, ...API_BASES.filter(b => b !== base)];

        let response: Response | null = null;
        for (const candidateBase of basesToTry) {
            const url = `${candidateBase}/vacancies?page=${page}&per_page=${PER_PAGE}&status=2&is_offer=0&sort_key=created_at&sort_type=desc`;
            const fallbackUrl = `${candidateBase}/vacancies?page=${page}&per_page=${PER_PAGE}&status=2&sort_key=created_at&sort_type=desc`;

            response = await fetchWithRetry(url,MAX_RETRIES,buildOsonishHeaders(),signal);
            if ([401, 403, 404].includes(response.status) && hasOsonishAuthHeaders()) {
                response = await fetchWithRetry(url, MAX_RETRIES, buildPublicOsonishHeaders(),signal);
            }
            if (!response.ok) {
                console.warn(`[Scraper] List fetch failed (${response.status}). Retrying without is_offer...`);
                response = await fetchWithRetry(fallbackUrl,MAX_RETRIES,buildOsonishHeaders(),signal);
                if ([401, 403, 404].includes(response.status) && hasOsonishAuthHeaders()) {
                    response = await fetchWithRetry(fallbackUrl, MAX_RETRIES, buildPublicOsonishHeaders(),signal);
                }
            }

            if (response.ok) {
                API_BASE = candidateBase;
                API_BASE_RESOLVED = true;
                break;
            }
        }

        if (!response || !response.ok) {
            console.warn(`[Scraper] List fetch failed (all bases) for page ${page}`);
            throw new Error('Source list unavailable');
        }

        const json = await response.json();
        if (json?.error) {
            console.warn('[Scraper] Source list blocked');
            throw new Error('Source list unavailable');
        }
        return parseSourcePage(json,page,PER_PAGE);
    } catch (error) {
        console.error('Error fetching source list');
        throw new Error('Source list unavailable');
    }
}

/**
 * Step 2: Fetch single vacancy detail
 */
export async function fetchVacancyDetail(id: number,signal?:AbortSignal): Promise<{
    success: boolean;
    detail?: OsonishDetail;
    status: number;
    error?: string;
}> {
    const base = await ensureApiBase(signal);
    const basesToTry = [base, ...API_BASES.filter(b => b !== base)];

    try {
        let response: Response | null = null;
        for (const candidateBase of basesToTry) {
            const url = `${candidateBase}/vacancies/${id}`;
            response = await fetchWithRetry(url,MAX_RETRIES,buildOsonishHeaders(),signal);
            if ([401, 403, 404].includes(response.status) && hasOsonishAuthHeaders()) {
                response = await fetchWithRetry(url, MAX_RETRIES, buildPublicOsonishHeaders(),signal);
            }
            if (![401, 403, 404].includes(response.status)) {
                API_BASE = candidateBase;
                API_BASE_RESOLVED = true;
                break;
            }
        }

        if (!response) {
            return { success: false, status: 0, error: 'No response' };
        }

        if (response.status === 404) {
            return { success: false, status: 404, error: 'Not found' };
        }

        if (!response.ok) {
            return { success: false, status: response.status, error: response.statusText };
        }

        const json: OsonishDetailResponse = await response.json();
        const detail=json.data;
        const numeric=(value:unknown)=>typeof value==='number'||typeof value==='string'&&/^\d+$/.test(value);
        if(json.success===false||!detail||Array.isArray(detail)||!numeric(detail.id)||!numeric(detail.status)||Number(detail.id)!==id||!Number.isSafeInteger(Number(detail.status))||Number(detail.status)<0) return {success:false,status:0,error:'Invalid vacancy detail'};
        return { success: true, detail:{...detail,id,status:Number(detail.status)}, status: 200 };
    } catch (error: any) {
        if(signal?.aborted)throw new Error('Source request cancelled');
        return { success: false, status: 0, error: 'Source detail unavailable' };
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
    let contact_phone = normalizePhone(detail.hr?.phone) || normalizePhone(detail.additional_phone);

    // HARDCODED FIX: Replace specific old phone number with new one
    if (contact_phone === '+998998588698') {
        contact_phone = '+998998088698';
        if (detail.hr && detail.hr.phone === '998998588698') detail.hr.phone = '998998088698';
        if (detail.additional_phone === '998998588698') detail.additional_phone = '998998088698';
    }
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
        region_name: detail.filial?.region?.name_uz || detail.filial?.region?.name_ru || detail.filial?.region?.name_en || undefined,
        district_name: detail.filial?.city?.name_uz || detail.filial?.city?.name_ru || detail.filial?.city?.name_en || undefined,
        latitude: parseCoordinate(detail.filial?.lat, 'latitude'),
        longitude: parseCoordinate(detail.filial?.long, 'longitude'),

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

    // A bounded, complete enumeration is required before any absence-based cleanup.
    const enumeration=await collectSourceIds(fetchVacancyIdList,maxPages,()=>sleep(200));
    const allIds=enumeration.ids;
    if(enumeration.error)debug.errors.push(enumeration.error);

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
                        // Count contacts once below after the fallback.
                    }
                }
            } catch (err) {
                // Ignore company fetch errors
            }
        }

        // Filter by contact
        if (transformed.has_contact) {
            debug.vacancies_with_contacts++;
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
        list_complete:enumeration.complete,
        list_total:enumeration.expectedTotal,
        listed_ids:allIds.map(String),
        vacancies,
        active_ids: activeIds,
        removed_ids: removedIds,
        filled_ids: filledIds,
        debug
    };
}

// ==================== LEGACY EXPORT ====================

export type { TransformedVacancy as ScrapedVacancy };

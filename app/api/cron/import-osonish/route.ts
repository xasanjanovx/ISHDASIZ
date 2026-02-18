import { NextRequest, NextResponse } from 'next/server';
import { scrapeOsonishFull } from '@/lib/scrapers/osonish';
import { mapOsonishCategory, OSONISH_GENDER_MAP, OSONISH_EDUCATION_MAP } from '@/lib/mappers/osonish-mapper';
import { getMappedValue } from '@/lib/mappings';
import { createClient } from '@supabase/supabase-js';
import { OSONISH_REGION_MAP, OSONISH_DISTRICT_MAP } from '@/lib/mappers/osonish-locations';

// Force dynamic to prevent static generation timeout
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for long-running import

// Service role client for import operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CRON_SECRET = process.env.CRON_SECRET;

// Code version
const CODE_VERSION = '2026-01-25-osonish-title-mapping-v3';

// ==================== CACHED LOOKUP ====================

interface RegionCache { id: number; name_uz: string; name_ru: string; slug: string; }
interface DistrictCache { id: number; name_uz: string; name_ru: string; region_id: number; }
interface CategoryCache { id: string; name_uz: string; name_ru: string; }
interface OsonishRegion { id: number; name_uz?: string; name_ru?: string; soato?: number; }
interface OsonishCity { id: number; name_uz?: string; name_ru?: string; region_id?: number; soato_region?: number; soato?: number; }
interface ProfessionAccumulator {
    id: number;
    title_uz: string;
    title_ru: string | null;
    category_id: string | null;
    category_title: string | null;
    vacancies_count: number;
}

type RegionType = 'city' | 'region' | 'republic' | null;
type DistrictType = 'city' | 'district' | null;

interface RegionCacheNorm extends RegionCache {
    normsFull: string[];
    normsLoose: string[];
    slugNorm: string;
    type: RegionType;
}

interface DistrictCacheNorm extends DistrictCache {
    normsFull: string[];
    normsLoose: string[];
    type: DistrictType;
}

let regionsCache: RegionCache[] = [];
let districtsCache: DistrictCache[] = [];
let categoriesCache: CategoryCache[] = [];

let regionsCacheNorm: RegionCacheNorm[] = [];
let districtsCacheNorm: DistrictCacheNorm[] = [];

// Runtime maps for OsonIsh -> ISHDASIZ IDs (built by name)
let runtimeRegionMap: Map<string, number> = new Map();
let runtimeDistrictMap: Map<string, number> = new Map();
let importRunActive = false;
let importRunStartedAt = 0;

const trimOsonishBase = (value: string) => value.replace(/\/+$/, '');
const buildOsonishBaseCandidates = (value: string): string[] => {
    const cleaned = trimOsonishBase(value);
    if (!cleaned) return [];
    if (cleaned.endsWith('/api/api/v1')) return [cleaned, cleaned.replace('/api/api/v1', '/api/v1')];
    if (cleaned.endsWith('/api/v1')) return [cleaned, cleaned.replace('/api/v1', '/api/api/v1')];
    return [`${cleaned}/api/v1`, `${cleaned}/api/api/v1`];
};
const OSONISH_API_BASE_ENV = process.env.OSONISH_API_BASE?.trim();
const OSONISH_API_BASES = Array.from(new Set([
    'https://osonish.uz/api/v1',
    'https://osonish.uz/api/api/v1',
    ...(OSONISH_API_BASE_ENV ? buildOsonishBaseCandidates(OSONISH_API_BASE_ENV) : [])
]));
let OSONISH_API_BASE = OSONISH_API_BASES[0] || 'https://osonish.uz/api/v1';
let OSONISH_API_BASE_RESOLVED = false;
const OSONISH_HEADERS: Record<string, string> = {
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
const OSONISH_COOKIE = process.env.OSONISH_COOKIE;
const OSONISH_TOKEN = process.env.OSONISH_BEARER_TOKEN || process.env.OSONISH_API_TOKEN;
const OSONISH_USER_ID = process.env.OSONISH_USER_ID || process.env.OSONISH_CURRENT_USER_ID;
if (OSONISH_COOKIE) OSONISH_HEADERS.Cookie = OSONISH_COOKIE;
if (OSONISH_TOKEN) OSONISH_HEADERS.Authorization = OSONISH_TOKEN.startsWith('Bearer ') ? OSONISH_TOKEN : `Bearer ${OSONISH_TOKEN}`;
if (OSONISH_USER_ID) OSONISH_HEADERS['x-current-user-id'] = OSONISH_USER_ID;
const OSONISH_HAS_AUTH_HEADERS = Boolean(OSONISH_COOKIE || OSONISH_TOKEN || OSONISH_USER_ID);
const OSONISH_PUBLIC_HEADERS = Object.fromEntries(
    Object.entries(OSONISH_HEADERS).filter(([key]) => !['Cookie', 'Authorization', 'x-current-user-id'].includes(key))
) as Record<string, string>;

async function fetchWithHeaderFallback(url: string): Promise<Response> {
    let response = await fetch(url, { headers: OSONISH_HEADERS });
    // Some expired auth headers can cause 403/404 on Osonish; retry publicly.
    if (OSONISH_HAS_AUTH_HEADERS && [401, 403, 404].includes(response.status)) {
        const publicResponse = await fetch(url, { headers: OSONISH_PUBLIC_HEADERS });
        if (publicResponse.ok || ![401, 403, 404].includes(publicResponse.status)) {
            response = publicResponse;
        }
    }
    return response;
}

async function resolveOsonishBase(): Promise<string> {
    if (OSONISH_API_BASE_RESOLVED) return OSONISH_API_BASE;
    const isUsableProbeStatus = (status: number) => {
        if ([401, 403, 404].includes(status)) return false;
        return status >= 200 && status < 500;
    };

    for (const base of OSONISH_API_BASES) {
        try {
            // Probe vacancies endpoint as primary signal; regions can be blocked in some contexts.
            const probe = `${base}/vacancies?page=1&per_page=1&status=2&sort_key=created_at&sort_type=desc`;
            const res = await fetchWithHeaderFallback(probe);
            if (isUsableProbeStatus(res.status)) {
                OSONISH_API_BASE = base;
                OSONISH_API_BASE_RESOLVED = true;
                return OSONISH_API_BASE;
            }
        } catch {
            // ignore and try next base
        }
    }

    OSONISH_API_BASE = 'https://osonish.uz/api/v1';
    OSONISH_API_BASE_RESOLVED = true;
    return OSONISH_API_BASE;
}

async function fetchOsonish(path: string): Promise<Response> {
    const base = await resolveOsonishBase();
    let response = await fetchWithHeaderFallback(`${base}${path}`);
    if ([401, 403, 404].includes(response.status)) {
        for (const alt of OSONISH_API_BASES) {
            if (alt === base) continue;
            const altResponse = await fetchWithHeaderFallback(`${alt}${path}`);
            if (![401, 403, 404].includes(altResponse.status)) {
                OSONISH_API_BASE = alt;
                OSONISH_API_BASE_RESOLVED = true;
                response = altResponse;
                break;
            }
        }
    }
    return response;
}

let osonishRegionById: Map<number, OsonishRegion> = new Map();
let osonishCityById: Map<number, OsonishCity> = new Map();
let osonishRegionBySoato: Map<number, OsonishRegion> = new Map();
let osonishCityBySoato: Map<number, OsonishCity> = new Map();

async function loadOsonishGeoCache(): Promise<void> {
    if (osonishRegionById.size > 0) return;

    try {
        const res = await fetchOsonish(`/regions`);
        if (!res.ok) {
            console.warn(`[OSONISH] Failed to fetch regions: ${res.status} ${res.statusText}`);
            return;
        }
        const json = await res.json();
        if (json?.error) {
            console.warn(`[OSONISH] Regions fetch blocked: ${json.error}`);
            return;
        }
        const rawRegions = Array.isArray(json?.data)
            ? json.data
            : (Array.isArray(json?.data?.data) ? json.data.data : []);
        const regions: OsonishRegion[] = rawRegions || [];
        regions.forEach(region => {
            if (region?.id) osonishRegionById.set(region.id, region);
            if (region?.soato) osonishRegionBySoato.set(Number(region.soato), region);
        });

        // Fetch cities per region (by soato if available)
        const cityPromises = regions.map(async (region) => {
            const soato = region?.soato;
            if (!soato) return;
            const cityRes = await fetchOsonish(`/cities?region_soato=${soato}`);
            if (!cityRes.ok) return;
            const cityJson = await cityRes.json();
            const rawCities = Array.isArray(cityJson?.data)
                ? cityJson.data
                : (Array.isArray(cityJson?.data?.data) ? cityJson.data.data : []);
            const cities: OsonishCity[] = rawCities || [];
            cities.forEach(city => {
                if (city?.id) {
                    osonishCityById.set(city.id, {
                        ...city,
                        region_id: city.region_id ?? region.id,
                        soato_region: region.soato
                    });
                }
                if (city?.soato) {
                    osonishCityBySoato.set(Number(city.soato), {
                        ...city,
                        region_id: city.region_id ?? region.id,
                        soato_region: region.soato
                    });
                }
            });
        });

        await Promise.all(cityPromises);
        console.log(`[OSONISH] Geo cache: ${osonishRegionById.size} regions, ${osonishCityById.size} cities`);
    } catch (err) {
        console.warn('[OSONISH] Failed to load OsonIsh geo cache', err);
    }
}

async function loadCache(): Promise<void> {
    if (regionsCache.length > 0) return;

    const [regionsRes, districtsRes, categoriesRes] = await Promise.all([
        supabaseAdmin.from('regions').select('id, name_uz, name_ru, slug'),
        supabaseAdmin.from('districts').select('id, name_uz, name_ru, region_id'),
        supabaseAdmin.from('categories').select('id, name_uz, name_ru')
    ]);

    regionsCache = regionsRes.data || [];
    districtsCache = districtsRes.data || [];
    categoriesCache = categoriesRes.data || [];

    regionsCacheNorm = regionsCache.map(buildRegionNorm);
    districtsCacheNorm = districtsCache.map(buildDistrictNorm);

    console.log(`[OSONISH] Cache: ${regionsCache.length} regions, ${districtsCache.length} districts, ${categoriesCache.length} categories`);
}

function buildRuntimeGeoMaps(): void {
    runtimeRegionMap = new Map();
    runtimeDistrictMap = new Map();

    if (osonishRegionById.size === 0 || regionsCacheNorm.length === 0) {
        return;
    }

    for (const region of Array.from(osonishRegionById.values())) {
        const name = region?.name_uz || region?.name_ru;
        if (!name) continue;
        const mapped = lookupRegionId(name);
        if (mapped) {
            runtimeRegionMap.set(String(region.id), mapped);
            if (region.soato) runtimeRegionMap.set(`soato:${region.soato}`, mapped);
        }
    }

    for (const city of Array.from(osonishCityById.values())) {
        const name = city?.name_uz || city?.name_ru;
        if (!name) continue;
        let mappedRegionId: number | null = null;
        if (city.region_id) {
            mappedRegionId = runtimeRegionMap.get(String(city.region_id)) ?? null;
        }
        if (!mappedRegionId && city.soato_region) {
            mappedRegionId = runtimeRegionMap.get(`soato:${city.soato_region}`) ?? null;
        }

        const mappedDistrict = lookupDistrictId(name, mappedRegionId ?? undefined) || lookupDistrictId(name);
        if (mappedDistrict) {
            runtimeDistrictMap.set(String(city.id), mappedDistrict);
            if (city.soato) runtimeDistrictMap.set(`soato:${city.soato}`, mappedDistrict);
        }
    }

    console.log(`[OSONISH] Runtime geo map built: ${runtimeRegionMap.size} regions, ${runtimeDistrictMap.size} districts`);
}

// ==================== GEO NORMALIZATION ====================

const GEO_FIXES: Record<string, string> = {
    'shaxrisabz': 'shahrisabz',
    'shaxrisabs': 'shahrisabz',
    'kattakurgan': 'kattaqorgon',
    'kattaqurgon': 'kattaqorgon',
    'yangiyul': 'yangiyol',
    'qungirot': 'qongirot',
    'kungrad': 'qongirot',
    'shumanay': 'shomanay',
    'muynoq': 'moynoq',
    'muynak': 'moynoq',
    'tortkol': 'tortkol',
    'turtkul': 'tortkol',
    'xojayli': 'xojayli',
    'khodjeyli': 'xojayli',
    'qoraqolpogiston': 'qoraqalpogiston',
    'karakalpakstan': 'qoraqalpogiston',
    'shayxontoxur': 'shayxontohur',
    'qoshrabod': 'qoshrabot',
    'dexqonobod': 'dehqonobod',
    'navbaxor': 'navbahor',
    'qonlikol': 'qanlikol',
    'taxtakoprik': 'taxtakopir',
    'bogdod': 'bagdod',
    'yangi hayot': 'yangihayot',
};

const GEO_ALIASES: Record<string, string> = {
    'tashkent': 'toshkent',
    'ташкент': 'toshkent',
    'andijan': 'andijon',
    'андижан': 'andijon',
    'bukhara': 'buxoro',
    'бухара': 'buxoro',
    'fergana': 'fargona',
    'фергана': 'fargona',
    'jizzakh': 'jizzax',
    'джизак': 'jizzax',
    'khorezm': 'xorazm',
    'хорезм': 'xorazm',
    'navoi': 'navoiy',
    'навои': 'navoiy',
    'kashkadarya': 'qashqadaryo',
    'кашкадарья': 'qashqadaryo',
    'samarkand': 'samarqand',
    'самарканд': 'samarqand',
    'syrdarya': 'sirdaryo',
    'сырдарья': 'sirdaryo',
    'surkhandarya': 'surxondaryo',
    'сурхандарья': 'surxondaryo',
    'karakalpakstan': 'qoraqalpogiston',
    'каракалпакстан': 'qoraqalpogiston',
};

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyReplaceMap(value: string, map: Record<string, string>): string {
    let updated = value;
    for (const [from, to] of Object.entries(map)) {
        const pattern = new RegExp(`(^|\\s)${escapeRegExp(from)}(?=\\s|$)`, 'g');
        updated = updated.replace(pattern, `$1${to}`);
    }
    return updated;
}

function normalizeGeoName(value: string): string {
    if (!value) return '';
    let text = value.toLowerCase().trim();

    // Expand common abbreviations before stripping punctuation
    text = text
        .replace(/\bsh\.\b/g, 'shahri')
        .replace(/\bshah\.\b/g, 'shahri')
        .replace(/\bsh\b/g, 'shahri')
        .replace(/\bvil\.\b/g, 'viloyati')
        .replace(/\bvil\b/g, 'viloyati')
        .replace(/\bobl\.\b/g, 'oblast')
        .replace(/\bobl\b/g, 'oblast')
        .replace(/обл\./g, 'область')
        .replace(/(^|\s)г\.(?=\s|$)/g, ' город ')
        .replace(/(^|\s)г(?=\s|$)/g, ' город ')
        .replace(/р-?н/g, 'район');

    text = text
        .replace(/[\u2018\u2019\u00B4\u02BB\u02BC]/g, "'")
        .replace(/["\u201C\u201D\u00AB\u00BB]/g, '')
        .replace(/['`]/g, '')
        .replace(/[()]/g, ' ')
        .replace(/[^0-9a-z\u0400-\u04FF]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    text = applyReplaceMap(text, GEO_FIXES);
    text = applyReplaceMap(text, GEO_ALIASES);

    return text;
}

function stripGeoTypeTokens(value: string): string {
    return value
        .replace(/(^|\s)(shahri|shahar|gorod|город|city|tuman|tumani|rayon|район|viloyat|viloyati|oblast|область|respublika|respublikasi|republic|республика)(?=\s|$)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function detectGeoType(value: string): { hasCity: boolean; hasRegion: boolean; hasDistrict: boolean } {
    const normalized = normalizeGeoName(value);
    return {
        hasCity: /(^|\s)(shahri|shahar|gorod|город|city)(?=\s|$)/.test(normalized),
        hasRegion: /(^|\s)(viloyat|viloyati|oblast|область|respublika|respublikasi|republic|республика)(?=\s|$)/.test(normalized),
        hasDistrict: /(^|\s)(tuman|tumani|rayon|район)(?=\s|$)/.test(normalized),
    };
}

function buildRegionNorm(region: RegionCache): RegionCacheNorm {
    const normUz = normalizeGeoName(region.name_uz);
    const normRu = normalizeGeoName(region.name_ru);
    const normsFull = [normUz, normRu].filter(Boolean);
    const normsLoose = normsFull.map(stripGeoTypeTokens).filter(Boolean);
    const slugNorm = normalizeGeoName(region.slug.replace(/-/g, ' '));

    let type: RegionType = null;
    if (region.slug.includes('shahri')) type = 'city';
    else if (region.slug.includes('viloyati')) type = 'region';
    else if (region.slug.includes('respublikasi')) type = 'republic';

    return {
        ...region,
        normsFull,
        normsLoose,
        slugNorm,
        type
    };
}

function buildDistrictNorm(district: DistrictCache): DistrictCacheNorm {
    const normUz = normalizeGeoName(district.name_uz);
    const normRu = normalizeGeoName(district.name_ru);
    const normsFull = [normUz, normRu].filter(Boolean);
    const normsLoose = normsFull.map(stripGeoTypeTokens).filter(Boolean);

    let type: DistrictType = null;
    if (normsFull.some(n => /(^|\s)(shahri|shahar|gorod|город)(?=\s|$)/.test(n))) type = 'city';
    else if (normsFull.some(n => /(^|\s)(tuman|tumani|rayon|район)(?=\s|$)/.test(n))) type = 'district';

    return {
        ...district,
        normsFull,
        normsLoose,
        type
    };
}

function findRegionBySlug(slug: string): RegionCacheNorm | undefined {
    const needle = slug.toLowerCase();
    return regionsCacheNorm.find(r => r.slug.toLowerCase() === needle);
}

function lookupRegionId(regionName?: string): number | null {
    if (!regionName || regionsCacheNorm.length === 0) return null;

    const normalizedFull = normalizeGeoName(regionName);
    const normalizedLoose = stripGeoTypeTokens(normalizedFull);
    const flags = detectGeoType(regionName);

    // Special handling: Toshkent city vs region
    if (normalizedFull.includes('toshkent')) {
        if (flags.hasCity) return findRegionBySlug('toshkent-shahri')?.id ?? null;
        if (flags.hasRegion) return findRegionBySlug('toshkent-viloyati')?.id ?? null;
        // If ambiguous, prefer city first (more common in vacancy data)
        return findRegionBySlug('toshkent-shahri')?.id ?? findRegionBySlug('toshkent-viloyati')?.id ?? null;
    }

    // Exact match by full normalized name or slug
    const exact = regionsCacheNorm.find(r =>
        r.normsFull.includes(normalizedFull) || r.slugNorm === normalizedFull
    );
    if (exact) return exact.id;

    // Loose match without type tokens
    const candidates = regionsCacheNorm.filter(r => normalizedLoose && r.normsLoose.includes(normalizedLoose));
    if (candidates.length === 1) return candidates[0].id;

    if (candidates.length > 1) {
        if (flags.hasCity) {
            const city = candidates.find(r => r.type === 'city');
            if (city) return city.id;
        }
        if (flags.hasRegion) {
            const region = candidates.find(r => r.type === 'region' || r.type === 'republic');
            if (region) return region.id;
        }
        console.warn(`[OSONISH] Region ambiguous: "${regionName}" -> ${candidates.map(c => c.name_uz).join(', ')}`);
        return null;
    }

    console.warn(`[OSONISH] Region not found: "${regionName}" (norm: ${normalizedFull})`);
    return null;
}

function lookupDistrictId(districtName?: string, regionId?: number | null): number | null {
    if (!districtName || districtsCacheNorm.length === 0) return null;

    const normalizedFull = normalizeGeoName(districtName);
    const normalizedLoose = stripGeoTypeTokens(normalizedFull);
    const flags = detectGeoType(districtName);

    const search = (list: DistrictCacheNorm[]): number | null => {
        const exact = list.find(d => d.normsFull.includes(normalizedFull));
        if (exact) return exact.id;

        const looseMatches = list.filter(d => normalizedLoose && d.normsLoose.includes(normalizedLoose));
        if (looseMatches.length === 1) return looseMatches[0].id;

        if (looseMatches.length > 1) {
            if (flags.hasCity) {
                const city = looseMatches.find(d => d.type === 'city');
                if (city) return city.id;
            }
            if (flags.hasDistrict) {
                const district = looseMatches.find(d => d.type === 'district');
                if (district) return district.id;
            }
            console.warn(`[OSONISH] District ambiguous: "${districtName}" (region_id: ${regionId ?? 'any'})`);
            return null;
        }

        return null;
    };

    const candidates = regionId
        ? districtsCacheNorm.filter(d => d.region_id === regionId)
        : districtsCacheNorm;

    const primary = search(candidates);
    if (primary) return primary;

    // Fallback: if region-limited search failed, try global
    if (regionId) {
        return search(districtsCacheNorm);
    }

    return null;
}

function findRegionIdInText(text?: string): number | null {
    if (!text) return null;
    const normalized = normalizeGeoName(text);
    let best: { id: number; len: number } | null = null;
    for (const region of regionsCacheNorm) {
        const candidates = [...region.normsFull, ...region.normsLoose].filter(Boolean);
        for (const candidate of candidates) {
            if (candidate.length < 4) continue;
            if (normalized.includes(candidate)) {
                if (!best || candidate.length > best.len) {
                    best = { id: region.id, len: candidate.length };
                }
            }
        }
    }
    return best?.id ?? null;
}

function findDistrictIdInText(text?: string, regionId?: number | null): number | null {
    if (!text) return null;
    const normalized = normalizeGeoName(text);
    const pool = regionId
        ? districtsCacheNorm.filter(d => d.region_id === regionId)
        : districtsCacheNorm;
    let best: { id: number; len: number } | null = null;
    for (const district of pool) {
        const candidates = [...district.normsFull, ...district.normsLoose].filter(Boolean);
        for (const candidate of candidates) {
            if (candidate.length < 4) continue;
            if (normalized.includes(candidate)) {
                if (!best || candidate.length > best.len) {
                    best = { id: district.id, len: candidate.length };
                }
            }
        }
    }
    return best?.id ?? null;
}

// ==================== FIELD NORMALIZATION ====================

const EMPLOYMENT_TYPES = new Set(['full_time', 'part_time', 'contract', 'internship', 'remote']);

function mapEmploymentTypeFromRaw(busynessType?: number): string {
    const map: Record<number, string> = {
        1: 'full_time',   // Doimiy
        2: 'contract',    // Muddatli
        3: 'contract',    // Mavsumiy
        4: 'internship'   // Stajirovka/Amaliyot
    };
    return busynessType ? (map[busynessType] || 'full_time') : 'full_time';
}

function mapWorkModeFromRaw(workType?: number): string | null {
    const map: Record<number, string> = {
        1: 'onsite',
        2: 'remote',
        3: 'remote',
        4: 'hybrid'
    };
    return workType ? (map[workType] || null) : null;
}

function normalizeEmploymentType(value: string | undefined, raw: any): string {
    if (value && EMPLOYMENT_TYPES.has(value)) return value;
    const rawBusyness = typeof raw?.busyness_type === 'number' ? raw.busyness_type : undefined;
    return mapEmploymentTypeFromRaw(rawBusyness);
}

function normalizeWorkMode(value: string | null | undefined, raw: any): string | null {
    if (typeof value === 'string' && value.trim().length > 0) return value;
    const rawWorkType = typeof raw?.work_type === 'number' ? raw.work_type : undefined;
    return mapWorkModeFromRaw(rawWorkType);
}

function normalizeSalaryValue(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.round(num);
}

function normalizeSalaryRange(minValue: unknown, maxValue: unknown): { min: number | null; max: number | null } {
    let min = normalizeSalaryValue(minValue);
    let max = normalizeSalaryValue(maxValue);
    if (min !== null && max !== null && min > max) {
        const tmp = min;
        min = max;
        max = tmp;
    }
    return { min, max };
}

/**
 * Convert benefit_ids array to localized text string
 * This maps OsonIsh "Ijtimoiy paketlar" to our "Qulayliklar" field
 */


function mapExperienceToCode(rawId: number | undefined, years: number | null | undefined): string {
    // 1. Try ID from OsonIsh - return as string ID
    if (typeof rawId === 'number' && rawId >= 1 && rawId <= 5) {
        return String(rawId);
    }
    // 2. Fallback to years count -> map to OsonIsh IDs
    if (typeof years === 'number') {
        if (years === 0) return '1';      // Talab etilmaydi
        if (years <= 1) return '2';       // 1 yilgacha
        if (years <= 3) return '3';       // 1-3 yil
        if (years <= 5) return '4';       // 3-5 yil
        return '5';                       // 5 yildan ortiq
    }
    return '1'; // Default: Talab etilmaydi
}

function mapEducationToCode(rawId: number | undefined, rawLevel: string | null | undefined): string | null {
    // 1. Try ID from OsonIsh
    if (typeof rawId === 'number') {
        if (rawId === 1) return 'secondary'; // O'rta
        if (rawId === 2) return 'vocational'; // O'rta-maxsus
        if (rawId === 3) return 'higher'; // Oliy
        if (rawId === 4) return 'master'; // Magistr
        if (rawId === 5) return 'higher'; // PhD -> Higher
        return 'any';
    }
    // 2. Fallback to string matching
    if (!rawLevel) return 'any';
    const l = rawLevel.toLowerCase();
    if (l.includes('oliy') || l.includes('высшее') || l.includes('higher') || l.includes('bachelor') || l.includes('bakalavr')) return 'higher';
    if (l.includes('o\'rta maxsus') || l.includes('sredne') || l.includes('vocational') || l.includes('kollej')) return 'vocational';
    if (l.includes('o\'rta') || l.includes('srednee') || l.includes('secondary') || l.includes('maktab')) return 'secondary';
    if (l.includes('magistr') || l.includes('master')) return 'master';
    return 'any';
}

function convertBenefitsToText(benefitIds: number[] | undefined, lang: 'uz' | 'ru' = 'uz'): string | null {
    if (!benefitIds || benefitIds.length === 0) return null;

    const benefitLabels = benefitIds
        .map(id => getMappedValue('benefits', id, lang))
        .filter(Boolean);

    return benefitLabels.length > 0 ? benefitLabels.join(', ') : null;
}

async function upsertBatchWithRetry(chunk: any[], retries = 3): Promise<{ error: any }> {
    for (let i = 0; i < retries; i++) {
        try {
            const { error } = await supabaseAdmin.from('jobs').upsert(chunk, {
                onConflict: 'source,source_id',
                ignoreDuplicates: false
            });
            if (!error) return { error: null };

            console.warn(`[OSONISH] Batch upsert error (attempt ${i + 1}/${retries}): ${error.message}`);
            // If it's a fetch error, we definitely want to retry. 
            // If it's a Postgres error (e.g. invalid type), it might not help, but safer to retry transient issues.

            if (i === retries - 1) return { error };
        } catch (err: any) {
            console.warn(`[OSONISH] Batch upsert exception (attempt ${i + 1}/${retries}): ${err.message}`);
            if (i === retries - 1) return { error: { message: err.message } };
        }
        // Exponential backoff: 200ms, 400ms, 800ms
        await new Promise(r => setTimeout(r, 200 * Math.pow(2, i)));
    }
    return { error: { message: 'Max retries reached' } };
}




/**
 * GET /api/cron/import-osonish
 *
 * OsonIsh-only import - NO AI PROCESSING
 * All data comes directly from OsonIsh API in structured format
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production' && CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({
            success: false,
            source: 'osonish',
            message: 'Unauthorized'
        }, { status: 401 });
    }

    if (importRunActive) {
        return NextResponse.json({
            success: false,
            source: 'osonish',
            message: 'Import already running',
            running_ms: Date.now() - importRunStartedAt
        }, { status: 409 });
    }

    importRunActive = true;
    importRunStartedAt = Date.now();
    try {
        console.log('[OSONISH] Starting OsonIsh-only import (no AI)...');
        const startTime = Date.now();

        // FORCE REFRESH CACHE (Clear module-level variables)
        // This is critical because sync-strict might have deleted IDs while this process was running
        regionsCache = [];
        districtsCache = [];
        categoriesCache = [];
        regionsCacheNorm = [];
        districtsCacheNorm = [];
        runtimeRegionMap = new Map();
        runtimeDistrictMap = new Map();

        // NOTE: We no longer clear all region/district references.
        // It caused massive nulling and broke region filters when mapping failed.

        // Load lookup cache (will re-fetch from DB)
        await loadCache();
        await loadOsonishGeoCache();
        buildRuntimeGeoMaps();

        // Create import log
        const { data: logEntry } = await supabaseAdmin
            .from('import_logs')
            .insert({
                source: 'osonish',
                triggered_by: 'cron',
                operation_type: 'import',
                status: 'running'
            })
            .select('id')
            .single();

        const logId = logEntry?.id;

        // ==================== SCRAPE OSONISH ====================

        const result = await scrapeOsonishFull(500, false);

        console.log(`[OSONISH] Scraped ${result.vacancies.length} vacancies with contacts`);

        // ==================== IMPORT TO DATABASE ====================

        let stats = { newImported: 0, updated: 0, errors: 0 };
        const runStartedAt = new Date().toISOString();
        const now = runStartedAt;

        // ...

        const validJobs: any[] = [];
        const professionsMap = new Map<number, ProfessionAccumulator>();

        for (const vacancy of result.vacancies) {
            try {
                const raw = (vacancy.raw_source_json as any) || {};

                // 1. LOCATION MAPPING - ID PRIORITY (Verified Compatible)
                let regionId: number | null = null;
                let districtId: number | null = null;

                let rawRegionId = raw.filial?.region?.id ?? raw.region?.id ?? raw.region_id ?? null;
                let rawDistrictId = raw.filial?.city?.id ?? raw.city?.id ?? raw.city_id ?? null;
                const rawRegionSoato = raw.filial?.soato_region ?? raw.filial?.region?.soato ?? raw.region?.soato ?? null;
                const rawDistrictSoato = raw.filial?.soato_district ?? raw.filial?.city?.soato ?? raw.city?.soato ?? null;

                let rawRegionName = vacancy.region_name
                    || raw.filial?.region?.name_uz
                    || raw.filial?.region?.name_ru
                    || raw.region?.name_uz
                    || raw.region?.name_ru
                    || null;

                let rawDistrictName = vacancy.district_name
                    || raw.filial?.city?.name_uz
                    || raw.filial?.city?.name_ru
                    || raw.city?.name_uz
                    || raw.city?.name_ru
                    || null;

                const rawAddress = raw.filial?.address || raw.address || vacancy.address || null;

                // Fill missing names from OsonIsh geo cache if IDs exist
                const osonishRegion = rawRegionId ? osonishRegionById.get(Number(rawRegionId)) : null;
                if (!rawRegionName && osonishRegion) {
                    rawRegionName = osonishRegion.name_uz || osonishRegion.name_ru || null;
                }

                const osonishCity = rawDistrictId ? osonishCityById.get(Number(rawDistrictId)) : null;
                if (!rawDistrictName && osonishCity) {
                    rawDistrictName = osonishCity.name_uz || osonishCity.name_ru || null;
                }

                // Fill missing names/ids from SOATO maps if present
                const soatoRegion = rawRegionSoato ? osonishRegionBySoato.get(Number(rawRegionSoato)) : null;
                if (!rawRegionName && soatoRegion) {
                    rawRegionName = soatoRegion.name_uz || soatoRegion.name_ru || null;
                }
                if (!rawRegionId && soatoRegion?.id) {
                    rawRegionId = soatoRegion.id;
                }

                const soatoCity = rawDistrictSoato ? osonishCityBySoato.get(Number(rawDistrictSoato)) : null;
                if (!rawDistrictName && soatoCity) {
                    rawDistrictName = soatoCity.name_uz || soatoCity.name_ru || null;
                }
                if (!rawDistrictId && soatoCity?.id) {
                    rawDistrictId = soatoCity.id;
                }

                // A. Try strict OsonIsh ID mapping (only if it exists in our DB)
                if (rawRegionId && rawRegionName) {
                    const mapped = OSONISH_REGION_MAP[String(rawRegionId)];
                    if (mapped) {
                        const mappedRegion = regionsCacheNorm.find(r => r.id === mapped);
                        if (mappedRegion) {
                            const rawNorm = stripGeoTypeTokens(normalizeGeoName(rawRegionName));
                            const matches = mappedRegion.normsLoose.includes(rawNorm) || mappedRegion.normsFull.includes(normalizeGeoName(rawRegionName));
                            if (matches) regionId = mapped;
                        }
                    }
                }

                if (rawDistrictId && rawDistrictName) {
                    const mapped = OSONISH_DISTRICT_MAP[String(rawDistrictId)];
                    if (mapped) {
                        const mappedDistrict = districtsCacheNorm.find(d => d.id === mapped);
                        if (mappedDistrict) {
                            const rawNorm = stripGeoTypeTokens(normalizeGeoName(rawDistrictName));
                            const matches = mappedDistrict.normsLoose.includes(rawNorm) || mappedDistrict.normsFull.includes(normalizeGeoName(rawDistrictName));
                            if (matches) districtId = mapped;
                        }
                    }
                }

                // A2. Runtime SOATO mapping (if available)
                if (!regionId && rawRegionSoato) {
                    const cached = runtimeRegionMap.get(`soato:${rawRegionSoato}`);
                    if (cached) regionId = cached;
                }
                if (!districtId && rawDistrictSoato) {
                    const cached = runtimeDistrictMap.get(`soato:${rawDistrictSoato}`);
                    if (cached) districtId = cached;
                }

                // B. Runtime mapping by OsonIsh ID + name
                if (!regionId && rawRegionId) {
                    const cached = runtimeRegionMap.get(String(rawRegionId));
                    if (cached) {
                        regionId = cached;
                    } else if (rawRegionName) {
                        const mapped = lookupRegionId(rawRegionName);
                        if (mapped) {
                            runtimeRegionMap.set(String(rawRegionId), mapped);
                            regionId = mapped;
                        }
                    }
                }

                if (!districtId && rawDistrictId) {
                    const cached = runtimeDistrictMap.get(String(rawDistrictId));
                    if (cached) {
                        districtId = cached;
                    } else if (rawDistrictName) {
                        const mapped = lookupDistrictId(rawDistrictName, regionId ?? undefined);
                        if (mapped) {
                            runtimeDistrictMap.set(String(rawDistrictId), mapped);
                            districtId = mapped;
                        }
                    }
                }

                // If region is still missing, try deriving from city -> region mapping
                if (!regionId && osonishCity?.region_id) {
                    const cityRegion = osonishRegionById.get(osonishCity.region_id);
                    if (cityRegion) {
                        const mapped = lookupRegionId(cityRegion.name_uz || cityRegion.name_ru || '');
                        if (mapped) {
                            regionId = mapped;
                            if (rawRegionId) runtimeRegionMap.set(String(rawRegionId), mapped);
                        }
                    }
                }

                // C. Fallback to name lookup
                if (!regionId && rawRegionName) {
                    regionId = lookupRegionId(rawRegionName);
                    if (regionId && rawRegionId) {
                        runtimeRegionMap.set(String(rawRegionId), regionId);
                    }
                }

                if (!districtId && rawDistrictName) {
                    districtId = lookupDistrictId(rawDistrictName, regionId ?? undefined);
                    if (districtId && rawDistrictId) {
                        runtimeDistrictMap.set(String(rawDistrictId), districtId);
                    }
                }

                // D. Derive region from district if still missing
                if (!regionId && districtId) {
                    const districtMatch = districtsCacheNorm.find(d => d.id === districtId);
                    if (districtMatch?.region_id) {
                        regionId = districtMatch.region_id;
                    }
                }

                // E. Last resort: attempt to extract from address text
                if (!regionId && rawAddress) {
                    regionId = findRegionIdInText(rawAddress);
                }
                if (!districtId && rawAddress) {
                    districtId = findDistrictIdInText(rawAddress, regionId ?? undefined);
                }

                if (!regionId && districtId) {
                    const districtMatch = districtsCacheNorm.find(d => d.id === districtId);
                    if (districtMatch?.region_id) {
                        regionId = districtMatch.region_id;
                    }
                }

                if (!regionId) {
                    stats.errors++;
                }

                const regionInfo = regionId ? regionsCacheNorm.find(r => r.id === regionId) : null;
                const districtInfo = districtId ? districtsCacheNorm.find(d => d.id === districtId) : null;
                const resolvedRegionName = regionInfo?.name_uz || rawRegionName || vacancy.region_name || null;
                const resolvedDistrictName = districtInfo?.name_uz || rawDistrictName || vacancy.district_name || null;

                // Map Category STRICTLY by OsonIsh category group if available
                let sourceCategoryName = '';
                if (raw.mmk_group?.cat2) {
                    sourceCategoryName = raw.mmk_group.cat2;
                } else if (raw.mmk_group?.cat1) {
                    sourceCategoryName = raw.mmk_group.cat1;
                }

                // Map using source category name first, fallback to title
                const mappingResult = mapOsonishCategory(sourceCategoryName, null, vacancy.title);

                // Find matching category from DB cache
                let categoryId: string | null = null;
                if (mappingResult) {
                    const categoryNameToFind = mappingResult.categoryName.toLowerCase();

                    // 1. Try DIRECT MATCH by ID (if mapper returned a known GUID that exists in our DB)
                    const directIdMatch = categoriesCache.find(c => c.id === mappingResult.categoryId);
                    if (directIdMatch) {
                        categoryId = directIdMatch.id;
                    }
                    else {
                        // 2. Fallback to name partial match
                        const matchedCategory = categoriesCache.find(c =>
                            c.name_uz.toLowerCase().includes(categoryNameToFind) ||
                            categoryNameToFind.includes(c.name_uz.toLowerCase().split(' ')[0]) ||
                            (c.name_ru && c.name_ru.toLowerCase().includes(categoryNameToFind))
                        );
                        if (matchedCategory) {
                            categoryId = matchedCategory.id;
                        }
                    }
                }

                const mmkIdRaw = raw?.mmk_position?.id ?? raw?.mmk_position_id ?? null;
                const mmkId = Number(mmkIdRaw);
                const mmkTitle = String(
                    raw?.mmk_position?.position_name
                    || raw?.mmk_position?.name
                    || raw?.field_title
                    || ''
                ).trim();
                if (Number.isFinite(mmkId) && mmkId > 0 && mmkTitle.length > 1) {
                    const existing = professionsMap.get(mmkId);
                    const categoryInfo = categoryId
                        ? categoriesCache.find(c => c.id === categoryId)
                        : null;
                    if (existing) {
                        existing.vacancies_count += 1;
                        if (!existing.category_id && categoryId) {
                            existing.category_id = categoryId;
                            existing.category_title = categoryInfo?.name_uz || mappingResult?.categoryName || null;
                        }
                    } else {
                        professionsMap.set(mmkId, {
                            id: mmkId,
                            title_uz: mmkTitle,
                            title_ru: null,
                            category_id: categoryId,
                            category_title: categoryInfo?.name_uz || mappingResult?.categoryName || null,
                            vacancies_count: 1
                        });
                    }
                }

                const salary = normalizeSalaryRange(
                    vacancy.salary_min ?? raw.min_salary,
                    vacancy.salary_max ?? raw.max_salary
                );

                const employmentType = normalizeEmploymentType(vacancy.employment_type, raw);
                const workMode = normalizeWorkMode(vacancy.work_mode, raw);
                const paymentType = typeof vacancy.payment_type === 'number' ? vacancy.payment_type : (typeof raw.payment_type === 'number' ? raw.payment_type : null);

                const experienceCode = mapExperienceToCode(raw?.work_experiance, vacancy.experience_years);

                // Use centralized maps from osonish-mapper.ts
                // Note: Types in map are strings, raw values are numbers.
                const genderVal = raw.gender ? OSONISH_GENDER_MAP[raw.gender as keyof typeof OSONISH_GENDER_MAP] ?? null : null;
                const educationVal = raw.min_education ? OSONISH_EDUCATION_MAP[raw.min_education as keyof typeof OSONISH_EDUCATION_MAP] ?? 'any' : mapEducationToCode(raw?.min_education, null);
                // Fallback to old mapper if ID not in map (though map covers 1-5)

                // Benefits labels
                let benefitsUz = convertBenefitsToText(raw?.benefit_ids, 'uz');
                let benefitsRu = convertBenefitsToText(raw?.benefit_ids, 'ru');
                const sectionPerks = Array.isArray(raw?.sections?.qulayliklar)
                    ? raw.sections.qulayliklar.filter((item: any) => typeof item === 'string' && item.trim().length > 0)
                    : [];
                if (!benefitsUz && sectionPerks.length > 0) {
                    benefitsUz = sectionPerks.join(', ');
                    benefitsRu = sectionPerks.join(', ');
                }

                const sectionTasks = Array.isArray(raw?.sections?.ish_vazifalari)
                    ? raw.sections.ish_vazifalari.filter((item: any) => typeof item === 'string' && item.trim().length > 0)
                    : [];
                const sectionReqs = Array.isArray(raw?.sections?.talablar)
                    ? raw.sections.talablar.filter((item: any) => typeof item === 'string' && item.trim().length > 0)
                    : [];

                // Build job data - ALL values come directly from OsonIsh API
                const jobData = {
                    source: 'osonish',
                    source_id: vacancy.source_id,
                    source_url: vacancy.source_url,
                    is_imported: true,
                    source_status: 'active',
                    last_synced_at: now,
                    last_seen_at: now,
                    last_checked_at: now,

                    title_uz: vacancy.title,
                    title_ru: vacancy.title,
                    company_name: vacancy.company_name,
                    description_uz: vacancy.description || '',
                    description_ru: vacancy.description || '',

                    salary_min: salary.min,
                    salary_max: salary.max,

                    region_id: regionId,
                    district_id: districtId,
                    region_name: resolvedRegionName,
                    district_name: resolvedDistrictName,
                    address: vacancy.address || null,
                    latitude: vacancy.latitude || null,
                    longitude: vacancy.longitude || null,

                    contact_phone: vacancy.contact_phone || null,
                    contact_email: vacancy.contact_email || null,
                    contact_telegram: vacancy.contact_telegram || null,
                    additional_phone: vacancy.additional_phone || null,
                    hr_name: vacancy.hr_name || null,

                    gender: genderVal,
                    age_min: vacancy.age_min || null,
                    age_max: vacancy.age_max || null,
                    education_level: educationVal,
                    experience: experienceCode,
                    experience_years: vacancy.experience_years || null,
                    working_hours: vacancy.working_hours || null,
                    working_days: vacancy.working_days || null,
                    work_mode: workMode,
                    languages: Array.isArray(raw?.languages) ? raw.languages : (Array.isArray(raw?.language_ids) ? raw.language_ids : []),
                    payment_type: paymentType,
                    skills: vacancy.skills || null,
                    sections: raw?.sections || null,
                    responsibilities_uz: sectionTasks.length > 0 ? sectionTasks.join('\n') : null,
                    requirements_uz: sectionReqs.length > 0 ? sectionReqs.join('\n') : null,
                    requirements_ru: sectionReqs.length > 0 ? sectionReqs.join('\n') : null,

                    // Convert benefit_ids to structured JSON { uz: [], ru: [] }
                    benefits: benefitsUz ? {
                        uz: benefitsUz.split(', '),
                        ru: benefitsRu ? benefitsRu.split(', ') : []
                    } : null,

                    category_id: categoryId,
                    source_category: vacancy.source_category || sourceCategoryName || null,
                    source_subcategory: vacancy.source_subcategory || null,

                    vacancy_count: vacancy.vacancy_count || 1,
                    views_count: vacancy.views_count || 0,

                    is_for_disabled: vacancy.is_for_disabled,
                    is_for_graduates: vacancy.is_for_graduates,
                    is_for_students: vacancy.is_for_students,
                    is_for_women: vacancy.is_for_women,

                    employment_type: employmentType,
                    status: 'active',
                    is_active: true,

                    raw_source_json: vacancy.raw_source_json || null,
                };

                validJobs.push(jobData);

            } catch (err) {
                console.error(`[OSONISH] Exception ${vacancy.source_id}:`, err);
                stats.errors++;
            }
        }

        console.log(`[OSONISH] Ready to upsert ${validJobs.length} jobs. Starting batch process...`);

        // Batch upsert (chunk size 50)
        const BATCH_SIZE = 50;
        for (let i = 0; i < validJobs.length; i += BATCH_SIZE) {
            const chunk = validJobs.slice(i, i + BATCH_SIZE);
            const { error } = await upsertBatchWithRetry(chunk);
            if (error) {
                console.error(`[OSONISH] Batch failed (chunk ${Math.floor(i / BATCH_SIZE)}):`, error.message);
                stats.errors += chunk.length;
            } else {
                stats.updated += chunk.length;
            }
        }

        // Deactivate jobs no longer present on OsonIsh
        const { error: deactivateError } = await supabaseAdmin
            .from('jobs')
            .update({ is_active: false, status: 'inactive', source_status: 'inactive' })
            .eq('source', 'osonish')
            .lt('last_seen_at', runStartedAt);

        if (deactivateError) {
            console.warn('[OSONISH] Failed to deactivate stale jobs:', deactivateError.message);
        }

        if (professionsMap.size > 0) {
            const professionRows = Array.from(professionsMap.values());
            const PROF_BATCH_SIZE = 200;
            for (let i = 0; i < professionRows.length; i += PROF_BATCH_SIZE) {
                const chunk = professionRows.slice(i, i + PROF_BATCH_SIZE);
                const { error } = await upsertProfessionsBatch(chunk);
                if (error) {
                    console.warn(`[OSONISH] Profession batch failed (chunk ${Math.floor(i / PROF_BATCH_SIZE)}): ${error.message}`);
                }
            }

            const { error: staleProfError } = await supabaseAdmin
                .from('osonish_professions')
                .update({ vacancies_count: 0 })
                .eq('source', 'osonish')
                .lt('last_seen_at', runStartedAt);

            if (staleProfError) {
                console.warn('[OSONISH] Failed to reset stale profession counters:', staleProfError.message);
            }
        }

        // ==================== UPDATE LOG ====================

        if (logId) {
            await supabaseAdmin
                .from('import_logs')
                .update({
                    completed_at: new Date().toISOString(),
                    status: stats.errors > 0 ? 'completed_with_errors' : 'completed',
                    total_found: result.vacancies.length,
                    new_imported: stats.newImported,
                    updated: stats.updated,
                    errors: stats.errors,
                    notes: `OsonIsh only (no AI). Duration: ${Date.now() - startTime}ms`
                })
                .eq('id', logId);
        }

        console.log(`[OSONISH] Complete: ${stats.newImported} new, ${stats.updated} updated, ${stats.errors} errors`);

        return NextResponse.json({
            success: true,
            code_version: CODE_VERSION,
            source: 'osonish',
            ai_used: false,
            stats: {
                found: result.vacancies.length,
                new_imported: stats.newImported,
                updated: stats.updated,
                errors: stats.errors
            },
            duration_ms: Date.now() - startTime
        });

    } catch (error: any) {
        console.error('[OSONISH] Error:', error);
        return NextResponse.json({ error: 'OsonIsh import failed', details: error.message }, { status: 500 });
    } finally {
        importRunActive = false;
        importRunStartedAt = 0;
    }
}

async function upsertProfessionsBatch(chunk: ProfessionAccumulator[], retries = 3): Promise<{ error: any }> {
    for (let i = 0; i < retries; i++) {
        try {
            const now = new Date().toISOString();
            const { error } = await supabaseAdmin.from('osonish_professions').upsert(
                chunk.map(item => ({
                    id: item.id,
                    title_uz: item.title_uz,
                    title_ru: item.title_ru,
                    category_id: item.category_id,
                    category_title: item.category_title,
                    vacancies_count: item.vacancies_count,
                    last_seen_at: now,
                    source: 'osonish'
                })),
                {
                    onConflict: 'id',
                    ignoreDuplicates: false
                }
            );

            if (!error) return { error: null };
            if (i === retries - 1) return { error };
        } catch (err: any) {
            if (i === retries - 1) return { error: { message: err.message } };
        }
        await new Promise(r => setTimeout(r, 200 * Math.pow(2, i)));
    }
    return { error: { message: 'Max retries reached' } };
}

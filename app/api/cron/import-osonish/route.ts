import { NextRequest, NextResponse } from 'next/server';
import { scrapeOsonishFull } from '@/lib/scrapers/osonish';
import { mapOsonishCategory } from '@/lib/mappers/osonish-mapper';
import { getMappedValue } from '@/lib/mappings';
import { createClient } from '@supabase/supabase-js';

// Service role client for import operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Code version
const CODE_VERSION = '2026-01-25-osonish-title-mapping-v3';

// ==================== CACHED LOOKUP ====================

interface RegionCache { id: number; name_uz: string; name_ru: string; slug: string; }
interface DistrictCache { id: string; name_uz: string; name_ru: string; region_id: number; }
interface CategoryCache { id: string; name_uz: string; name_ru: string; }

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

function lookupDistrictId(districtName?: string, regionId?: number | null): string | null {
    if (!districtName || districtsCacheNorm.length === 0) return null;

    const normalizedFull = normalizeGeoName(districtName);
    const normalizedLoose = stripGeoTypeTokens(normalizedFull);
    const flags = detectGeoType(districtName);

    const candidates = regionId
        ? districtsCacheNorm.filter(d => d.region_id === regionId)
        : districtsCacheNorm;

    const exact = candidates.find(d => d.normsFull.includes(normalizedFull));
    if (exact) return exact.id;

    const looseMatches = candidates.filter(d => normalizedLoose && d.normsLoose.includes(normalizedLoose));
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
    // 1. Try ID from OsonIsh
    if (typeof rawId === 'number') {
        if (rawId === 1) return 'no_experience'; // Talab etilmaydi
        if (rawId === 2) return '1_3'; // 1-3 yil
        if (rawId === 3) return '3_6'; // 3-6 yil
        if (rawId === 4) return '6_plus'; // 6+ yil
        return 'no_experience'; // Default
    }
    // 2. Fallback to years count
    if (typeof years === 'number') {
        if (years === 0) return 'no_experience';
        if (years <= 3) return '1_3';
        if (years <= 6) return '3_6';
        return '6_plus';
    }
    return 'no_experience';
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




/**
 * GET /api/cron/import-osonish
 *
 * OsonIsh-only import - NO AI PROCESSING
 * All data comes directly from OsonIsh API in structured format
 */
export async function GET(request: NextRequest) {
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

        // Clear stale FK references from existing jobs BEFORE loading cache
        // This is needed because sync-strict may have deleted old districts/regions
        // leaving orphaned references that cause FK violations during upsert
        console.log('[OSONISH] Clearing stale district_id/region_id references from existing jobs...');
        const { error: clearError } = await supabaseAdmin
            .from('jobs')
            .update({ district_id: null, region_id: null })
            .not('district_id', 'is', null);

        if (clearError) {
            console.warn('[OSONISH] Warning: Could not clear stale FK references:', clearError.message);
        } else {
            console.log('[OSONISH] Stale FK references cleared successfully');
        }

        // Load lookup cache (will re-fetch from DB)
        await loadCache();

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

        const result = await scrapeOsonishFull(50, true);

        console.log(`[OSONISH] Scraped ${result.vacancies.length} vacancies with contacts`);

        // ==================== IMPORT TO DATABASE ====================

        let stats = { newImported: 0, updated: 0, errors: 0 };
        const now = new Date().toISOString();

        for (const vacancy of result.vacancies) {
            try {
                const raw = (vacancy.raw_source_json as any) || {};

                // Region/District normalization (strict, no new records)
                const regionIdByName = lookupRegionId(vacancy.region_name);
                let districtId = lookupDistrictId(vacancy.district_name, regionIdByName);

                // If region was missing but district is unique globally, try without region scope
                if (!districtId && !regionIdByName && vacancy.district_name) {
                    districtId = lookupDistrictId(vacancy.district_name, null);
                }

                const districtInfo = districtId ? districtsCacheNorm.find(d => d.id === districtId) : null;
                const regionId = districtInfo?.region_id ?? regionIdByName;
                const regionInfo = regionId ? regionsCacheNorm.find(r => r.id === regionId) : null;

                if (!regionId) {
                    console.warn(`[OSONISH] Skip vacancy ${vacancy.source_id}: region not resolved (region="${vacancy.region_name}", district="${vacancy.district_name}")`);
                    stats.errors++;
                    continue;
                }

                if (!districtId && vacancy.district_name) {
                    console.warn(`[OSONISH] District not resolved for vacancy ${vacancy.source_id}: "${vacancy.district_name}". Using region only.`);
                }

                // Map Category strictly by title (OsonIsh has no source category)
                const mappingResult = mapOsonishCategory('', null, vacancy.title);
                const categoryId = mappingResult.categoryId;

                const salary = normalizeSalaryRange(
                    vacancy.salary_min ?? raw.min_salary,
                    vacancy.salary_max ?? raw.max_salary
                );

                const employmentType = normalizeEmploymentType(vacancy.employment_type, raw);
                const workMode = normalizeWorkMode(vacancy.work_mode, raw);
                const paymentType = typeof vacancy.payment_type === 'number' ? vacancy.payment_type : (typeof raw.payment_type === 'number' ? raw.payment_type : null);

                const experienceCode = mapExperienceToCode(raw?.work_experiance, vacancy.experience_years);
                const educationCode = mapEducationToCode(raw?.min_education, null);

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
                    region_name: regionInfo?.name_uz || null,
                    district_name: districtInfo?.name_uz || null,
                    address: vacancy.address || null,
                    latitude: vacancy.latitude || null,
                    longitude: vacancy.longitude || null,

                    contact_phone: vacancy.contact_phone || null,
                    contact_email: vacancy.contact_email || null,
                    contact_telegram: vacancy.contact_telegram || null,
                    additional_phone: vacancy.additional_phone || null,
                    hr_name: vacancy.hr_name || null,

                    gender: vacancy.gender || null,
                    age_min: vacancy.age_min || null,
                    age_max: vacancy.age_max || null,
                    education_level: educationCode, // Normalized code from mapEducationToCode
                    experience: experienceCode,     // Normalized code from mapExperienceToCode
                    experience_years: vacancy.experience_years || null,
                    working_hours: vacancy.working_hours || null,
                    working_days: vacancy.working_days || null,
                    work_mode: workMode,
                    payment_type: paymentType,
                    skills: vacancy.skills || null,

                    // Convert benefit_ids (Ijtimoiy paketlar) to text (Qulayliklar)
                    benefits: convertBenefitsToText(
                        raw?.benefit_ids,
                        'uz'
                    ),

                    category_id: categoryId,

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

                // Use UPSERT to handle duplicates and updates atomically
                const { error } = await supabaseAdmin
                    .from('jobs')
                    .upsert(jobData, {
                        onConflict: 'source,source_id',
                        ignoreDuplicates: false
                    });

                if (error) {
                    console.error(`[OSONISH] Upsert error ${vacancy.source_id}:`, error.message);
                    stats.errors++;
                } else {
                    stats.updated++;
                }

            } catch (err) {
                console.error(`[OSONISH] Exception ${vacancy.source_id}:`, err);
                stats.errors++;
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
    }
}

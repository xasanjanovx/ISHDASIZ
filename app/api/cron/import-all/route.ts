import { NextRequest, NextResponse } from 'next/server';
import { scrapeOsonishFull } from '@/lib/scrapers/osonish';
import { mapOsonishCategory, OSONISH_GENDER_MAP } from '@/lib/mappers/osonish-mapper';
import { createClient } from '@supabase/supabase-js';
import { getMappedValue } from '@/lib/mappings';

// Force dynamic to prevent static generation timeout
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for long-running import

// Service role client for import operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cron/Admin secret
const CRON_SECRET = process.env.CRON_SECRET;

// Code version
const CODE_VERSION = '2026-01-24-osonish-only-v1';

// ==================== CACHED LOOKUP (из import-osonish) ====================

/**
 * Convert benefit_ids array to localized text string
 * This maps OsonIsh "Ijtimoiy paketlar" to our "Qulayliklar" field
 */
function convertBenefitsToText(benefitIds: number[] | undefined, lang: 'uz' | 'ru' = 'uz'): string | null {
    if (!benefitIds || benefitIds.length === 0) return null;

    const benefitLabels = benefitIds
        .map(id => getMappedValue('benefits', id, lang))
        .filter(Boolean);

    return benefitLabels.length > 0 ? benefitLabels.join(', ') : null;
}

interface RegionCache { id: number; name_uz: string; name_ru: string; slug: string; }
interface DistrictCache { id: string; name_uz: string; name_ru: string; region_id: number; }
interface CategoryCache { id: string; name_uz: string; name_ru: string; }

let regionsCache: RegionCache[] = [];
let districtsCache: DistrictCache[] = [];
let categoriesCache: CategoryCache[] = [];

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

    console.log(`[OSONISH] Cache loaded: ${regionsCache.length} regions, ${districtsCache.length} districts, ${categoriesCache.length} categories`);
}

function normalizeName(name: string): string {
    let normalized = name
        .toLowerCase()
        .replace(/(viloyati|viloyat|область|обл\.?|shahri|shahar|sh\.|город|tumani|tuman|район|respublikasi|respublika|шахри)/gi, '')
        .replace(/['"`‘’ʻʼ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Comprehensive alias mapping
    const aliasMap: Record<string, string> = {
        // Tashkent
        'toshkent': 'toshkent', 'tashkent': 'toshkent', 'ташкент': 'toshkent', 'toshken': 'toshkent',
        // Andijan
        'andijon': 'andijon', 'andijan': 'andijon', 'андижан': 'andijon', 'andjon': 'andijon',
        // Bukhara
        'buxoro': 'buxoro', 'bukhara': 'buxoro', 'бухара': 'buxoro', 'buhara': 'buxoro',
        // Fergana
        'fargona': 'fargona', 'fergana': 'fargona', 'фергана': 'fargona', 'farghona': 'fargona',
        // Jizzakh
        'jizzax': 'jizzax', 'jizzakh': 'jizzax', 'джизак': 'jizzax', 'jizzah': 'jizzax',
        // Khorezm
        'xorazm': 'xorazm', 'khorezm': 'xorazm', 'хорезм': 'xorazm', 'horazm': 'xorazm',
        // Namangan
        'namangan': 'namangan', 'наманган': 'namangan',
        // Navoiy
        'navoiy': 'navoiy', 'navoi': 'navoiy', 'навои': 'navoiy',
        // Kashkadarya
        'qashqadaryo': 'qashqadaryo', 'kashkadarya': 'qashqadaryo', 'кашкадарья': 'qashqadaryo', 'qashqadare': 'qashqadaryo',
        // Karakalpakstan
        'qoraqalpogiston': 'qoraqalpogiston', 'karakalpakstan': 'qoraqalpogiston', 'каракалпакстан': 'qoraqalpogiston', 'qoraqalpoq': 'qoraqalpogiston',
        // Samarkand
        'samarqand': 'samarqand', 'samarkand': 'samarqand', 'самарканд': 'samarqand',
        // Syrdarya
        'sirdaryo': 'sirdaryo', 'syrdarya': 'sirdaryo', 'сырдарья': 'sirdaryo', 'sirdarya': 'sirdaryo',
        // Surkhandarya
        'surxondaryo': 'surxondaryo', 'surkhandarya': 'surxondaryo', 'сурхандарья': 'surxondaryo', 'surhandarya': 'surxondaryo',
    };

    for (const [alias, canonical] of Object.entries(aliasMap)) {
        if (normalized.includes(alias)) {
            normalized = canonical;
            break;
        }
    }
    return normalized;
}

function lookupRegionId(regionName?: string): number | null {
    if (!regionName || regionsCache.length === 0) return null;
    const normalized = normalizeName(regionName);

    // Exact match first
    for (const region of regionsCache) {
        if (normalizeName(region.name_uz) === normalized ||
            normalizeName(region.name_ru) === normalized ||
            (region.slug && region.slug.toLowerCase().replace(/-/g, '') === normalized.replace(/\s/g, ''))) {
            return region.id;
        }
    }

    // Partial match
    for (const region of regionsCache) {
        const regNormUz = normalizeName(region.name_uz);
        const regNormRu = normalizeName(region.name_ru || '');
        if (normalized.includes(regNormUz) || regNormUz.includes(normalized) ||
            normalized.includes(regNormRu) || regNormRu.includes(normalized)) {
            return region.id;
        }
    }

    console.log(`[OSONISH] Region not found: "${regionName}" (normalized: "${normalized}")`);
    return null;
}

function lookupDistrictId(districtName?: string, regionId?: number | null): string | null {
    if (!districtName || districtsCache.length === 0) return null;

    // Normalize: remove apostrophes and suffixes
    let normalized = districtName
        .toLowerCase()
        .replace(/(tumani|tuman|shahri|shahar|sh\.|район|шахри|туман)/gi, '')
        .replace(/['\u0060\u00B4\u2018\u2019\u201C\u201D\u02BB\u02BC\u02BF\u02BE\u2032\u2033`´''""ʻʼʿʾ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // District name alias map (common misspellings from import sources)
    const districtAliasMap: Record<string, string> = {
        // Navbaxor = Navbahor (Bukhara)
        'navbaxor': 'navbahor',
        // Marxamat = Marhamat (Andijan)
        'marxamat': 'marhamat',
        // Muynoq = Mo'ynoq (Karakalpakstan)
        'muynoq': 'moynoq',
        'muynok': 'moynoq',
        // Dexqonobod = Dehqonobod (Kashkadarya)
        'dexqonobod': 'dehqonobod',
        'dekhqonobod': 'dehqonobod',
        // Ohongaron = Ohangaron (Tashkent)
        'ohongaron': 'ohangaron',
        'ohangaron shaxar': 'ohangaron',
        'ohangoron': 'ohangaron',
        // Other common typos
        'g`uzor': 'guzor',
        'guzor': 'guzor',
        'qorovulbozor': 'qorovulbozor',
    };

    // Apply alias if found
    if (districtAliasMap[normalized]) {
        normalized = districtAliasMap[normalized];
    }

    // Helper to normalize district name from cache
    const normalizeCache = (name: string) => name
        .toLowerCase()
        .replace(/(tumani|tuman|shahri|shahar|sh\.|район|шахри|туман)/gi, '')
        .replace(/['\u0060\u00B4\u2018\u2019\u201C\u201D\u02BB\u02BC\u02BF\u02BE\u2032\u2033`´''""ʻʼʿʾ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Step 1: Try with region filter first
    if (regionId) {
        const regionCandidates = districtsCache.filter(d => d.region_id === regionId);
        for (const district of regionCandidates) {
            const normUz = normalizeCache(district.name_uz);
            const normRu = normalizeCache(district.name_ru || '');
            if (normUz === normalized || normRu === normalized ||
                normalized.includes(normUz) || normUz.includes(normalized)) {
                return district.id;
            }
        }
    }

    // Step 2: Search ALL districts (source region may be wrong!)
    for (const district of districtsCache) {
        const normUz = normalizeCache(district.name_uz);
        const normRu = normalizeCache(district.name_ru || '');
        if (normUz === normalized || normRu === normalized) {
            return district.id;
        }
    }

    // Step 3: Partial match in all
    for (const district of districtsCache) {
        const normUz = normalizeCache(district.name_uz);
        if (normalized.includes(normUz) || normUz.includes(normalized)) {
            return district.id;
        }
    }

    console.log(`[OSONISH] District not found: "${districtName}" (normalized: "${normalized}")`);
    return null;
}

function lookupCategoryId(categoryName?: string, title?: string): string | null {
    if (categoriesCache.length === 0) return null;
    const candidates = [categoryName, title].filter(Boolean);

    for (const rawName of candidates) {
        if (!rawName) continue;
        const normalized = normalizeName(rawName);

        for (const cat of categoriesCache) {
            const catNorm = normalizeName(cat.name_uz);
            if (normalized.includes(catNorm) || catNorm.includes(normalized)) {
                return cat.id;
            }
        }
    }
    return null;
}

// ==================== MAIN HANDLER ====================

/**
 * GET /api/cron/import-all
 * 
 * OsonIsh-only import (legacy endpoint for admin button)
 * Triggered by cron or manual button
 */
export async function GET(request: NextRequest) {
    try {
        // Verify authorization
        const authHeader = request.headers.get('authorization');
        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            // Allow without auth for testing (remove in production)
            console.log('[OSONISH] No auth, proceeding anyway for dev...');
        }

        console.log('[OSONISH] Starting OsonIsh-only import...');
        const startTime = Date.now();

        // Load lookup cache
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

        // ==================== RUN OSONISH SCRAPER ====================

        const osonishResult = await scrapeOsonishFull(50, true).catch(err => {
            console.error('[OSONISH] OsonIsh error:', err);
            return { vacancies: [], active_ids: [], filled_ids: [], debug: { list_items_count: 0, detail_success_count: 0, vacancies_with_contacts: 0 } };
        });

        console.log(`[OSONISH] OsonIsh: ${osonishResult.vacancies.length} vacancies`);

        // ==================== IMPORT OSONISH (existing logic) ====================

        let osonishStats = { newImported: 0, updated: 0, errors: 0 };
        const now = new Date().toISOString();

        for (const vacancy of osonishResult.vacancies) {
            try {
                const { data: existing } = await supabaseAdmin
                    .from('jobs')
                    .select('id')
                    .eq('source', 'osonish')
                    .eq('source_id', vacancy.source_id)
                    .maybeSingle();

                // FIXED: Get district first, then derive region from district's FK
                const districtId = lookupDistrictId(vacancy.district_name, null);
                const districtInfo = districtsCache.find(d => d.id === districtId);
                const regionId = districtInfo?.region_id ?? lookupRegionId(vacancy.region_name);

                // Map Category for OsonIsh (using title as main signal)
                const mappingResult = mapOsonishCategory(
                    '', // No source category for OsonIsh
                    null,
                    vacancy.title
                );
                const categoryId = mappingResult.categoryId;

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

                    salary_min: vacancy.salary_min || null,
                    salary_max: vacancy.salary_max || null,

                    region_id: regionId,
                    district_id: districtId,
                    // Use proper names from cache to ensure correct display
                    region_name: regionId ? regionsCache.find(r => r.id === regionId)?.name_uz : (vacancy.region_name || null),
                    district_name: districtInfo?.name_uz || vacancy.district_name || null,
                    address: vacancy.address || null,
                    latitude: vacancy.latitude || null,
                    longitude: vacancy.longitude || null,

                    contact_phone: vacancy.contact_phone || null,
                    contact_email: vacancy.contact_email || null,
                    contact_telegram: vacancy.contact_telegram || null,
                    additional_phone: vacancy.additional_phone || null,
                    hr_name: vacancy.hr_name || null,

                    // ALL fields from OsonIsh
                    gender: typeof vacancy.gender === 'number'
                        ? (OSONISH_GENDER_MAP[vacancy.gender as keyof typeof OSONISH_GENDER_MAP] || 'any')
                        : (typeof vacancy.gender === 'string' ? vacancy.gender : 'any'),
                    age_min: vacancy.age_min || null,
                    age_max: vacancy.age_max || null,

                    education_level: vacancy.education_level || null,
                    experience_years: vacancy.experience_years || null,
                    working_hours: vacancy.working_hours || null,
                    working_days: vacancy.working_days || null,
                    work_mode: vacancy.work_mode || null,
                    payment_type: vacancy.payment_type || null,
                    skills: vacancy.skills || null,

                    category_id: categoryId,


                    vacancy_count: vacancy.vacancy_count || 1,
                    views_count: vacancy.views_count || 0,

                    is_for_disabled: vacancy.is_for_disabled,
                    is_for_graduates: vacancy.is_for_graduates,
                    is_for_students: vacancy.is_for_students,
                    is_for_women: vacancy.is_for_women,

                    // Convert benefit_ids (Ijtimoiy paketlar) to text (Qulayliklar)
                    benefits: convertBenefitsToText(
                        (vacancy.raw_source_json as any)?.benefit_ids,
                        'uz'
                    ),

                    employment_type: vacancy.employment_type || 'full_time',
                    status: 'active',
                    is_active: true,

                    raw_source_json: vacancy.raw_source_json || null,

                    // Source category info (for filtering/debugging)
                    source_category: vacancy.source_category || null,
                    source_subcategory: vacancy.source_subcategory || null,
                };

                if (existing) {
                    const { error } = await supabaseAdmin.from('jobs').update(jobData).eq('id', existing.id);
                    if (error) {
                        console.error(`[OSONISH] Osonish update error ${vacancy.source_id}:`, error.message);
                        osonishStats.errors++;
                    } else {
                        osonishStats.updated++;
                    }
                } else {
                    const { error } = await supabaseAdmin.from('jobs').insert(jobData);
                    if (error) {
                        console.error(`[OSONISH] Osonish insert error ${vacancy.source_id}:`, error.message);
                        osonishStats.errors++;
                    } else {
                        osonishStats.newImported++;
                    }
                }
            } catch (err) {
                console.error(`[OSONISH] Osonish exception ${vacancy.source_id}:`, err);
                osonishStats.errors++;
            }
        }

        // ==================== UPDATE LOG ====================

        const totalNew = osonishStats.newImported;
        const totalUpdated = osonishStats.updated;
        const totalErrors = osonishStats.errors;

        if (logId) {
            await supabaseAdmin
                .from('import_logs')
                .update({
                    completed_at: new Date().toISOString(),
                    status: totalErrors > 0 ? 'completed_with_errors' : 'completed',
                    total_found: osonishResult.vacancies.length,
                    new_imported: totalNew,
                    updated: totalUpdated,
                    errors: totalErrors,
                    notes: `OsonIsh only. Duration: ${Date.now() - startTime}ms`
                })
                .eq('id', logId);
        }

        return NextResponse.json({
            success: true,
            code_version: CODE_VERSION,
            sources: {
                osonish: {
                    found: osonishResult.vacancies.length,
                    new: osonishStats.newImported,
                    updated: osonishStats.updated,
                    errors: osonishStats.errors
                }
            },
            totals: {
                new_imported: totalNew,
                updated: totalUpdated,
                errors: totalErrors
            },
            duration_ms: Date.now() - startTime
        });

    } catch (error: any) {
        console.error('[OSONISH] Error:', error);
        return NextResponse.json({ error: 'Unified import failed', details: error.message }, { status: 500 });
    }
}

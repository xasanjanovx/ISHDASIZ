import { NextRequest, NextResponse } from 'next/server';
import { scrapeOsonishFull, TransformedVacancy } from '@/lib/scrapers/osonish';
import { createClient } from '@supabase/supabase-js';

// Service role client for import operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cron secret
const CRON_SECRET = process.env.CRON_SECRET;

// Default category for imported jobs (fallback)
const DEFAULT_CATEGORY_ID = process.env.DEFAULT_IMPORT_CATEGORY_ID || null;

// Code version for tracking (change this on each deploy to verify correct code is running)
const CODE_VERSION = '2026-01-15-v2-with-debug';

// ==================== CACHED LOOKUP SYSTEM ====================

interface CategoryCache {
    id: string;
    name_uz: string;
    name_ru: string;
}

interface RegionCache {
    id: number;
    name_uz: string;
    name_ru: string;
    slug: string;
}

interface DistrictCache {
    id: string;
    name_uz: string;
    name_ru: string;
    region_id: number;
}

// Memory Cache
let regionsCache: RegionCache[] = [];
let districtsCache: DistrictCache[] = [];
let categoriesCache: CategoryCache[] = [];

/**
 * Load locations and categories into memory for 2-step cron only
 */
async function loadCache(): Promise<void> {
    if (regionsCache.length > 0) return; // Already loaded

    const [regionsRes, districtsRes, categoriesRes] = await Promise.all([
        supabaseAdmin.from('regions').select('id, name_uz, name_ru, slug'),
        supabaseAdmin.from('districts').select('id, name_uz, name_ru, region_id'),
        supabaseAdmin.from('categories').select('id, name_uz, name_ru')
    ]);

    regionsCache = regionsRes.data || [];
    districtsCache = districtsRes.data || [];
    categoriesCache = categoriesRes.data || [];

    console.log(`[CRON] Cache loaded: ${regionsCache.length} regions, ${districtsCache.length} districts, ${categoriesCache.length} categories`);
}

/**
 * Normalize name for fuzzy matching (remove suffixes, lowercase, trim)
 */
function normalizeName(name: string): string {
    let normalized = name
        .toLowerCase()
        .replace(/(viloyati|viloyat|область|обл\.?|shahri|shahar|город|tumani|tuman|район|respublikasi|respublika)/gi, '')
        .replace(/[''`ʻʼ]/g, '') // Remove all apostrophe variants
        .replace(/\s+/g, ' ')
        .trim();

    // Alias map для известных вариаций
    const aliasMap: Record<string, string> = {
        'qoraqalpog': 'qoraqalpogiston',
        'qoraqalpogiston': 'qoraqalpogiston',
        'karakalpak': 'qoraqalpogiston',
        'toshkent': 'toshkent',
        'tashkent': 'toshkent',
        'ташкент': 'toshkent',
        'fargona': 'fargona',
        'fergana': 'fargona',
        'фергана': 'fargona',
        'andijon': 'andijon',
        'andijan': 'andijon',
        'андижан': 'andijon',
    };

    // Проверяем alias
    for (const [alias, canonical] of Object.entries(aliasMap)) {
        if (normalized.includes(alias)) {
            normalized = canonical;
            break;
        }
    }

    return normalized;
}

/**
 * Find region_id by name (cached fuzzy match)
 */
function lookupRegionId(regionName?: string): number | null {
    if (!regionName || regionsCache.length === 0) return null;

    const normalized = normalizeName(regionName);

    // Try exact normalized match first
    for (const region of regionsCache) {
        if (normalizeName(region.name_uz) === normalized ||
            normalizeName(region.name_ru) === normalized) {
            return region.id;
        }
    }

    // Try partial match (one contains the other)
    for (const region of regionsCache) {
        const regNormUz = normalizeName(region.name_uz);
        const regNormRu = normalizeName(region.name_ru);
        if (normalized.includes(regNormUz) || regNormUz.includes(normalized) ||
            normalized.includes(regNormRu) || regNormRu.includes(normalized)) {
            return region.id;
        }
    }

    return null;
}

/**
 * Find district_id by name (cached fuzzy match)
 */
function lookupDistrictId(districtName?: string, regionId?: number | null): string | null {
    if (!districtName || districtsCache.length === 0) return null;

    const normalized = normalizeName(districtName);

    // Filter by region if provided
    const candidates = regionId
        ? districtsCache.filter(d => d.region_id === regionId)
        : districtsCache;

    // Try exact normalized match first
    for (const district of candidates) {
        if (normalizeName(district.name_uz) === normalized ||
            normalizeName(district.name_ru) === normalized) {
            return district.id;
        }
    }

    // Try partial match
    for (const district of candidates) {
        const distNormUz = normalizeName(district.name_uz);
        const distNormRu = normalizeName(district.name_ru);
        if (normalized.includes(distNormUz) || distNormUz.includes(normalized) ||
            normalized.includes(distNormRu) || distNormRu.includes(normalized)) {
            return district.id;
        }
    }

    // If no match with region filter, try all districts
    if (regionId && candidates.length < districtsCache.length) {
        return lookupDistrictId(districtName, null);
    }

    return null;
}

/**
 * Find category_id by name match (Osonish mmk_group/position)
 */
function lookupCategoryId(vacancy: any): string | null {
    if (categoriesCache.length === 0) return null;

    // Extract potential names from mmk_group
    const candidates: string[] = [];

    // mmk_group.cat1/2/3
    if (vacancy.raw_source_json?.mmk_group) {
        const g = vacancy.raw_source_json.mmk_group;
        if (g.cat2) candidates.push(g.cat2); // Specific (e.g. Ishlab chiqarish)
        if (g.cat1) candidates.push(g.cat1); // Broad (e.g. Rahbarlar)
    }

    // Also try mmk_position.position_name
    if (vacancy.raw_source_json?.mmk_position?.position_name) {
        candidates.push(vacancy.raw_source_json.mmk_position.position_name);
    }

    // Also title
    candidates.push(vacancy.title);

    for (const rawName of candidates) {
        if (!rawName) continue;
        const normalized = normalizeName(rawName);

        // Exact match
        for (const cat of categoriesCache) {
            if (normalizeName(cat.name_uz) === normalized ||
                normalizeName(cat.name_ru) === normalized) {
                return cat.id;
            }
        }

        // Partial match
        for (const cat of categoriesCache) {
            const catNormUz = normalizeName(cat.name_uz);
            const catNormRu = normalizeName(cat.name_ru);

            // Check if category name is INSIDE the candidate (e.g. "Qurilish" inside "Qurilish bo'limi boshlig'i")
            // Or candidate inside category (less likely)
            if (normalized.includes(catNormUz) || normalized.includes(catNormRu)) {
                return cat.id;
            }
        }
    }

    return null;
}

// ==================== MAPPING FUNCTIONS ====================

/**
 * Map experience years to string code
 */
function mapExperienceToCode(years?: number): string {
    if (!years || years === 0) return 'no_experience';
    if (years <= 1) return '1_3';
    if (years <= 3) return '1_3';
    if (years <= 6) return '3_6';
    return '6_plus';
}

/**
 * Map education level to string code
 */
function mapEducationToCode(level?: number): string {
    if (!level) return 'any';
    if (level === 1) return 'secondary';
    if (level === 2) return 'vocational';
    if (level >= 3) return 'higher';
    return 'any';
}

/**
 * Map gender to string code
 */
function mapGenderToCode(gender?: number): string | null {
    if (gender === 1) return 'male';
    if (gender === 2) return 'female';
    return null;
}

/**
 * GET /api/cron/import-osonish
 * 
 * Vercel Cron - 2-Step List → Detail Import
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron authorization
        const authHeader = request.headers.get('authorization');
        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting 2-step import...');
        const startTime = Date.now();

        // Load cache (locations + categories)
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

        // Run 2-step scraper (20 pages = 2000 vacancies max)
        const result = await scrapeOsonishFull(20, true);

        console.log(`[CRON] Collected ${result.vacancies.length} vacancies with contacts`);


        if (result.vacancies.length === 0) {
            if (logId) {
                await supabaseAdmin
                    .from('import_logs')
                    .update({
                        completed_at: new Date().toISOString(),
                        status: 'completed',
                        total_found: result.debug.list_items_count,
                        notes: `No vacancies with contacts. List: ${result.debug.list_items_count}, Detail success: ${result.debug.detail_success_count}`
                    })
                    .eq('id', logId);
            }

            return NextResponse.json({
                success: true,
                message: 'No vacancies with contacts',
                debug: result.debug,
                duration_ms: Date.now() - startTime
            });
        }

        // Import to database
        const now = new Date().toISOString();
        let newImported = 0;
        let updated = 0;
        let errors = 0;

        // Debug: Track first 3 vacancies for diagnosis
        const debugSamples: Array<{
            source_id: string;
            region_name: string | undefined;
            district_name: string | undefined;
            region_id_result: number | null;
            district_id_result: string | null;
            existing_id: string | null;
            action: 'insert' | 'update';
        }> = [];

        for (const vacancy of result.vacancies) {
            try {
                const { data: existing } = await supabaseAdmin
                    .from('jobs')
                    .select('id')
                    .eq('source', 'osonish')
                    .eq('source_id', vacancy.source_id)
                    .maybeSingle();

                // Lookup region_id and district_id for filter compatibility (synchronous cache lookup)
                const regionId = lookupRegionId(vacancy.region_name);
                const districtId = lookupDistrictId(vacancy.district_name, regionId);

                // Collect debug info for first 3
                if (debugSamples.length < 3) {
                    debugSamples.push({
                        source_id: vacancy.source_id,
                        region_name: vacancy.region_name,
                        district_name: vacancy.district_name,
                        region_id_result: regionId,
                        district_id_result: districtId,
                        existing_id: existing?.id || null,
                        action: existing ? 'update' : 'insert'
                    });
                }

                const jobData = {
                    // Source tracking
                    source: 'osonish',
                    source_id: vacancy.source_id,
                    source_url: vacancy.source_url,
                    is_imported: true,
                    source_status: 'active',
                    last_synced_at: now,
                    last_seen_at: now,
                    last_checked_at: now,

                    // Basic info
                    title_uz: vacancy.title,
                    title_ru: vacancy.title,
                    company_name: vacancy.company_name,
                    description_uz: vacancy.description || '',
                    description_ru: vacancy.description || '',

                    // Salary
                    salary_min: vacancy.salary_min || null,
                    salary_max: vacancy.salary_max || null,

                    // Location - BOTH FK and text (for fallback display)
                    region_id: regionId,
                    district_id: districtId,
                    address: vacancy.address || null,
                    region_name: vacancy.region_name || null,
                    district_name: vacancy.district_name || null,
                    latitude: vacancy.latitude || null,
                    longitude: vacancy.longitude || null,

                    // Category mapping
                    category_id: lookupCategoryId(vacancy) || DEFAULT_CATEGORY_ID,

                    // Contacts
                    contact_phone: vacancy.contact_phone || null,
                    contact_telegram: vacancy.contact_telegram || null,
                    additional_phone: vacancy.additional_phone || null,
                    hr_name: vacancy.hr_name || null,

                    // Boolean flags for filters
                    is_for_disabled: vacancy.is_for_disabled,
                    is_for_graduates: vacancy.is_for_graduates,
                    is_for_students: vacancy.is_for_students,
                    is_for_women: vacancy.is_for_women,

                    // Work info - with proper string codes for filters
                    employment_type: vacancy.employment_type || 'full_time',
                    work_mode: vacancy.work_mode || null,
                    working_hours: vacancy.working_hours || null,
                    experience: mapExperienceToCode(vacancy.experience_years),
                    education_level: mapEducationToCode(vacancy.education_level),
                    gender: mapGenderToCode(vacancy.gender),
                    age_min: vacancy.age_min || null,
                    age_max: vacancy.age_max || null,

                    // Additional UI fields
                    vacancy_count: vacancy.vacancy_count || 1,
                    views_count: vacancy.views_count || 0,

                    // Raw JSON for full UI parity
                    raw_source_json: vacancy.raw_source_json || null,

                    // Status
                    status: 'active',
                    is_active: true,
                };

                if (existing) {
                    await supabaseAdmin.from('jobs').update(jobData).eq('id', existing.id);
                    updated++;
                } else {
                    await supabaseAdmin.from('jobs').insert(jobData);
                    newImported++;
                }
            } catch (err) {
                console.error(`[CRON] Error importing ${vacancy.source_id}:`, err);
                errors++;
            }
        }

        // Sync removed/filled
        const { data: existingJobs } = await supabaseAdmin
            .from('jobs')
            .select('id, source_id, source_status')
            .eq('source', 'osonish')
            .eq('is_imported', true)
            .eq('source_status', 'active');

        const activeSet = new Set(result.active_ids);
        const filledSet = new Set(result.filled_ids);
        let removedCount = 0;
        let filledCount = 0;

        for (const job of existingJobs || []) {
            if (!job.source_id) continue;

            if (filledSet.has(job.source_id)) {
                await supabaseAdmin
                    .from('jobs')
                    .update({ source_status: 'filled', is_active: false, last_checked_at: now })
                    .eq('id', job.id);
                filledCount++;
            } else if (!activeSet.has(job.source_id)) {
                await supabaseAdmin
                    .from('jobs')
                    .update({ source_status: 'removed_at_source', is_active: false, last_checked_at: now })
                    .eq('id', job.id);
                removedCount++;
            }
        }

        // Update log
        if (logId) {
            await supabaseAdmin
                .from('import_logs')
                .update({
                    completed_at: new Date().toISOString(),
                    status: errors > 0 ? 'completed_with_errors' : 'completed',
                    total_found: result.debug.list_items_count,
                    new_imported: newImported,
                    updated,
                    errors,
                    removed_at_source: removedCount,
                    marked_filled: filledCount,
                    notes: `2-step: ${result.debug.detail_success_count} details fetched. Duration: ${Date.now() - startTime}ms`
                })
                .eq('id', logId);
        }

        return NextResponse.json({
            success: true,
            code_version: CODE_VERSION,
            regions_cache_count: regionsCache.length,
            districts_cache_count: districtsCache.length,
            debug_samples: debugSamples,
            stats: {
                list_items: result.debug.list_items_count,
                detail_success: result.debug.detail_success_count,
                with_contacts: result.debug.vacancies_with_contacts,
                new_imported: newImported,
                updated,
                errors,
                removed: removedCount,
                filled: filledCount
            },
            duration_ms: Date.now() - startTime
        });

    } catch (error: any) {
        console.error('[CRON] Error:', error);
        return NextResponse.json({ error: 'Cron failed', details: error.message }, { status: 500 });
    }
}

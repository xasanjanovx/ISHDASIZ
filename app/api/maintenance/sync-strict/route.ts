import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route: /api/maintenance/sync-strict
 *
 * Strictly syncs regions, districts, and categories from OsonIsh.uz API:
 * - Inserts new
 * - Updates changed
 * - Deletes records that no longer exist in OsonIsh (after clearing FK references)
 *
 * Query params:
 * - dry_run=1 (no DB writes)
 * - skip_categories=1 (skip categories sync)
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OSONISH_API_BASE_ENV = process.env.OSONISH_API_BASE?.trim();
const trimBase = (value: string) => value.replace(/\/+$/, '');
const toBaseCandidates = (value: string): string[] => {
    const cleaned = trimBase(value);
    if (!cleaned) return [];
    if (cleaned.endsWith('/api/v1')) return [cleaned];
    if (cleaned.endsWith('/api/api/v1')) return [cleaned.replace('/api/api/v1', '/api/v1')];
    return [`${cleaned}/api/v1`];
};
const OSONISH_API_BASES = Array.from(new Set([
    'https://osonish.uz/api/v1',
    ...(OSONISH_API_BASE_ENV ? toBaseCandidates(OSONISH_API_BASE_ENV) : [])
]));

interface OsonishRegion {
    id: number;
    name_uz: string;
    name_ru: string;
    region_soato?: string | number;
    soato?: string | number;
    soato_code?: string | number;
}

interface OsonishDistrict {
    id: number;
    name_uz: string;
    name_ru: string;
    region_id: number;
}

interface OsonishCategory {
    id?: number;
    name_uz: string;
    name_ru: string;
    slug?: string;
    icon?: string;
    sort_order?: number;
}

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/['"`]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/-+/g, '-')
        .trim();
}

function normalizeSlug(slug: string | null | undefined): string {
    return (slug || '').toLowerCase().trim();
}

function chunkArray<T>(items: T[], size: number = 500): T[][] {
    if (items.length === 0) return [];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

async function fetchJson(url: string, retries: number = 3): Promise<{ ok: boolean; status: number; data: any | null; error?: string }> {
    try {
        for (let attempt = 1; attempt <= retries; attempt++) {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://osonish.uz/vacancies'
                },
                next: { revalidate: 0 }
            });

            if (response.status === 429 && attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                continue;
            }

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                return { ok: false, status: response.status, data: null, error: body.slice(0, 300) };
            }

            const data = await response.json();
            return { ok: true, status: response.status, data };
        }
    } catch (error) {
        console.error('[SYNC-STRICT] Fetch error:', url, error);
        return { ok: false, status: 0, data: null, error: String(error) };
    }
    return { ok: false, status: 0, data: null, error: 'Unknown fetch error' };
}

async function fetchFromAnyBase(path: string): Promise<{ ok: boolean; status: number; data: any | null; error?: string }> {
    let last: { ok: boolean; status: number; data: any | null; error?: string } = { ok: false, status: 404, data: null, error: 'Not found on all bases' };
    for (const base of OSONISH_API_BASES) {
        const res = await fetchJson(`${base}${path}`);
        last = res;
        if (res.status === 404) continue;
        return res;
    }
    return last;
}

function extractDataArray(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
}

// ==================== FETCH FUNCTIONS ====================

async function fetchOsonishRegions(): Promise<OsonishRegion[]> {
    const res = await fetchFromAnyBase('/regions');
    if (!res.ok) {
        console.error('[SYNC-STRICT] Regions fetch failed:', res.status, res.error || '');
        return [];
    }
    return extractDataArray(res.data) as OsonishRegion[];
}

async function fetchOsonishDistricts(
    regions: OsonishRegion[]
): Promise<{ districts: OsonishDistrict[]; failed: Array<{ region_id: number; region_soato?: string | number; status: number; error?: string }> }> {
    const all: OsonishDistrict[] = [];
    const failed: Array<{ region_id: number; region_soato?: string | number; status: number; error?: string }> = [];
    for (const region of regions) {
        const regionSoato = region.region_soato ?? region.soato ?? region.soato_code;
        const param = regionSoato ? `region_soato=${encodeURIComponent(String(regionSoato))}` : `region_id=${region.id}`;
        const res = await fetchFromAnyBase(`/cities?${param}`);
        if (!res.ok) {
            failed.push({ region_id: region.id, region_soato: regionSoato, status: res.status, error: res.error });
        } else {
            const cities = extractDataArray(res.data) as OsonishDistrict[];
            for (const city of cities) {
                all.push({ ...city, region_id: region.id });
            }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { districts: all, failed };
}

async function fetchOsonishCategories(): Promise<OsonishCategory[]> {
    const endpoints = [
        '/categories',
        '/vacancy-categories',
        '/mmk_group_fields',
        '/mmk-group-fields'
    ];

    for (const endpoint of endpoints) {
        const res = await fetchFromAnyBase(endpoint);
        if (!res.ok) {
            continue;
        }
        const items = extractDataArray(res.data);
        if (items.length === 0) continue;

        const mapped = items
            .map((item: any) => {
                const nameUz = item.name_uz || item.name || item.title || item.nameUz;
                const nameRu = item.name_ru || item.title_ru || item.titleRu || item.nameRu || nameUz;
                if (!nameUz) return null;
                const slug = item.slug || generateSlug(nameUz);
                return {
                    id: item.id ?? undefined,
                    name_uz: String(nameUz),
                    name_ru: String(nameRu || nameUz),
                    slug,
                    icon: item.icon ?? undefined,
                    sort_order: item.sort_order ?? item.order ?? undefined
                } as OsonishCategory;
            })
            .filter(Boolean) as OsonishCategory[];

        if (mapped.length > 0) return mapped;
    }

    return [];
}

// ==================== FK CLEANUP ====================

async function nullOutReferences(table: string, column: string, ids: Array<string | number>, dryRun: boolean): Promise<void> {
    if (dryRun || ids.length === 0) return;
    const chunks = chunkArray(ids, 500);
    for (const chunk of chunks) {
        const updatePayload: Record<string, null> = { [column]: null };
        const { error } = await supabaseAdmin
            .from(table)
            .update(updatePayload)
            .in(column, chunk);
        if (error) {
            console.error(`[SYNC-STRICT] Failed to null ${table}.${column}:`, error.message);
        }
    }
}

async function clearRegionReferences(regionIds: number[], dryRun: boolean): Promise<void> {
    await Promise.all([
        nullOutReferences('jobs', 'region_id', regionIds, dryRun),
        nullOutReferences('job_seeker_profiles', 'region_id', regionIds, dryRun),
        nullOutReferences('employer_profiles', 'region_id', regionIds, dryRun),
        nullOutReferences('resumes', 'region_id', regionIds, dryRun)
    ]);
}

async function clearDistrictReferences(districtIds: number[], dryRun: boolean): Promise<void> {
    await Promise.all([
        nullOutReferences('jobs', 'district_id', districtIds, dryRun),
        nullOutReferences('job_seeker_profiles', 'district_id', districtIds, dryRun),
        nullOutReferences('employer_profiles', 'district_id', districtIds, dryRun),
        nullOutReferences('resumes', 'district_id', districtIds, dryRun),
        nullOutReferences('admin_profiles', 'district_id', districtIds, dryRun)
    ]);
}

async function clearCategoryReferences(categoryIds: string[], dryRun: boolean): Promise<void> {
    await Promise.all([
        nullOutReferences('jobs', 'category_id', categoryIds, dryRun),
        nullOutReferences('resumes', 'category_id', categoryIds, dryRun)
    ]);
}

// ==================== SYNC FUNCTIONS ====================

async function syncRegionsStrict(sourceRegions: OsonishRegion[], dryRun: boolean) {
    const { data: existing } = await supabaseAdmin
        .from('regions')
        .select('id, name_uz, name_ru, slug');

    const existingMap = new Map((existing || []).map(r => [r.id, r]));
    const sourceIds = new Set<number>();

    let added = 0;
    let updated = 0;
    const upserts = sourceRegions.map(region => {
        sourceIds.add(region.id);
        const slug = generateSlug(region.name_uz);
        const current = existingMap.get(region.id);
        if (!current) added++;
        else if (current.name_uz !== region.name_uz || current.name_ru !== region.name_ru || current.slug !== slug) updated++;
        return {
            id: region.id,
            name_uz: region.name_uz,
            name_ru: region.name_ru,
            slug
        };
    });

    const toDelete = (existing || []).filter(r => !sourceIds.has(r.id)).map(r => r.id);

    if (!dryRun && upserts.length > 0) {
        const { error } = await supabaseAdmin.from('regions').upsert(upserts, { onConflict: 'id' });
        if (error) console.error('[SYNC-STRICT] Region upsert error:', error.message);
    }

    if (toDelete.length > 0) {
        await clearRegionReferences(toDelete, dryRun);
        if (!dryRun) {
            const { error } = await supabaseAdmin.from('regions').delete().in('id', toDelete);
            if (error) console.error('[SYNC-STRICT] Region delete error:', error.message);
        }
    }

    return { added, updated, deleted: toDelete.length, source_count: sourceRegions.length };
}

async function syncDistrictsStrict(sourceDistricts: OsonishDistrict[], dryRun: boolean) {
    const { data: existing } = await supabaseAdmin
        .from('districts')
        .select('id, name_uz, name_ru, region_id');

    const existingMap = new Map((existing || []).map(d => [String(d.id), d]));
    const sourceIds = new Set<string>();

    let added = 0;
    let updated = 0;
    const upserts = sourceDistricts.map(district => {
        const idStr = String(district.id);
        sourceIds.add(idStr);
        const current = existingMap.get(idStr);
        if (!current) added++;
        else if (current.name_uz !== district.name_uz || current.name_ru !== district.name_ru || Number(current.region_id) !== district.region_id) updated++;
        return {
            id: district.id, // Supabase handles number->text cast if needed, or we can stringify
            name_uz: district.name_uz,
            name_ru: district.name_ru,
            region_id: district.region_id
        };
    });

    // Correctly identify IDs to delete (including UUIDs which mismatch strictly numeric source IDs)
    const toDelete = (existing || [])
        .filter(d => !sourceIds.has(String(d.id)))
        .map(d => d.id);

    if (!dryRun && upserts.length > 0) {
        const { error } = await supabaseAdmin.from('districts').upsert(upserts, { onConflict: 'id' });
        if (error) console.error('[SYNC-STRICT] District upsert error:', error.message);
    }

    if (toDelete.length > 0) {
        // We must pass strict IDs. If DB is string, d.id is string.
        await clearDistrictReferences(toDelete as any, dryRun);
        if (!dryRun) {
            const { error } = await supabaseAdmin.from('districts').delete().in('id', toDelete);
            if (error) console.error('[SYNC-STRICT] District delete error:', error.message);
        }
    }

    return { added, updated, deleted: toDelete.length, source_count: sourceDistricts.length };
}

async function syncCategoriesStrict(sourceCategories: OsonishCategory[], dryRun: boolean) {
    const { data: existing } = await supabaseAdmin
        .from('categories')
        .select('id, name_uz, name_ru, slug, icon, sort_order');

    const existingById = new Map((existing || []).map(c => [c.id, c]));
    const existingBySlug = new Map((existing || []).map(c => [normalizeSlug(c.slug), c]));
    const existingByNameUz = new Map((existing || []).map(c => [c.name_uz.toLowerCase().trim(), c]));
    const existingByNameRu = new Map((existing || []).map(c => [c.name_ru.toLowerCase().trim(), c]));

    let added = 0;
    let updated = 0;
    const keepIds = new Set<string>();
    const updates: Array<Record<string, any>> = [];
    const inserts: Array<Record<string, any>> = [];

    for (const cat of sourceCategories) {
        const slug = normalizeSlug(cat.slug || generateSlug(cat.name_uz));
        const bySlug = existingBySlug.get(slug);
        const byNameUz = existingByNameUz.get(cat.name_uz.toLowerCase().trim());
        const byNameRu = existingByNameRu.get(cat.name_ru.toLowerCase().trim());
        const match = bySlug || byNameUz || byNameRu || null;

        if (match) {
            keepIds.add(match.id);
            const nextIcon = cat.icon ?? match.icon;
            const nextSortOrder = cat.sort_order ?? match.sort_order ?? 99;
            if (
                match.name_uz !== cat.name_uz ||
                match.name_ru !== cat.name_ru ||
                normalizeSlug(match.slug) !== slug ||
                match.icon !== nextIcon ||
                match.sort_order !== nextSortOrder
            ) {
                updates.push({
                    id: match.id,
                    name_uz: cat.name_uz,
                    name_ru: cat.name_ru,
                    slug,
                    icon: nextIcon,
                    sort_order: nextSortOrder
                });
                updated++;
            }
        } else {
            inserts.push({
                name_uz: cat.name_uz,
                name_ru: cat.name_ru,
                slug,
                icon: cat.icon ?? 'Briefcase',
                sort_order: cat.sort_order ?? 99
            });
            added++;
        }
    }

    if (!dryRun && updates.length > 0) {
        const { error } = await supabaseAdmin.from('categories').upsert(updates, { onConflict: 'id' });
        if (error) console.error('[SYNC-STRICT] Category upsert error:', error.message);
    }

    if (!dryRun && inserts.length > 0) {
        const { data: inserted, error } = await supabaseAdmin.from('categories').insert(inserts).select('id');
        if (error) console.error('[SYNC-STRICT] Category insert error:', error.message);
        (inserted || []).forEach(row => keepIds.add(row.id));
    }

    // Track kept IDs for updates
    for (const update of updates) keepIds.add(update.id);

    const toDelete = (existing || [])
        .filter(c => !keepIds.has(c.id))
        .map(c => c.id);

    if (toDelete.length > 0) {
        await clearCategoryReferences(toDelete, dryRun);
        if (!dryRun) {
            const { error } = await supabaseAdmin.from('categories').delete().in('id', toDelete);
            if (error) console.error('[SYNC-STRICT] Category delete error:', error.message);
        }
    }

    return { added, updated, deleted: toDelete.length, source_count: sourceCategories.length };
}

// ==================== MAIN HANDLER ====================

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dry_run') === '1' || searchParams.get('dryRun') === '1';
    const forceCategories = searchParams.get('force_categories') === '1';
    // Default to skipping categories because we use internal Title-Based Mapping (ISHDASIZ_CATEGORIES)
    // Syncing OsonIsh categories (which are often empty or incompatible) might wipe our valid categories table.
    const skipCategories = !forceCategories;

    try {
        console.log('[SYNC-STRICT] Starting strict sync from OsonIsh...');

        const regions = await fetchOsonishRegions();
        if (regions.length === 0) {
            return NextResponse.json({ error: 'Failed to fetch regions from OsonIsh' }, { status: 502 });
        }

        const { districts, failed } = await fetchOsonishDistricts(regions);
        if (districts.length === 0) {
            return NextResponse.json(
                { error: 'Failed to fetch districts from OsonIsh', failed_regions: failed.slice(0, 5) },
                { status: 502 }
            );
        }

        // Only fetch categories if explicitly forced
        const categories = skipCategories ? [] : await fetchOsonishCategories();

        // If forced but failed, we warn instead of erroring, to allow regions sync to proceed
        if (!skipCategories && categories.length === 0) {
            console.warn('[SYNC-STRICT] Failed to fetch categories (or empty), skipping category sync.');
        }

        const regionStats = await syncRegionsStrict(regions, dryRun);
        const districtStats = await syncDistrictsStrict(districts, dryRun);

        // Skip category sync logic if empty or skipped
        const categoryStats = (skipCategories || categories.length === 0) ? null : await syncCategoriesStrict(categories, dryRun);

        return NextResponse.json({
            success: true,
            dry_run: dryRun,
            duration_ms: Date.now() - startTime,
            regions: regionStats,
            districts: {
                ...districtStats,
                failed_regions: failed.slice(0, 5)
            },
            categories: categoryStats
        });
    } catch (error: any) {
        console.error('[SYNC-STRICT] Error:', error);
        return NextResponse.json(
            { error: 'Strict reference sync failed', details: error.message },
            { status: 500 }
        );
    }
}


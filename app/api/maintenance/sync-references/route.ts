import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route: /api/maintenance/sync-references
 * 
 * Syncs regions, districts, and categories from OsonIsh.uz API
 * - Adds new items if not found
 * - Updates names/slugs if different from source
 * - Does NOT delete existing items (preserves FK relationships)
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
    soato?: number | string;
    region_soato?: number | string;
}

interface OsonishDistrict {
    id: number;
    name_uz: string;
    name_ru: string;
    region_id: number;
}

// ==================== FETCH FUNCTIONS ====================

async function fetchOsonishRegions(): Promise<OsonishRegion[]> {
    try {
        for (const base of OSONISH_API_BASES) {
            const response = await fetch(`${base}/regions`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://osonish.uz/vacancies'
                },
                next: { revalidate: 0 }
            });
            if (response.status === 404) continue;
            if (!response.ok) return [];
            const json = await response.json();
            return json.data || [];
        }
        return [];
    } catch (error) {
        console.error('[SYNC] Failed to fetch regions:', error);
        return [];
    }
}

async function fetchOsonishCities(region: OsonishRegion): Promise<OsonishDistrict[]> {
    try {
        const regionSoato = region.region_soato ?? region.soato;
        const param = regionSoato ? `region_soato=${regionSoato}` : `region_id=${region.id}`;
        for (const base of OSONISH_API_BASES) {
            const response = await fetch(`${base}/cities?${param}`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://osonish.uz/vacancies'
                },
                next: { revalidate: 0 }
            });
            if (response.status === 404) continue;
            if (!response.ok) return [];
            const json = await response.json();
            return (json.data || []).map((city: any) => ({
                ...city,
                region_id: region.id
            }));
        }
        return [];
    } catch (error) {
        console.error(`[SYNC] Failed to fetch cities for region ${region.id}:`, error);
        return [];
    }
}

// ==================== SYNC FUNCTIONS ====================

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[''ʻʼ]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/-+/g, '-')
        .trim();
}

async function syncRegions(sourceRegions: OsonishRegion[]): Promise<{ added: number; updated: number }> {
    let added = 0, updated = 0;

    const { data: existingRegions } = await supabaseAdmin
        .from('regions')
        .select('id, name_uz, name_ru, slug');

    const existingMap = new Map((existingRegions || []).map(r => [r.id, r]));

    for (const region of sourceRegions) {
        const existing = existingMap.get(region.id);
        const slug = generateSlug(region.name_uz);

        if (!existing) {
            // Insert new region
            const { error } = await supabaseAdmin.from('regions').insert({
                id: region.id,
                name_uz: region.name_uz,
                name_ru: region.name_ru,
                slug
            });
            if (!error) added++;
        } else if (existing.name_uz !== region.name_uz || existing.name_ru !== region.name_ru) {
            // Update if names differ
            const { error } = await supabaseAdmin.from('regions').update({
                name_uz: region.name_uz,
                name_ru: region.name_ru,
                slug
            }).eq('id', region.id);
            if (!error) updated++;
        }
    }

    return { added, updated };
}

async function syncDistricts(sourceDistricts: OsonishDistrict[]): Promise<{ added: number; updated: number }> {
    let added = 0, updated = 0;

    const { data: existingDistricts } = await supabaseAdmin
        .from('districts')
        .select('id, name_uz, name_ru, region_id');

    const existingMap = new Map((existingDistricts || []).map(d => [d.id, d]));

    for (const district of sourceDistricts) {
        const existing = existingMap.get(district.id);

        if (!existing) {
            // Insert new district
            const { error } = await supabaseAdmin.from('districts').insert({
                id: district.id,
                name_uz: district.name_uz,
                name_ru: district.name_ru,
                region_id: district.region_id
            });
            if (!error) added++;
            else console.error(`[SYNC] District insert error ${district.id}:`, error.message);
        } else if (existing.name_uz !== district.name_uz || existing.name_ru !== district.name_ru) {
            // Update if names differ
            const { error } = await supabaseAdmin.from('districts').update({
                name_uz: district.name_uz,
                name_ru: district.name_ru
            }).eq('id', district.id);
            if (!error) updated++;
        }
    }

    return { added, updated };
}

// ==================== MAIN HANDLER ====================

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        console.log('[SYNC] Starting reference data sync from OsonIsh...');

        // Fetch regions
        const regions = await fetchOsonishRegions();
        console.log(`[SYNC] Found ${regions.length} regions in OsonIsh`);

        // Sync regions
        const regionStats = await syncRegions(regions);
        console.log(`[SYNC] Regions: ${regionStats.added} added, ${regionStats.updated} updated`);

        // Fetch all districts (cities) for each region
        const allDistricts: OsonishDistrict[] = [];
        for (const region of regions) {
            const cities = await fetchOsonishCities(region);
            allDistricts.push(...cities);
            // Small delay to be nice to API
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log(`[SYNC] Found ${allDistricts.length} districts in OsonIsh`);

        // Sync districts
        const districtStats = await syncDistricts(allDistricts);
        console.log(`[SYNC] Districts: ${districtStats.added} added, ${districtStats.updated} updated`);

        const duration = Date.now() - startTime;

        return NextResponse.json({
            success: true,
            duration_ms: duration,
            regions: {
                source_count: regions.length,
                added: regionStats.added,
                updated: regionStats.updated
            },
            districts: {
                source_count: allDistricts.length,
                added: districtStats.added,
                updated: districtStats.updated
            }
        });

    } catch (error: any) {
        console.error('[SYNC] Error:', error);
        return NextResponse.json(
            { error: 'Reference sync failed', details: error.message },
            { status: 500 }
        );
    }
}


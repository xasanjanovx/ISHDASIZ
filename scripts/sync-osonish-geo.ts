/**
 * Sync regions and districts from OsonIsh API
 * 
 * Usage: npx tsx scripts/sync-osonish-geo.ts
 * 
 * This script:
 * 1. Fetches all vacancies from OsonIsh API
 * 2. Extracts unique regions and cities (districts)
 * 3. Outputs SQL INSERT statements to populate the database
 */

import 'dotenv/config';

const API_BASE = 'https://osonish.uz/api/api/v1';
const PER_PAGE = 100;
const MAX_PAGES = 50;

interface OsonishRegion {
    id: number;
    name_uz?: string;
    name_ru?: string;
}

interface OsonishCity {
    id: number;
    name_uz?: string;
    name_ru?: string;
}

interface FilialData {
    region?: OsonishRegion;
    city?: OsonishCity;
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchVacancyIds(page: number): Promise<number[]> {
    const url = `${API_BASE}/vacancies?page=${page}&per_page=${PER_PAGE}&status=2&is_offer=0`;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        });

        if (!res.ok) return [];

        const json = await res.json();
        const items = json?.data?.data ?? [];
        return items.map((item: any) => item.id);
    } catch (e) {
        console.error(`Error fetching page ${page}:`, e);
        return [];
    }
}

async function fetchVacancyDetail(id: number): Promise<FilialData | null> {
    const url = `${API_BASE}/vacancies/${id}`;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        });

        if (!res.ok) return null;

        const json = await res.json();
        return json?.data?.filial || null;
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log('🔍 Fetching all vacancies from OsonIsh...\n');

    const regions = new Map<number, OsonishRegion>();
    const cities = new Map<number, { city: OsonishCity; regionId: number }>();

    // Collect all vacancy IDs
    const allIds: number[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
        const ids = await fetchVacancyIds(page);
        if (ids.length === 0) break;

        allIds.push(...ids);
        console.log(`📄 Page ${page}: ${ids.length} vacancies`);

        await sleep(100);
    }

    console.log(`\n📊 Total: ${allIds.length} vacancies\n`);
    console.log('🔄 Extracting regions and districts...\n');

    // Process in batches
    let processed = 0;
    const BATCH_SIZE = 10;

    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
        const batch = allIds.slice(i, i + BATCH_SIZE);

        const results = await Promise.all(
            batch.map(async (id) => {
                const filial = await fetchVacancyDetail(id);
                return { id, filial };
            })
        );

        for (const { filial } of results) {
            if (!filial) continue;

            if (filial.region && filial.region.id) {
                regions.set(filial.region.id, {
                    id: filial.region.id,
                    name_uz: filial.region.name_uz || '',
                    name_ru: filial.region.name_ru || ''
                });
            }

            if (filial.city && filial.city.id && filial.region?.id) {
                cities.set(filial.city.id, {
                    city: {
                        id: filial.city.id,
                        name_uz: filial.city.name_uz || '',
                        name_ru: filial.city.name_ru || ''
                    },
                    regionId: filial.region.id
                });
            }
        }

        processed += batch.length;
        if (processed % 100 === 0) {
            console.log(`   Processed ${processed}/${allIds.length} (${regions.size} regions, ${cities.size} districts)`);
        }

        await sleep(200);
    }

    console.log(`\n✅ Found ${regions.size} regions and ${cities.size} districts\n`);

    // Output regions
    console.log('='.repeat(60));
    console.log('REGIONS (from OsonIsh API):');
    console.log('='.repeat(60));

    const sortedRegions = Array.from(regions.values()).sort((a, b) => a.id - b.id);

    for (const r of sortedRegions) {
        console.log(`  ${r.id}: ${r.name_uz} / ${r.name_ru}`);
    }

    // Output districts
    console.log('\n' + '='.repeat(60));
    console.log('DISTRICTS (from OsonIsh API):');
    console.log('='.repeat(60));

    const sortedCities = Array.from(cities.values()).sort((a, b) => a.city.id - b.city.id);

    for (const { city, regionId } of sortedCities) {
        const regionName = regions.get(regionId)?.name_uz || 'Unknown';
        console.log(`  ${city.id}: ${city.name_uz} (Region: ${regionId} - ${regionName})`);
    }

    // Generate SQL
    console.log('\n' + '='.repeat(60));
    console.log('SQL TO INSERT (copy and run in Supabase):');
    console.log('='.repeat(60));

    console.log('\n-- Clear existing data');
    console.log('TRUNCATE TABLE districts CASCADE;');
    console.log('TRUNCATE TABLE regions CASCADE;');

    console.log('\n-- Insert regions (using OsonIsh IDs)');
    console.log('INSERT INTO regions (id, name_uz, name_ru, slug) VALUES');

    const regionValues = sortedRegions.map(r => {
        const slug = (r.name_uz || '')
            .toLowerCase()
            .replace(/'/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
        const nameUz = (r.name_uz || '').replace(/'/g, "''");
        const nameRu = (r.name_ru || '').replace(/'/g, "''");
        return `  (${r.id}, '${nameUz}', '${nameRu}', '${slug}')`;
    });

    console.log(regionValues.join(',\n') + '\nON CONFLICT (id) DO UPDATE SET name_uz = EXCLUDED.name_uz, name_ru = EXCLUDED.name_ru;');

    console.log('\n-- Insert districts (using OsonIsh IDs)');
    console.log('INSERT INTO districts (id, name_uz, name_ru, region_id) VALUES');

    const districtValues = sortedCities.map(({ city, regionId }) => {
        const nameUz = (city.name_uz || '').replace(/'/g, "''");
        const nameRu = (city.name_ru || '').replace(/'/g, "''");
        return `  (${city.id}, '${nameUz}', '${nameRu}', ${regionId})`;
    });

    console.log(districtValues.join(',\n') + '\nON CONFLICT (id) DO UPDATE SET name_uz = EXCLUDED.name_uz, name_ru = EXCLUDED.name_ru, region_id = EXCLUDED.region_id;');

    console.log('\n-- Reset sequences');
    console.log(`SELECT setval('regions_id_seq', (SELECT MAX(id) FROM regions) + 1);`);
    console.log(`SELECT setval('districts_id_seq', (SELECT MAX(id) FROM districts) + 1);`);

    console.log('\n✅ Done! Copy the SQL above and run it in Supabase SQL Editor.');
}

main().catch(console.error);


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { OSONISH_REGION_MAP, OSONISH_DISTRICT_MAP } from '../lib/mappers/osonish-locations';

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function fixLocations() {
    console.log('Fetching OsonIsh jobs for location fix...');

    // Fetch dictionary to map IDs back to NAMES (for verifying)
    const { data: regions } = await supabase.from('regions').select('id, name_uz');
    const { data: districts } = await supabase.from('districts').select('id, name_uz');

    if (!regions || !districts) throw new Error('Dict failed');

    const regionNameMap = new Map(regions.map(r => [r.id, r.name_uz]));
    const districtNameMap = new Map(districts.map(d => [d.id, d.name_uz]));

    let page = 0;
    const pageSize = 1000;
    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    while (true) {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('id, raw_source_json')
            .eq('source', 'osonish')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching jobs:', error);
            break;
        }

        if (!jobs || jobs.length === 0) break;

        console.log(`Processing batch ${page + 1}... (${jobs.length} jobs)`);

        const updates = jobs.map(async (job) => {
            const raw = job.raw_source_json;
            if (!raw) return;

            const rawRegionId = raw.filial?.region?.id;
            const rawDistrictId = raw.filial?.city?.id;

            let regionId: number | null = null;
            let districtId: number | null = null;

            if (rawRegionId && OSONISH_REGION_MAP[rawRegionId]) {
                regionId = OSONISH_REGION_MAP[rawRegionId];
            }

            if (rawDistrictId && OSONISH_DISTRICT_MAP[rawDistrictId]) {
                districtId = OSONISH_DISTRICT_MAP[rawDistrictId];
            }

            const regionName = regionId ? regionNameMap.get(regionId) : null;
            const districtName = districtId ? districtNameMap.get(districtId) : null;

            if (regionId || districtId) {
                const updateData: any = {};
                if (regionId) {
                    updateData.region_id = regionId;
                    if (regionName) updateData.region_name = regionName;
                }
                if (districtId) {
                    updateData.district_id = districtId;
                    if (districtName) updateData.district_name = districtName;
                }

                const { error: updateError } = await supabase
                    .from('jobs')
                    .update(updateData)
                    .eq('id', job.id);

                if (updateError) {
                    if (JSON.stringify(updateError).includes('timeout') || JSON.stringify(updateError).includes('fetch failed')) {
                        errorCount++; // silent count
                    } else {
                        console.error(`Failed to update job ${job.id}:`, updateError);
                        errorCount++;
                    }
                } else {
                    updatedCount++;
                }
            } else {
                skippedCount++;
            }
        });

        // Run updates concurrently in chunks - LOW CONCURRENCY TO AVOID TIMEOUTS
        const chunkSize = 5;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            await Promise.all(chunk);
            // Longer delay for stability
            await new Promise(resolve => setTimeout(resolve, 500));

            if ((i + chunkSize) % 200 === 0) {
                process.stdout.write('.');
            }
        }
        console.log(` Batch completed.`);

        if (jobs.length < pageSize) break;
        page++;
    }

    console.log(`Done! Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
}

fixLocations().catch(console.error);

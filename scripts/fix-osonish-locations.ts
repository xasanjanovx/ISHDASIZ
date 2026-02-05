import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { OSONISH_REGION_MAP, OSONISH_DISTRICT_MAP } from '../lib/mappers/osonish-locations';

const envLocal = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal });
}
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function normalizeName(value?: string | null) {
    if (!value) return '';
    return value
        .toLowerCase()
        .replace(/[\u2018\u2019\u00B4\u02BB\u02BC\u02BF\u02BE]/g, "'")
        .replace(/['`]/g, '')
        .replace(/(viloyati|viloyat|shahri|shahar|sh\.|tumani|tuman|rayon|respublikasi|respublika)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function fixLocations() {
    console.log('Fetching OsonIsh jobs for location fix...');

    const { data: regions } = await supabase.from('regions').select('id, name_uz');
    const { data: districts } = await supabase.from('districts').select('id, name_uz, region_id');

    if (!regions || !districts) throw new Error('Dict failed');

    const regionNameMap = new Map(regions.map(r => [r.id, r.name_uz]));
    const districtNameMap = new Map(districts.map(d => [d.id, d.name_uz]));

    let page = 0;
    const pageSize = 500;
    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    while (true) {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('id, raw_source_json, region_id, district_id, region_name, district_name')
            .eq('source', 'osonish')
            .or('region_id.is.null,district_id.is.null')
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

            let regionId: number | null = job.region_id ?? null;
            let districtId: number | null = job.district_id ?? null;

            if (!regionId && rawRegionId && OSONISH_REGION_MAP[String(rawRegionId)]) {
                regionId = OSONISH_REGION_MAP[String(rawRegionId)];
            }

            if (!districtId && rawDistrictId && OSONISH_DISTRICT_MAP[String(rawDistrictId)]) {
                districtId = OSONISH_DISTRICT_MAP[String(rawDistrictId)];
            }

            // Fallback by name if district still missing
            if (!districtId) {
                const nameCandidate = job.district_name || raw?.filial?.city?.name_uz || raw?.filial?.city?.name_ru || '';
                const normName = normalizeName(nameCandidate);
                if (normName) {
                    const pool = regionId ? districts.filter(d => d.region_id === regionId) : districts;
                    const exact = pool.find(d => normalizeName(d.name_uz) === normName);
                    const fuzzy = exact ? null : pool.find(d => {
                        const n = normalizeName(d.name_uz);
                        return n.includes(normName) || normName.includes(n);
                    });
                    const match = exact || fuzzy;
                    if (match) districtId = match.id;
                }
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
                        errorCount++;
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

        const chunkSize = 10;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            await Promise.all(chunk);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        console.log(` Batch completed.`);

        if (jobs.length < pageSize) break;
        page++;
    }

    console.log(`Done! Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
}

fixLocations().catch(console.error);

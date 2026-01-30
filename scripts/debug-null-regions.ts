
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugFailingRegions() {
    console.log('Fetching samples of jobs with NULL Region ID...');

    const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .is('region_id', null)
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!jobs || jobs.length === 0) {
        console.log('No failing jobs found?');
        return;
    }

    console.log(`Found ${jobs.length} samples. analyzing raw JSON...`);

    jobs.forEach((job, i) => {
        const raw = job.raw_source_json;
        // Check likely paths for region name
        const regionName = raw?.filial?.region?.name_lz || raw?.region_name || raw?.region;
        const districtName = raw?.filial?.city?.name_lz || raw?.district_name || raw?.district;

        console.log(`\n--- Job ${i + 1} (ID: ${job.source_id}) ---`);
        console.log(`Title: ${job.title_uz}`);
        console.log(`Raw Region Field:`, JSON.stringify(raw?.filial?.region)); // Check structure
        console.log(`Raw District Field:`, JSON.stringify(raw?.filial?.city));
        console.log(`Extracted Region Name: ${regionName}`);
        console.log(`Extracted District Name: ${districtName}`);
    });
}

debugFailingRegions();


import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
    console.log('Checking schema...');

    // We can't easily query information_schema via JS client unless we have raw SQL access which we might not have exposed.
    // Instead, we can insert a dummy row or just fetch one row and check the type of the ID.

    // Fetch 1 region
    const { data: regions } = await supabase.from('regions').select('*').limit(1);
    const region = regions?.[0];
    console.log('Region Sample:', region);
    console.log('Region ID type:', typeof region?.id);

    // Fetch 1 job
    const { data: jobs } = await supabase.from('jobs').select('region_id, district_id').limit(1).not('region_id', 'is', null);
    const job = jobs?.[0];
    console.log('Job Sample:', job);
    console.log('Job region_id type:', typeof job?.region_id);
}

checkSchema();

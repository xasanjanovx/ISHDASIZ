const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRawCategories() {
    const { data: jobs } = await supabase
        .from('jobs')
        .select('id, raw_source_json')
        .eq('is_active', true)
        .is('category_id', null)
        .limit(10);

    if (jobs && jobs.length > 0) {
        console.log('Sample raw categories:', jobs.map(j => j.raw_source_json?.categories));
    } else {
        console.log('No active jobs with null category found (or none returned).');
    }
}

checkRawCategories();

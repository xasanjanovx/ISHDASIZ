const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
    console.log('Fetching categories...');
    const { data: categories, error: catError } = await supabase.from('categories').select('*');
    if (catError) console.error('Categories error:', catError);
    else console.log('Categories count:', categories.length);

    console.log('Fetching active jobs counts...');
    const { data: jobs, error: jobError } = await supabase
        .from('jobs')
        .select('category_id')
        .eq('is_active', true);

    if (jobError) console.error('Jobs error:', jobError);
    else {
        console.log('Total active jobs:', jobs.length);
        const counts = {};
        jobs.forEach(j => {
            if (j.category_id) counts[j.category_id] = (counts[j.category_id] || 0) + 1;
        });
        console.log('Counts per category:', counts);
    }
}

checkCategories();

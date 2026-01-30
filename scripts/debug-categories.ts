
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOtherCategories() {
    console.log('Fetching jobs in OTHER category...');

    // Get ID for "Boshqa" (Other)
    const { data: cats } = await supabase.from('categories').select('id, name_uz').ilike('name_uz', '%Boshqa%');
    if (!cats || cats.length === 0) {
        console.log('Category Boshqa not found');
        return;
    }
    const otherId = cats[0].id;
    console.log(`Other Category ID: ${otherId}`);

    const { data: jobs } = await supabase
        .from('jobs')
        .select('title_uz, raw_source_json')
        .eq('category_id', otherId)
        .limit(50);

    if (!jobs) return;

    console.log(`Found ${jobs.length} sample jobs in OTHER. Analyzing...`);

    jobs.forEach(j => {
        const raw = j.raw_source_json as any;
        const cat1 = raw?.mmk_group?.cat1;
        const cat2 = raw?.mmk_group?.cat2;
        const cat3 = raw?.mmk_group?.cat3;
        console.log(`Title: ${j.title_uz}`);
        console.log(`   Source Cat: ${cat2} | ${cat1}`);
    });
}

checkOtherCategories();

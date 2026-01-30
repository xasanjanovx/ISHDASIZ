
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Load environment variables
// dotenv is loaded via 'dotenv/config' import

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCounts() {
    console.log('Checking database counts...');

    // 1. Total Active Jobs
    const { count: total, error: countError } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

    if (countError) console.error('Error counting jobs:', countError);
    console.log(`Total Active Jobs: ${total}`);

    // 2. Counts by Category
    const { data: jobs, error: dataError } = await supabase
        .from('jobs')
        .select('category_id, region_id')
        .eq('status', 'active');

    if (dataError) {
        console.error('Error fetching jobs data:', dataError);
        return;
    }

    if (!jobs) return;

    const categoryCounts: Record<string, number> = {};
    const regionCounts: Record<string, number> = {};
    let nullCategory = 0;
    let nullRegion = 0;

    jobs.forEach(job => {
        if (job.category_id) {
            categoryCounts[job.category_id] = (categoryCounts[job.category_id] || 0) + 1;
        } else {
            nullCategory++;
        }

        if (job.region_id) {
            regionCounts[job.region_id] = (regionCounts[job.region_id] || 0) + 1;
        } else {
            nullRegion++;
        }
    });

    console.log('\n--- BY CATEGORY ---');
    console.log(`NULL Category: ${nullCategory}`);

    // Fetch Category Names for context
    if (Object.keys(categoryCounts).length > 0) {
        const ids = Object.keys(categoryCounts);
        // split into chunks if needed, but 100 cats is fine
        const { data: cats } = await supabase
            .from('categories')
            .select('id, name_uz')
            .in('id', ids);

        const catMap = new Map(cats?.map(c => [c.id, c.name_uz]));

        Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20) // Top 20
            .forEach(([id, count]) => {
                console.log(`${catMap.get(id) || id}: ${count}`);
            });
    }

    console.log('\n--- BY REGION ---');
    console.log(`NULL Region: ${nullRegion}`);
    // No need to fetch names for now
    Object.entries(regionCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([id, count]) => {
            console.log(`Region ${id}: ${count}`);
        });
}

checkCounts();

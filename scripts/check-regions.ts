
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRegions() {
    console.log('Checking regions table...');
    const { data, error } = await supabase.from('regions').select('*');

    if (error) {
        console.error('Error fetching regions:', error);
        return;
    }

    console.log(`Found ${data?.length} regions.`);
    if (data && data.length > 0) {
        console.log('First 3 regions:', data.slice(0, 3));
    } else {
        console.log('Regions table is empty!');
    }
}

checkRegions();

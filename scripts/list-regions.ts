
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listRegions() {
    console.log('Listing all regions...');
    const { data: regions } = await supabase.from('regions').select('*').order('id');
    console.log(regions);
}

listRegions();

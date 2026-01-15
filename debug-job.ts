
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const { data, error } = await supabase
        .from('jobs')
        .select('raw_source_json')
        .eq('id', '4d34126f-1e59-4b65-9eef-40fd569363e9')
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(JSON.stringify(data.raw_source_json, null, 2));
}

main();

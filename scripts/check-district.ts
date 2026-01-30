
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDistrict() {
    console.log('Checking District ID 140...');
    const { data: districts } = await supabase
        .from('districts')
        .select('*')
        .eq('id', 140);

    console.log(districts);
}

checkDistrict();

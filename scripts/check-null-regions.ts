
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkGlobalNulls() {
    console.log('Checking global NULL counts...');

    const { count: total } = await supabase.from('jobs').select('*', { count: 'exact', head: true });

    const { count: nullRegion } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .is('region_id', null);

    const { count: nullDistrict } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .is('district_id', null);

    console.log(`Total Jobs: ${total}`);
    console.log(`Jobs with NULL Region: ${nullRegion} (${((nullRegion! / total!) * 100).toFixed(1)}%)`);
    console.log(`Jobs with NULL District: ${nullDistrict} (${((nullDistrict! / total!) * 100).toFixed(1)}%)`);
}

checkGlobalNulls();

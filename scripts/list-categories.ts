
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listCategories() {
    console.log('Fetching ALL categories from DB...');

    const { data: cats, error } = await supabase.from('categories').select('id, name_uz, name_ru').order('name_uz');

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!cats || cats.length === 0) {
        console.log('No categories found.');
        return;
    }

    console.log('// CURRENT DB CATEGORIES');
    console.log('export const ISHDASIZ_CATEGORIES = {');
    cats.forEach(c => {
        let key = 'UNKNOWN';
        const name = c.name_uz.toLowerCase();
        if (name.includes('axborot')) key = 'IT';
        if (name.includes('sanoat')) key = 'PRODUCTION';
        if (name.includes('xizmatlar')) key = 'SERVICES';
        if (name.includes('ta\'lim')) key = 'EDUCATION';
        if (name.includes('sog\'liqni')) key = 'HEALTHCARE';
        if (name.includes('moliya')) key = 'FINANCE';
        if (name.includes('qurilish')) key = 'CONSTRUCTION';
        if (name.includes('qishloq')) key = 'AGRICULTURE';
        if (name.includes('transport')) key = 'TRANSPORT';
        if (name.includes('savdo')) key = 'SALES';
        if (name.includes('boshqa')) key = 'OTHER';

        console.log(`    ${key}: '${c.id}', // ${c.name_uz}`);
    });
    console.log('};');
}

listCategories();


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const localId = 'c121a929-7855-42c5-9c7e-fcb576423d52';
    const remoteId = 140;

    console.log('--- FETCHING LOCAL JOB ---');
    const { data: localJob, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', localId)
        .single();

    if (error) {
        console.error('Error fetching local job:', error);
    } else {
        console.log('Local Job Data:', JSON.stringify(localJob, null, 2));
    }

    console.log('\n--- FETCHING REMOTE VACANCY ---');
    try {
        const response = await fetch(`https://osonish.uz/api/v1/vacancies/${remoteId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        const json = await response.json();
        console.log('Remote Job Data:', JSON.stringify(json.data, null, 2));
    } catch (err) {
        console.error('Error fetching remote:', err);
    }
}

main();


import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const phone = process.argv[2];

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE env vars.');
    process.exit(1);
}

if (!phone) {
    console.error('Usage: npx tsx scripts/delete-user-by-phone.ts +998XXXXXXXXX');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function safeDelete(table: string, column: string, value: string) {
    const { error } = await supabase.from(table).delete().eq(column, value);
    if (error) {
        console.warn(`[WARN] ${table} delete failed:`, error.message);
        return;
    }
    console.log(`[OK] ${table} cleared by ${column}=${value}`);
}

async function main() {
    const { data: user, error } = await supabase
        .from('users')
        .select('id, telegram_user_id')
        .eq('phone', phone)
        .maybeSingle();

    if (error) {
        console.error('User lookup error:', error.message);
        process.exit(1);
    }

    if (!user) {
        console.log('User not found for phone:', phone);
        return;
    }

    const userId = user.id as string;
    const telegramUserId = user.telegram_user_id as number | null;

    await safeDelete('applications', 'user_id', userId);
    await safeDelete('job_applications', 'user_id', userId);
    await safeDelete('jobs', 'created_by', userId);
    await safeDelete('resumes', 'user_id', userId);
    await safeDelete('job_seeker_profiles', 'user_id', userId);
    await safeDelete('employer_profiles', 'user_id', userId);

    if (telegramUserId) {
        await safeDelete('telegram_sessions', 'telegram_user_id', String(telegramUserId));
    }

    await safeDelete('users', 'id', userId);

    console.log('Done.');
}

main().catch((err) => {
    console.error('Delete failed:', err);
    process.exit(1);
});

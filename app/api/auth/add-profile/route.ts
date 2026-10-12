import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SESSION_COOKIE, verifyAuthToken, passwordVersion, readAuthUser } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const body = await request.json().catch(() => null);
        const user_id = body?.user_id;
        const role = body?.role;
        const session = verifyAuthToken(request.cookies.get(SESSION_COOKIE)?.value, 'session');
        if (!session || session.userId !== user_id) {
            return NextResponse.json({ error: 'Avval tizimga kiring.' }, { status: 401 });
        }

        if (!user_id || !role) {
            return NextResponse.json({ error: 'user_id and role are required' }, { status: 400 });
        }

        if (role !== 'job_seeker' && role !== 'employer') {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        // Get user
        const { data: user, error: userError } = await readAuthUser(supabase, 'id, phone, password_hash', 'id', user_id);

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.closed_at || session.passwordVersion !== passwordVersion(user.password_hash, user.session_version)) {
            return NextResponse.json({ error: 'Avval tizimga kiring.' }, { status: 401 });
        }

        // Check if profile already exists
        const tableName = role === 'job_seeker' ? 'job_seeker_profiles' : 'employer_profiles';

        const { data: existingProfile } = await supabase
            .from(tableName)
            .select('id')
            .eq('user_id', user_id)
            .maybeSingle();

        if (existingProfile) {
            return NextResponse.json({
                error: role === 'job_seeker'
                    ? 'Ish qidiruvchi profili allaqachon mavjud'
                    : 'Ish beruvchi profili allaqachon mavjud',
                exists: true
            }, { status: 400 });
        }

        // Create the profile
        const { data: newProfile, error: profileError } = await supabase
            .from(tableName)
            .insert({ user_id, phone: user.phone })
            .select()
            .single();

        if (profileError) {
            console.error('Profile creation error:', profileError);
            return NextResponse.json({
                error: 'Profil yaratishda xatolik',
                details: profileError.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: role === 'job_seeker'
                ? 'Ish qidiruvchi profili yaratildi'
                : 'Ish beruvchi profili yaratildi',
            profile: newProfile
        });

    } catch (error) {
        console.error('Add profile error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

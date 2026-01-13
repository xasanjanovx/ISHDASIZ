import { NextRequest, NextResponse } from 'next/server';
import { getOneIdAccessToken, getOneIdUserData } from '@/lib/oneid';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle errors from OneID
    if (error) {
        console.error('OneID error:', error);
        return NextResponse.redirect(
            new URL('/profile/employer/verification?error=oneid_denied', request.url)
        );
    }

    if (!code || !state) {
        return NextResponse.redirect(
            new URL('/profile/employer/verification?error=missing_params', request.url)
        );
    }

    // Verify state
    const cookieStore = await cookies();
    const savedState = cookieStore.get('oneid_state')?.value;

    if (state !== savedState) {
        return NextResponse.redirect(
            new URL('/profile/employer/verification?error=invalid_state', request.url)
        );
    }

    // Clear state cookie
    cookieStore.delete('oneid_state');

    try {
        // Exchange code for token
        const accessToken = await getOneIdAccessToken(code);
        if (!accessToken) {
            return NextResponse.redirect(
                new URL('/profile/employer/verification?error=token_failed', request.url)
            );
        }

        // Get user data from OneID
        const userData = await getOneIdUserData(accessToken);
        if (!userData) {
            return NextResponse.redirect(
                new URL('/profile/employer/verification?error=userinfo_failed', request.url)
            );
        }

        // Get user ID from session (stored in cookie)
        const userId = cookieStore.get('pending_verification_user')?.value;
        if (!userId) {
            return NextResponse.redirect(
                new URL('/profile/employer/verification?error=session_expired', request.url)
            );
        }

        // Update employer profile in Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_KEY;

        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey, {
                auth: { persistSession: false }
            });

            await supabase.from('employer_profiles').update({
                company_name: userData.company_name,
                inn: userData.inn,
                address: userData.legal_address,
                director_name: userData.director_name,
                is_verified: true,
                verified_via: 'oneid',
                verified_at: new Date().toISOString()
            }).eq('user_id', userId);

            console.log('✅ Employer verified via OneID:', userId);
        }

        // Clear pending user cookie
        cookieStore.delete('pending_verification_user');

        // Redirect with success
        return NextResponse.redirect(
            new URL('/profile/employer/verification?success=true', request.url)
        );

    } catch (err) {
        console.error('OneID callback error:', err);
        return NextResponse.redirect(
            new URL('/profile/employer/verification?error=unknown', request.url)
        );
    }
}

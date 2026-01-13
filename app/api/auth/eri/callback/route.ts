import { NextRequest, NextResponse } from 'next/server';
import { verifyEriSignature } from '@/lib/eri';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const signedData = searchParams.get('signed_data');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle errors from ERI
    if (error) {
        console.error('ERI error:', error);
        return NextResponse.redirect(
            new URL('/profile/employer/verification?error=eri_denied', request.url)
        );
    }

    if (!signedData || !state) {
        return NextResponse.redirect(
            new URL('/profile/employer/verification?error=missing_params', request.url)
        );
    }

    // Verify state
    const cookieStore = await cookies();
    const savedState = cookieStore.get('eri_state')?.value;

    if (state !== savedState) {
        return NextResponse.redirect(
            new URL('/profile/employer/verification?error=invalid_state', request.url)
        );
    }

    // Clear state cookie
    cookieStore.delete('eri_state');

    try {
        // Verify ERI signature and get data
        const userData = await verifyEriSignature(signedData);
        if (!userData) {
            return NextResponse.redirect(
                new URL('/profile/employer/verification?error=verify_failed', request.url)
            );
        }

        // Get user ID from session
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
                director_name: userData.director_name,
                is_verified: true,
                verified_via: 'eri',
                verified_at: new Date().toISOString()
            }).eq('user_id', userId);

            console.log('✅ Employer verified via ERI:', userId);
        }

        // Clear pending user cookie
        cookieStore.delete('pending_verification_user');

        // Redirect with success
        return NextResponse.redirect(
            new URL('/profile/employer/verification?success=true', request.url)
        );

    } catch (err) {
        console.error('ERI callback error:', err);
        return NextResponse.redirect(
            new URL('/profile/employer/verification?error=unknown', request.url)
        );
    }
}

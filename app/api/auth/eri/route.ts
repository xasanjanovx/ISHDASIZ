import { NextResponse } from 'next/server';
import { getEriAuthUrl, isEriConfigured } from '@/lib/eri';
import { cookies } from 'next/headers';

export async function GET() {
    // Check if ERI is configured
    if (!isEriConfigured()) {
        return NextResponse.json(
            { error: 'ERI is not configured. Please contact administrator.' },
            { status: 503 }
        );
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in cookie for verification on callback
    const cookieStore = await cookies();
    cookieStore.set('eri_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10 // 10 minutes
    });

    // Redirect to ERI
    const authUrl = getEriAuthUrl(state);
    return NextResponse.redirect(authUrl);
}

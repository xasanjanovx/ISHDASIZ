import { NextResponse } from 'next/server';
import { getOneIdAuthUrl, isOneIdConfigured } from '@/lib/oneid';
import { cookies } from 'next/headers';

export async function GET() {
    // Check if OneID is configured
    if (!isOneIdConfigured()) {
        return NextResponse.json(
            { error: 'OneID is not configured. Please contact administrator.' },
            { status: 503 }
        );
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in cookie for verification on callback
    const cookieStore = await cookies();
    cookieStore.set('oneid_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10 // 10 minutes
    });

    // Redirect to OneID
    const authUrl = getOneIdAuthUrl(state);
    return NextResponse.redirect(authUrl);
}

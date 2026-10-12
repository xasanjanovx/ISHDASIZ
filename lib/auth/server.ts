import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {compatibleColumns} from './compatible-columns';

export const SESSION_COOKIE = 'ishdasiz_session';
export const OTP_COOKIE = 'ishdasiz_otp_proof';
const SESSION_SECONDS = 30 * 24 * 60 * 60;

export function normalizePhone(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const digits = value.replace(/[\s()+-]/g, '');
    if (/^\d{9}$/.test(digits)) return `+998${digits}`;
    return /^998\d{9}$/.test(digits) ? `+${digits}` : null;
}

export function getAuthClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_KEY;
    if (!url || !key) throw new Error('Authentication database is not configured');
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface AuthToken {
    purpose: 'session' | 'password';
    userId: string;
    phone: string;
    expiresAt: number;
    passwordVersion: string;
}

export function passwordVersion(hash?: string | null, sessionVersion = 0): string {
    // Epoch zero preserves existing cookies. Closing and restoring advance it.
    return createHash('sha256').update(sessionVersion ? `${sessionVersion}:${hash || ''}` : hash || '').digest('hex');
}

export async function readAuthUser(client: SupabaseClient, fields: string, key: string, value: string) {
    const result = await compatibleColumns(client,'users',fields,['closed_at','session_version'],key,value);
    return result as { data: any; error: any };
}

function signingKey(): string {
    const key = process.env.AUTH_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_KEY;
    if (!key) throw new Error('Authentication signing key is not configured');
    return key;
}

export function signAuthToken(token: AuthToken): string {
    const payload = Buffer.from(JSON.stringify(token)).toString('base64url');
    const signature = createHmac('sha256', signingKey()).update(payload).digest('base64url');
    return `${payload}.${signature}`;
}

export function verifyAuthToken(value: string | undefined, purpose: AuthToken['purpose']): AuthToken | null {
    if (!value) return null;
    try {
        const parts = value.split('.');
        if (parts.length !== 2) return null;
        const [payload, signature] = parts;
        const expected = createHmac('sha256', signingKey()).update(payload).digest();
        const actual = Buffer.from(signature, 'base64url');
        if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) return null;
        const token: AuthToken = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (token.purpose !== purpose || !token.userId || !normalizePhone(token.phone)
            || !Number.isFinite(token.expiresAt) || token.expiresAt <= Date.now()
            || typeof token.passwordVersion !== 'string') return null;
        return token;
    } catch {
        return null;
    }
}

export function setAuthCookie(response: NextResponse, user: { id: string; phone: string; password_hash?: string | null; session_version?: number }, purpose: AuthToken['purpose'] = 'session') {
    const maxAge = purpose === 'session' ? SESSION_SECONDS : 5 * 60;
    response.cookies.set(purpose === 'session' ? SESSION_COOKIE : OTP_COOKIE, signAuthToken({
        purpose, userId: user.id, phone: user.phone, expiresAt: Date.now() + maxAge * 1000,
        passwordVersion: passwordVersion(user.password_hash, user.session_version),
    }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge });
    return response;
}

export async function getPublicUser(client: SupabaseClient, user: { id: string; phone: string; is_verified?: boolean }, role: 'job_seeker' | 'employer') {
    const [seeker, employer] = await Promise.all([
        client.from('job_seeker_profiles').select('id, full_name').eq('user_id', user.id).maybeSingle(),
        client.from('employer_profiles').select('id, company_name').eq('user_id', user.id).maybeSingle(),
    ]);
    if (seeker.error || employer.error) throw new Error('Could not load user profiles');
    return {
        id: user.id, phone: user.phone, role, active_role: role,
        has_job_seeker_profile: !!seeker.data, has_employer_profile: !!employer.data,
        full_name: seeker.data?.full_name || null, company_name: employer.data?.company_name || null,
        is_verified: !!user.is_verified,
    };
}

export async function ensureProfile(client: SupabaseClient, user: { id: string; phone: string }, role: 'job_seeker' | 'employer') {
    const table = role === 'employer' ? 'employer_profiles' : 'job_seeker_profiles';
    const { data, error } = await client.from(table).select('id').eq('user_id', user.id).maybeSingle();
    if (error) throw new Error('Could not load profile');
    if (!data) {
        const { error: insertError } = await client.from(table).insert({ user_id: user.id, phone: user.phone });
        if (insertError && insertError.code !== '23505') throw new Error('Could not create profile');
    }
}

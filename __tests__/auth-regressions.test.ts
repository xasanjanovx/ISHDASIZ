/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { signAuthToken, verifyAuthToken, normalizePhone, passwordVersion, OTP_COOKIE } from '@/lib/auth/server';
import { POST as verifyOtp } from '@/app/api/auth/verify-otp/route';
import { POST as createPassword } from '@/app/api/auth/create-password/route';
import { POST as webhook } from '@/app/api/telegram/webhook/route';
import { GET as inspectWebhook, POST as setupWebhook } from '@/app/api/telegram/set-webhook/route';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/otp-store', () => ({ otpStore: { get: jest.fn(() => null), delete: jest.fn(), incrementAttempts: jest.fn() } }));
jest.mock('@/lib/telegram/telegram-api', () => ({ setWebhookWithOptions: jest.fn(), getWebhookInfo: jest.fn(), getMe: jest.fn() }));

const request = (path: string, body: unknown, cookie?: string) => new NextRequest(`http://localhost${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
});
const phone = '+998901234567';
let queues: any[];
let client: any;
function db(results: any[]) {
    queues = [...results];
    client = { from: jest.fn(() => {
        const result = queues.shift() ?? { data: null, error: null };
        const chain: any = {};
        for (const method of ['select', 'eq', 'order', 'limit', 'update', 'insert']) chain[method] = jest.fn(() => chain);
        chain.maybeSingle = jest.fn(async () => result);
        chain.single = jest.fn(async () => result);
        chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
        return chain;
    }) };
    (createClient as jest.Mock).mockReturnValue(client);
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_SESSION_SECRET = 'local-test-signing-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-service-key';
    db([]);
});

describe('Signed identity and password proof', () => {
    it('normalizes only valid Uzbekistan numbers', () => {
        expect(normalizePhone('+998 (90) 123-45-67')).toBe(phone);
        expect(normalizePhone('901234567')).toBe(phone);
        expect(normalizePhone('+79012345678')).toBeNull();
        expect(normalizePhone({ phone })).toBeNull();
    });
    it('rejects altered, expired and wrong-purpose tokens', () => {
        const claims = { purpose: 'password' as const, userId: 'user-1', phone, expiresAt: Date.now() + 60000, passwordVersion: passwordVersion(null) };
        const value = signAuthToken(claims);
        expect(verifyAuthToken(value, 'password')?.userId).toBe('user-1');
        expect(verifyAuthToken(value, 'session')).toBeNull();
        expect(verifyAuthToken(value + 'x', 'password')).toBeNull();
        expect(verifyAuthToken(signAuthToken({ ...claims, expiresAt: Date.now() - 1 }), 'password')).toBeNull();
    });
    it('does not change a password without proof of SMS verification', async () => {
        const response = await createPassword(request('/api/auth/create-password', { phone, password: 'test-password', role: 'job_seeker' }));
        expect(response.status).toBe(401);
        expect(client.from).not.toHaveBeenCalled();
    });
    it('cannot reuse a proof after the password has changed', async () => {
        const token = signAuthToken({ purpose: 'password', userId: 'user-1', phone, expiresAt: Date.now() + 60000, passwordVersion: passwordVersion('old-hash') });
        db([{ data: { id: 'user-1', phone, password_hash: 'new-hash' }, error: null }]);
        const response = await createPassword(request('/api/auth/create-password', { phone, password: 'test-password', role: 'job_seeker' }, `${OTP_COOKIE}=${token}`));
        expect(response.status).toBe(401);
        expect(client.from).toHaveBeenCalledTimes(1);
    });
});

describe('Actual OTP route', () => {
    it('a closed account gets only current SMS proof and requires a separate restoration confirmation',async()=>{
        db([{data:{id:'otp-1',code:'54321',attempts:0,expires_at:new Date(Date.now()+60000).toISOString()}},
          {data:{id:'otp-1'}},{data:{id:'user-1',phone,password_hash:'test-hash',closed_at:'2026-10-07',session_version:1}}]);
        const response=await verifyOtp(request('/api/auth/verify-otp',{phone,code:'54321',role:'job_seeker'}));
        expect(response.status).toBe(200);expect(await response.json()).toEqual({success:true,needsRestoration:true});
        expect(response.cookies.get('ishdasiz_session')?.value).toBe('');
        expect(verifyAuthToken(response.cookies.get(OTP_COOKIE)?.value,'password')?.passwordVersion).toBe(passwordVersion('test-hash',1));
        expect(client.from).toHaveBeenCalledTimes(3);
    });
    it('does not accept arbitrary development codes without a sent OTP', async () => {
        const response = await verifyOtp(request('/api/auth/verify-otp', { phone, code: '12345' }));
        expect(response.status).toBe(400);
        expect(client.from).toHaveBeenCalledTimes(1);
    });
    it('rejects an expired OTP', async () => {
        db([{ data: { id: 'otp-1', code: '54321', attempts: 0, expires_at: new Date(Date.now() - 1000).toISOString() }, error: null }]);
        expect((await verifyOtp(request('/api/auth/verify-otp', { phone, code: '54321' }))).status).toBe(400);
    });
    it('rejects an OTP with malformed expiry', async () => {
        db([{ data: { id: 'otp-1', code: '54321', attempts: 0, expires_at: 'invalid' }, error: null }]);
        expect((await verifyOtp(request('/api/auth/verify-otp', { phone, code: '54321' }))).status).toBe(400);
    });
    it('blocks after three failed attempts even if the code is correct', async () => {
        db([{ data: { id: 'otp-1', code: '54321', attempts: 3, expires_at: new Date(Date.now() + 60000).toISOString() }, error: null }]);
        expect((await verifyOtp(request('/api/auth/verify-otp', { phone, code: '54321' }))).status).toBe(429);
    });
    it('never authenticates if the OTP was consumed by another request', async () => {
        db([{ data: { id: 'otp-1', code: '54321', attempts: 0, expires_at: new Date(Date.now() + 60000).toISOString() } }, { data: null, error: null }]);
        expect((await verifyOtp(request('/api/auth/verify-otp', { phone, code: '54321' }))).status).toBe(400);
        expect(client.from).toHaveBeenCalledTimes(2);
    });
    it('returns profile flags and cookies without disclosing the password hash', async () => {
        db([
            { data: { id: 'otp-1', code: '54321', attempts: 0, expires_at: new Date(Date.now() + 60000).toISOString() } },
            { data: { id: 'otp-1' } },
            { data: { id: 'user-1', phone, password_hash: 'private-hash', is_verified: true } },
            { data: { id: 'profile-1' } },
            { data: { id: 'profile-1', full_name: 'Test' } },
            { data: { id: 'employer-1', company_name: 'Company' } },
        ]);
        const response = await verifyOtp(request('/api/auth/verify-otp', { phone, code: '54321', role: 'employer' }));
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.hasPassword).toBe(true);
        expect(data.user).toMatchObject({ active_role: 'employer', has_job_seeker_profile: true, has_employer_profile: true });
        expect(JSON.stringify(data)).not.toContain('private-hash');
        expect(response.cookies.get(OTP_COOKIE)?.value).toBeDefined();
        expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    });
});

describe('Telegram endpoint access', () => {
    it('sets one webhook connection and preserves pending updates', async () => {
        const { setWebhookWithOptions, getWebhookInfo } = jest.requireMock('@/lib/telegram/telegram-api');
        process.env.TELEGRAM_SETUP_SECRET = 'test-operator-secret';
        process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret';
        process.env.NEXT_PUBLIC_APP_URL = 'https://ishdasiz.uz';
        setWebhookWithOptions.mockResolvedValue(true);
        getWebhookInfo.mockResolvedValue({ url: 'https://ishdasiz.uz/api/telegram/webhook', max_connections: 1 });
        const response = await setupWebhook(new NextRequest('http://localhost/api/telegram/set-webhook', {
            method: 'POST', headers: { Authorization: 'Bearer test-operator-secret' },
        }));
        expect(response.status).toBe(200);
        expect(setWebhookWithOptions).toHaveBeenCalledWith({
            url: 'https://ishdasiz.uz/api/telegram/webhook', secret_token: 'test-webhook-secret',
            max_connections: 1, allowed_updates: ['message', 'callback_query'],
        });
        expect(setWebhookWithOptions.mock.calls.at(-1)[0]).not.toHaveProperty('drop_pending_updates');
    });
    it('rejects requests without the configured webhook secret', async () => {
        process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret';
        expect((await webhook(request('/api/telegram/webhook', { update_id: 1 }))).status).toBe(401);
    });
    it('rejects webhook setup without the operator secret', async () => {
        process.env.TELEGRAM_SETUP_SECRET = 'test-operator-secret';
        expect((await inspectWebhook(new NextRequest('http://localhost/api/telegram/set-webhook'))).status).toBe(401);
        expect((await setupWebhook(request('/api/telegram/set-webhook', {}))).status).toBe(401);
    });
});

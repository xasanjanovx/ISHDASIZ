/** @jest-environment node */
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { POST } from '@/app/api/telegram/webapp-auth/route';
import { verifyAuthToken, signAuthToken, passwordVersion, SESSION_COOKIE } from '@/lib/auth/server';
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
const bot = 'synthetic-bot-token', id = '10000000-0000-4000-8000-000000000001', phone = '+998901234567';
let results: any[], queries: any[], client: any;
function signed(extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 12345, first_name: 'Synthetic' }), ...extra });
  const text = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '=' + value).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(bot).digest(); params.set('hash', createHmac('sha256', secret).update(text).digest('hex')); return params.toString();
}
const request = (initData: any, origin?: string, cookie?: string) => new NextRequest('http://localhost/api/telegram/webapp-auth', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ initData }) });
beforeEach(() => {
  jest.clearAllMocks(); process.env.TELEGRAM_BOT_TOKEN = bot; process.env.AUTH_SESSION_SECRET = 'synthetic-signing-key'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key'; queries = [];
  results = [{ data: { id, phone, password_hash: 'private-hash', session_version: 2, closed_at: null, role: 'employer', is_verified: true } }, { data: { id: 'seeker-profile', full_name: 'Synthetic' } }, { data: { id: 'employer-profile', company_name: 'Demo' } }];
  client = { from: jest.fn((table: string) => { const result = results.shift() || { data: null }; const q: any = { table }; for (const method of ['select', 'eq']) q[method] = jest.fn(() => q); q.maybeSingle = jest.fn(async () => result); queries.push(q); return q; }) }; (createClient as jest.Mock).mockReturnValue(client);
});
test('valid signed Telegram data returns only public profile data and a current-epoch HttpOnly session cookie', async () => {
  const response = await POST(request(signed())); expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store'); const data = await response.json(); expect(data.user).toMatchObject({ id, active_role: 'employer', has_job_seeker_profile: true, has_employer_profile: true }); expect(JSON.stringify(data)).not.toContain('private-hash');
  expect(verifyAuthToken(response.cookies.get(SESSION_COOKIE)?.value, 'session')?.passwordVersion).toBe(passwordVersion('private-hash', 2)); expect(response.headers.get('set-cookie')).toContain('HttpOnly'); expect(queries[0].select.mock.calls[0][0]).not.toContain('*');
});
test.each([() => signed({ auth_date: String(Math.floor(Date.now() / 1000) - 301) }), () => signed({ auth_date: String(Math.floor(Date.now() / 1000) + 31) }), () => signed() + '&hash=' + '0'.repeat(64), () => signed().replace('Synthetic', 'Forged')])('stale, future, duplicated or altered init data never reaches the database', async make => {
  expect((await POST(request(make()))).status).toBe(401); expect(client.from).not.toHaveBeenCalled();
});
test('foreign origin, malformed body and invalid Telegram user are rejected before database access', async () => {
  expect((await POST(request(signed(), 'https://foreign.example'))).status).toBe(403); expect((await POST(request(signed({ user: JSON.stringify({ id: -1 }) })))).status).toBe(400); expect((await POST(new NextRequest('http://localhost/api/telegram/webapp-auth', { method: 'POST', body: '{broken' }))).status).toBe(400); expect(client.from).not.toHaveBeenCalled();
});
test('a database failure is unavailable rather than an unlinked account and never issues a cookie', async () => {
  results[0] = { data: null, error: { code: '08006' } }; const response = await POST(request(signed())); expect(response.status).toBe(503); expect((await response.json()).requires_link).toBeUndefined(); expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
});
test('unlinked and closed accounts require explicit phone sign-in or restoration', async () => {
  results[0] = { data: null }; let response = await POST(request(signed())); expect(response.status).toBe(404); expect((await response.json()).requires_link).toBe(true);
  results.unshift({ data: { id, phone, closed_at: '2026-10-09' } }); response = await POST(request(signed())); expect(response.status).toBe(403); expect((await response.json()).needsRestoration).toBe(true); expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
});
test('profile lookup failures never produce a partial authenticated account', async () => {
  results[1] = { data: null, error: { code: '08006' } }; const response = await POST(request(signed())); expect(response.status).toBe(503); expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
});
test('a different existing signed identity cannot be replaced by automatic Telegram authentication', async () => {
  const token = signAuthToken({ purpose: 'session', userId: 'another-account', phone, expiresAt: Date.now() + 60000, passwordVersion: passwordVersion('other-hash') }); const response = await POST(request(signed(), undefined, SESSION_COOKIE + '=' + token)); expect(response.status).toBe(409); expect((await response.json()).account_conflict).toBe(true); expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
});

/** @jest-environment node */
import { NextRequest } from 'next/server';
import { requireAccount } from '@/lib/auth/account';
import { finishVerification, startVerification } from '@/lib/identity-verification';
import { getOneIdAccessToken, getOneIdUserData, isOneIdConfigured } from '@/lib/oneid';
import { isEriConfigured, verifyEriSignature } from '@/lib/eri';

jest.mock('@/lib/auth/account', () => ({ ...jest.requireActual('@/lib/auth/account'), requireAccount: jest.fn() }));
jest.mock('@/lib/oneid', () => ({
  isOneIdConfigured: jest.fn(), getOneIdAuthUrl: (state: string) => `https://provider.test?state=${state}`,
  getOneIdAccessToken: jest.fn(), getOneIdUserData: jest.fn(),
}));
jest.mock('@/lib/eri', () => ({
  isEriConfigured: jest.fn(), getEriAuthUrl: (state: string) => `https://provider.test?state=${state}`, verifyEriSignature: jest.fn(),
}));
let currentUser: string;
let profile: any;
let saveError: boolean;
let writes: { userId: string; payload: any }[];
const details = { inn: 'synthetic-inn', company_name: 'Test company', director_name: 'Test director' };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AUTH_SESSION_SECRET = 'synthetic-verification-signing-secret';
  currentUser = 'account-a'; profile = { id: 'profile-a' }; saveError = false; writes = [];
  (isOneIdConfigured as jest.Mock).mockReturnValue(true);
  (isEriConfigured as jest.Mock).mockReturnValue(true);
  (getOneIdAccessToken as jest.Mock).mockResolvedValue('synthetic-provider-token');
  (getOneIdUserData as jest.Mock).mockResolvedValue(details);
  (verifyEriSignature as jest.Mock).mockResolvedValue(details);
  (requireAccount as jest.Mock).mockImplementation(async () => ({
    user: { id: currentUser }, client: {
      from: () => {
        let payload: any, owner: string;
        const q: any = {
          select: () => q, eq: (_: string, id: string) => { owner = id; return q; },
          update: (data: any) => { payload = data; return q; },
          maybeSingle: async () => {
            if (payload) writes.push({ userId: owner, payload });
            return { data: profile, error: payload && saveError ? { message: 'synthetic error' } : null };
          },
        }; return q;
      },
    },
  }));
});

async function begin(provider: 'oneid' | 'eri') {
  const response = await startVerification(new NextRequest('https://site.test/start'), provider);
  expect(response.status).toBe(307);
  return { cookie: response.cookies.get(`${provider}_state`)!.value,
    state: new URL(response.headers.get('location')!).searchParams.get('state')! };
}
function callback(provider: 'oneid' | 'eri', state: string, cookie: string, pending = 'account-b') {
  const credential = provider === 'oneid' ? 'code=synthetic-code' : 'signed_data=synthetic-signature';
  return new NextRequest(`https://site.test/callback?state=${state}&${credential}`, {
    headers: { cookie: `${provider}_state=${cookie}; pending_verification_user=${pending}` },
  });
}

test.each(['oneid', 'eri'] as const)('%s callback ignores forged pending user and updates the authenticated owner', async provider => {
  const { cookie, state } = await begin(provider);
  const response = await finishVerification(callback(provider, state, cookie), provider);
  expect(response.headers.get('location')).toContain('success=true');
  expect(writes).toHaveLength(1);
  expect(writes[0].userId).toBe('account-a');
});

test.each(['oneid', 'eri'] as const)('%s state cannot be used after switching accounts', async provider => {
  const { cookie, state } = await begin(provider);
  currentUser = 'account-b';
  const response = await finishVerification(callback(provider, state, cookie), provider);
  expect(response.headers.get('location')).toContain('error=invalid_state');
  expect(writes).toHaveLength(0);
  expect(getOneIdAccessToken).not.toHaveBeenCalled();
  expect(verifyEriSignature).not.toHaveBeenCalled();
});

test('tampered or expired state cannot call the identity provider', async () => {
  const { cookie, state } = await begin('oneid');
  for (const invalid of [cookie + 'x', `${state}.1.${cookie.split('.')[2]}`, state]) {
    expect((await finishVerification(callback('oneid', state, invalid), 'oneid')).headers.get('location')).toContain('error=invalid_state');
  }
  expect(getOneIdAccessToken).not.toHaveBeenCalled();
  expect(writes).toHaveLength(0);
});

test('database failure cannot return a successful verification', async () => {
  const { cookie, state } = await begin('oneid'); saveError = true;
  expect((await finishVerification(callback('oneid', state, cookie), 'oneid')).headers.get('location')).toContain('error=save_failed');
});

test('empty company data from a provider cannot verify the profile', async () => {
  const { cookie, state } = await begin('eri');
  (verifyEriSignature as jest.Mock).mockResolvedValue({ ...details, inn: '' });
  expect((await finishVerification(callback('eri', state, cookie), 'eri')).headers.get('location')).toContain('error=verify_failed');
  expect(writes).toHaveLength(0);
});

test('unconfigured provider and missing employer profile are explicit failures', async () => {
  (isOneIdConfigured as jest.Mock).mockReturnValue(false);
  expect((await startVerification(new NextRequest('https://site.test/start'), 'oneid')).status).toBe(503);
  profile = null;
  expect((await startVerification(new NextRequest('https://site.test/start'), 'eri')).status).toBe(403);
});

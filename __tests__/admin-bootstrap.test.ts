/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { POST } from '@/app/api/admin/ensure-profile/route';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
let identity: any;
let profiles: any[];
let writes: any[];
let concurrent: boolean;
const id = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-key';
  process.env.ADMIN_BOOTSTRAP_EMAILS = '';
  process.env.ADMIN_EMAILS = '';
  identity = { id, email: 'owner@example.test', email_confirmed_at: '2026-01-01' };
  profiles = []; writes = []; concurrent = false;
  (createClient as jest.Mock).mockImplementation(() => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: identity }, error: null })) },
    from: () => {
      let payload: any;
      let options: any;
      const q: any = {
        select: () => q, eq: () => q,
        upsert: (value: any, opts: any) => { payload = value; options = opts; return q; },
        maybeSingle: async () => {
          if (payload) {
            writes.push({ payload, options });
            if (concurrent) {
              profiles.push({ id, role: 'hokimlik_assistant' });
              return { data: null, error: null };
            }
            profiles.push(payload);
          }
          return { data: profiles.find(p => p.id === id) || null, error: null };
        },
      };
      return q;
    },
  }));
});

function request(token = 'test-token') {
  return new NextRequest('https://ishdasiz.test/api/admin/ensure-profile', {
    method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

test('empty admin table cannot grant privileges to an ordinary account', async () => {
  expect((await POST(request())).status).toBe(403);
  expect(writes).toHaveLength(0);
});

test('only an explicitly allowlisted confirmed email can bootstrap', async () => {
  process.env.ADMIN_BOOTSTRAP_EMAILS = ' OWNER@EXAMPLE.TEST ';
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).profile.role).toBe('super_admin');
  expect(writes[0].options.ignoreDuplicates).toBe(true);
});

test('unconfirmed allowlisted email cannot bootstrap', async () => {
  process.env.ADMIN_EMAILS = 'owner@example.test';
  delete identity.email_confirmed_at;
  expect((await POST(request())).status).toBe(403);
  expect(writes).toHaveLength(0);
});

test('an existing assistant profile is not promoted by bootstrap', async () => {
  process.env.ADMIN_EMAILS = 'owner@example.test';
  profiles.push({ id, role: 'hokimlik_assistant' });
  expect((await (await POST(request())).json()).profile.role).toBe('hokimlik_assistant');
  expect(writes).toHaveLength(0);
});
test('an allowlisted email cannot restore a disabled or unknown admin profile through login',async()=>{
 process.env.ADMIN_EMAILS='owner@example.test';profiles.push({id,role:'super_admin',disabled_at:'2026-10-07T00:00:00Z'});
 expect((await POST(request())).status).toBe(403);expect(writes).toHaveLength(0);profiles[0]={id,role:'unknown'};expect((await POST(request())).status).toBe(403);expect(writes).toHaveLength(0);
});
test('a foreign origin cannot bootstrap even an allowlisted confirmed email',async()=>{
 process.env.ADMIN_EMAILS='owner@example.test';const foreign=new NextRequest('https://ishdasiz.test/api/admin/ensure-profile',{method:'POST',headers:{authorization:'Bearer test-token',origin:'https://foreign.test'}});
 expect((await POST(foreign)).status).toBe(403);expect(writes).toHaveLength(0);
});

test('concurrent profile creation retains the assigned role', async () => {
  process.env.ADMIN_EMAILS = 'owner@example.test';
  concurrent = true;
  expect((await (await POST(request())).json()).profile.role).toBe('hokimlik_assistant');
});

test('invalid or missing bearer identity cannot create a profile', async () => {
  expect((await POST(request(''))).status).toBe(401);
  identity = null;
  expect((await POST(request())).status).toBe(401);
  expect(writes).toHaveLength(0);
});

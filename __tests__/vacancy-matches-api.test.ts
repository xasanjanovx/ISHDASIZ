/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GET } from '@/app/api/account/vacancies/[id]/matches/route';
import { requireAccount } from '@/lib/auth/account';
jest.mock('@/lib/auth/account', () => ({ ...jest.requireActual('@/lib/auth/account'), requireAccount: jest.fn() }));
const owner = '10000000-0000-4000-8000-000000000001', employer = '20000000-0000-4000-8000-000000000001', jobId = '30000000-0000-4000-8000-000000000001';
let requests: URL[], available = true;
beforeEach(() => {
  requests = []; available = true;
  const client = createClient('https://synthetic.invalid', 'synthetic', { global: { fetch: async (input: any) => {
    const url = new URL(String(input)); requests.push(url);
    const data = url.pathname.endsWith('/employer_profiles') ? { id: employer, company_name: 'Test' } : url.pathname.endsWith('/jobs') ? available ? { id: jobId, employer_id: employer, region_id: 12, title_uz: 'Sotuvchi' } : null : [];
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  } } });
  (requireAccount as jest.Mock).mockResolvedValue({ client, user: { id: owner } });
});
test('the owned-vacancy scope is checked before searching opted-in public resumes', async () => {
  const response = await GET(new NextRequest('https://synthetic.invalid/api/account/vacancies/' + jobId + '/matches'), { params: Promise.resolve({ id: jobId }) });
  expect(response.status).toBe(200);
  const job = requests.find(url => url.pathname.endsWith('/jobs'))!;
  expect(job.searchParams.get('or')).toContain(employer);
  expect(job.searchParams.get('or')).toContain(owner);
  const resumes = requests.find(url => url.pathname.endsWith('/resumes'))!;
  expect(resumes.searchParams.get('ishdasiz_resume_available')).toBe('eq.true');
  expect(resumes.searchParams.get('is_public')).toBe('eq.true');
  expect(resumes.searchParams.get('select')).not.toMatch(/phone|birth_date|gender|user_id/);
});
test('an inaccessible vacancy cannot be used to query candidates', async () => {
  available = false;
  const response = await GET(new NextRequest('https://synthetic.invalid/test'), { params: Promise.resolve({ id: jobId }) });
  expect(response.status).toBe(404);
  expect(requests.some(url => url.pathname.endsWith('/resumes'))).toBe(false);
});

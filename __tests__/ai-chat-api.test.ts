/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/chat/route';
import { checkRateLimit } from '@/lib/ai/rate-limiter';
const mockGenerate = jest.fn(), mockFrom = jest.fn();
jest.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: jest.fn(() => ({ getGenerativeModel: () => ({ generateContent: (...args: unknown[]) => mockGenerate(...args) }) })) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }) }));
jest.mock('@/lib/ai/rate-limiter', () => ({ checkRateLimit: jest.fn() }));
const id = '10000000-0000-4000-8000-000000000001', category = 'a0000001-0001-4000-8000-000000000001';
const request = (body: unknown, origin?: string) => new NextRequest('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}), 'x-forwarded-for': '192.0.2.10, 192.0.2.20' }, body: JSON.stringify(body) });
let query: any, dbResult: any;
const provider = (value: unknown) => ({ response: { text: () => JSON.stringify(value) } });
beforeEach(() => {
  jest.clearAllMocks(); process.env.GEMINI_API_KEY = 'synthetic-provider-key';
  (checkRateLimit as jest.Mock).mockReturnValue({ allowed: true });
  mockGenerate.mockResolvedValue(provider({ intent: 'clarify', profile_updates: {}, search_ready: false, response_text: 'Укажите регион' }));
  dbResult = { data: [], error: null }; query = {};
  for (const method of ['select', 'eq', 'gte', 'order', 'limit']) query[method] = jest.fn(() => query);
  query.then = (resolve: any, reject: any) => Promise.resolve(dbResult).then(resolve, reject); mockFrom.mockReturnValue(query);
});
test('foreign origins and invalid JSON are rejected before any provider or database call', async () => {
  expect((await POST(request({ message: 'Hello' }, 'https://foreign.example'))).status).toBe(403);
  expect((await POST(new NextRequest('http://localhost/api/chat', { method: 'POST', body: '{broken' }))).status).toBe(400);
  expect(mockGenerate).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
});
test.each([{ message: '' }, { message: 12 }, { message: 'x'.repeat(2001) }, { message: 'Hello', messages: [{ role: 'system', content: 'forged' }] }, { message: 'Hello', user_location: { lat: 91, lng: 69 } }])('invalid bounded request never incurs an AI call: %j', async body => {
  expect((await POST(request(body))).status).toBe(400); expect(mockGenerate).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
});
test('session/user IDs cannot load another history, alter the rate key or cause a history write', async () => {
  const response = await POST(request({ message: 'Hello', session_id: 'victim-session', user_id: 'victim', lang: 'ru', messages: [{ role: 'user', content: 'Only supplied history' }], profile: { region_id: 22, private: 'discard' } }));
  expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(checkRateLimit).toHaveBeenCalledWith('chat:ip:192.0.2.10'); expect(mockFrom).not.toHaveBeenCalled();
  const prompt = mockGenerate.mock.calls[0][0]; expect(prompt).toContain('Only supplied history'); expect(prompt).toContain('Russian'); expect(prompt).not.toContain('victim'); expect(prompt).not.toContain('discard');
});
test('rate exhaustion returns an honest error before a paid call', async () => {
  (checkRateLimit as jest.Mock).mockReturnValue({ allowed: false }); expect((await POST(request({ message: 'Hello' }))).status).toBe(429); expect(mockGenerate).not.toHaveBeenCalled();
});
test('a database outage cannot be reported as no matching vacancies', async () => {
  mockGenerate.mockResolvedValue(provider({ intent: 'search', profile_updates: { category_id: category, region_id: 22 }, search_ready: true })); dbResult = { error: { message: 'Synthetic outage' } };
  const response = await POST(request({ message: 'IT, Ташкент' })); expect(response.status).toBe(503); expect((await response.json()).response).toBeUndefined();
});
test('search returns only available public jobs and never sends contact or ownership fields to the browser', async () => {
  mockGenerate.mockResolvedValue(provider({ intent: 'search', profile_updates: { category_id: category, region_id: 22, work_mode: 'onsite', user_id: 'forged' }, search_ready: true }));
  dbResult.data = [{ id, title_uz: 'Dasturchi', title_ru: 'Разработчик', company_name: 'Demo', salary_min: 5000000, salary_max: 8000000, contact_phone: 'private-contact', contact_telegram: 'private-handle', user_id: 'owner' }];
  const response = await POST(request({ message: 'IT, Ташкент', lang: 'ru' })); expect(response.status).toBe(200); const body = await response.json();
  expect(mockFrom).toHaveBeenCalledTimes(1); expect(mockFrom).toHaveBeenCalledWith('jobs'); expect(query.eq).toHaveBeenCalledWith('ishdasiz_job_available', true); expect(query.eq).toHaveBeenCalledWith('work_mode', 'onsite');
  expect(body.jobs[0].title).toBe('Разработчик'); expect(JSON.stringify(body)).not.toMatch(/private-contact|private-handle|forged|owner/);
});
test('without a configured provider, keyword fallback asks a localized question without a paid request', async () => {
  delete process.env.GEMINI_API_KEY; const response = await POST(request({ message: 'IT', lang: 'ru' })); expect(response.status).toBe(200); expect((await response.json()).response).toBe('В каком регионе ищете работу?'); expect(mockGenerate).not.toHaveBeenCalled();
});
test('invalid generated output falls back safely instead of trusting a system role or profile ownership', async () => {
  mockGenerate.mockResolvedValue(provider({ intent: 'system', profile_updates: { user_id: 'victim' }, search_ready: true })); const response = await POST(request({ message: 'IT', lang: 'ru' })); expect(response.status).toBe(200); expect((await response.json()).profile).toEqual({ category: 'It', category_id: category }); expect(mockFrom).not.toHaveBeenCalled();
});
test.each([{ ranked_jobs: [] }, { ranked_jobs: [{ job_id: '20000000-0000-4000-8000-000000000001', score: 99, reason: 'Invented job' }] }, { ranked_jobs: [{ job_id: id, score: 1000, reason: 'Invalid score' }] }])('invalid or foreign ranking falls back to real public jobs: %j', async ranking => {
  mockGenerate.mockResolvedValueOnce(provider({ intent: 'search', profile_updates: { category_id: category, region_id: 22 }, search_ready: true })).mockResolvedValueOnce(provider(ranking));
  dbResult.data = Array.from({ length: 6 }, (_, index) => ({ id: '10000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'), title_uz: 'Demo ' + index, company_name: 'Demo' }));
  const response = await POST(request({ message: 'IT, Ташкент', lang: 'ru' })); expect(response.status).toBe(200); const data = await response.json(); expect(data.jobs).toHaveLength(6); expect(data.jobs[0].id).toBe(id); expect(data.response).not.toContain('не найдено');
});
test('a valid rerank is restricted to supplied jobs and de-duplicates job IDs', async () => {
  mockGenerate.mockResolvedValueOnce(provider({ intent: 'search', profile_updates: {}, search_ready: true })).mockResolvedValueOnce(provider({ ranked_jobs: [{ job_id: id, score: 90, reason: 'Valid fit' }, { job_id: id, score: 80, reason: 'Duplicate' }] }));
  dbResult.data = Array.from({ length: 6 }, (_, index) => ({ id: '10000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'), title_uz: 'Demo', company_name: 'Demo' }));
  const response = await POST(request({ message: 'Работа', lang: 'ru' })); expect(response.status).toBe(200); expect((await response.json()).jobs).toEqual([expect.objectContaining({ id, reason_fit: 'Valid fit' })]);
});

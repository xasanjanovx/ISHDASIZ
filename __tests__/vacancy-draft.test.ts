/** @jest-environment node */
import { extractVacancyDraft, VacancyDraftError, vacancyDraftSchema } from '@/lib/ai/vacancy-draft';
import { formatVacancyTemplate, vacancyDraftToJob } from '@/lib/telegram/vacancy-template';
import { buildJobChannelMessage, getJobChannel } from '@/lib/telegram/channel-sync';

const source = 'Требуется разработчик Python в ACME. Ташкент, $1000–1500. График 5/2. Контакты +998901112233, +998935556677, @acme_jobs.';
const data = () => vacancyDraftSchema.parse({ title: 'Разработчик Python', company: 'ACME', region: 'Ташкент', salary: '$1000–1500', currency: 'USD', salary_min: 1000, salary_max: 1500, schedule: '5/2', requirements: ['Python'], duties: ['Разработка'], phones: ['+998901112233', '+998935556677'], telegram: '@acme_jobs' });
const originalFetch = global.fetch;
beforeEach(() => { process.env.GOOGLE_CLOUD_API_KEY = 'synthetic-private-key'; delete process.env.gemini_cloud_api; delete process.env.VERTEX_MODEL; delete process.env.VERTEX_VACANCY_MODEL; });
afterEach(() => { global.fetch = originalFetch; });

test('uses Vertex AI with header authentication and JSON output', async () => {
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(data()) }] } }] })));
  expect((await extractVacancyDraft(source)).phones).toHaveLength(2);
  const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toContain('aiplatform.googleapis.com/v1/publishers/google/models/');
  expect(url).not.toContain('synthetic-private-key');
  expect(options.headers['x-goog-api-key']).toBe('synthetic-private-key');
  expect(JSON.parse(options.body).generationConfig.responseMimeType).toBe('application/json');
  expect(options.signal).toBeInstanceOf(AbortSignal);
});

test.each([401, 402, 403, 429, 500])('provider failure %s is sanitized and never returns a fabricated draft', async status => {
  global.fetch = jest.fn().mockResolvedValue(new Response('private provider details', { status }));
  await expect(extractVacancyDraft(source)).rejects.toBeInstanceOf(VacancyDraftError);
  await expect(extractVacancyDraft(source)).rejects.not.toThrow('private provider details');
});

test.each(['{}', '{"title":"Operator","salary_min":-1}', '{"title":"Operator","salary_min":900,"salary_max":100}', 'not JSON'])('rejects incomplete or invalid model data: %s', async output => {
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: output }] } }] })));
  await expect(extractVacancyDraft(source)).rejects.toMatchObject({ kind: 'invalid' });
});

test('removes hallucinated contacts and accepts actual t.me employer links', async () => {
  const draft = { ...data(), phones: ['+998909999999', '+998901112233'], telegram: '@invented_contact' };
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }] })));
  expect(await extractVacancyDraft(source)).toMatchObject({ phones: ['+998901112233'], telegram: null });
});

test('foreign salary stays in the post and description without becoming UZS numeric salary', () => {
  const job = vacancyDraftToJob(data(), { publication_id: 'draft', contact_phone: '+998900000000' });
  expect(job.salary_min).toBeNull(); expect(job.salary_max).toBeNull();
  expect(job.description).toContain('$1000–1500');
  expect(job.raw_source_json.vacancy_template.phones).toHaveLength(2);
  expect(vacancyDraftToJob({ ...data(), currency: 'UZS' }, {}).salary_min).toBe(1000);
});

test('escapes HTML, retains both contacts and bounds very long channel posts', () => {
  const draft = { ...data(), title: 'Python <script>&', requirements: Array.from({ length: 30 }, (_, i) => `${i} ${'<&>'.repeat(160)}`) };
  const text = formatVacancyTemplate(draft, 'ru', '10000000-0000-4000-8000-000000000001');
  expect(text.length).toBeLessThan(4096);
  expect(text).not.toContain('<script>'); expect(text).toContain('&lt;script&gt;');
  expect(text).toContain('+998901112233 | +998935556677');
  expect(text).toContain('https://ishdasiz.uz/jobs/');
  expect(text).toContain('https://t.me/ishdasiz');
});

test('only employer-created jobs target the main channel and use the FLOW template', () => {
  expect(getJobChannel({ source: 'local' }, 'andijon-viloyati')).toBe('@ishdasiz');
  expect(getJobChannel({ source: 'local' }, null)).toBe('@ishdasiz');
  expect(getJobChannel({ source: 'osonish' }, 'andijon-viloyati')).toBe('@ishdasiz_andijon');
  const job = { ...vacancyDraftToJob(data(), {}), source: 'local', id: '10000000-0000-4000-8000-000000000001' };
  expect(buildJobChannelMessage(job, 'andijon-viloyati')).toContain('+998935556677');
  expect(buildJobChannelMessage(job, 'andijon-viloyati')).toContain('$1000–1500');
});

test('later employer edits replace outdated AI contacts and description in the channel card', () => {
  const job = { ...vacancyDraftToJob(data(), {}), source: 'local', description: 'Новые условия: удалённая работа', contact_phone: '+998977777777', contact_telegram: null };
  const post = buildJobChannelMessage(job, 'andijon-viloyati');
  expect(post).toContain('удалённая работа'); expect(post).toContain('+998977777777');
  expect(post).not.toContain('+998901112233'); expect(post).not.toContain('@acme_jobs');
});

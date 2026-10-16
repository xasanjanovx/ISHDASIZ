/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { createMainMenuStatsLoader, loadMainMenuStats, formatMainMenuStatsText } from '@/lib/telegram/main-menu-stats';

let calls: { url: URL; method: string }[];
let failArchive = false;
const client = () => createClient('https://synthetic.invalid', 'synthetic', {
  global: { fetch: async (url: any, init: any) => {
    const parsed = new URL(String(url)); calls.push({ url: parsed, method: init.method });
    if (parsed.pathname.endsWith('/ishdasiz_public_home_counts')) return new Response(JSON.stringify({
      total: 9502, categories: {}, special: { students: 429, disabled: 99, women: 7559 },
    }), { headers: { 'content-type': 'application/json' } });
    const source = parsed.searchParams.has('source_status');
    const count = parsed.pathname.endsWith('/users') ? 614 : parsed.pathname.endsWith('/resumes') ? 22 : source ? 23104 : 16145;
    return new Response(null, { status: failArchive && source ? 400 : 200, headers: { 'content-range': `0-0/${count}` } });
  } },
});
beforeEach(() => { calls = []; failArchive = false; });

test('bot uses the same exact counts as the website and counts only public active resumes', async () => {
  const stats = await loadMainMenuStats(client());
  expect(stats).toEqual({ jobs: 9502, jobsDisabled: 39249, users: 614, resumes: 22,
    jobsStudentsGraduates: 429, jobsDisabledFriendly: 99, jobsWomenFriendly: 7559 });
  expect(stats.jobs! + stats.jobsDisabled!).toBe(48751);
  expect(calls).toHaveLength(5);
  const resume = calls.find(c => c.url.pathname.endsWith('/resumes'))!;
  expect(resume.method).toBe('HEAD');
  expect(resume.url.searchParams.get('is_public')).toBe('eq.true');
  expect(resume.url.searchParams.get('status')).toBe('eq.active');
  expect(resume.url.searchParams.get('ishdasiz_resume_available')).toBe('eq.true');
  expect(formatMainMenuStatsText('ru', stats)).toContain('Всего вакансий: 48 751');
  expect(formatMainMenuStatsText('ru', stats)).toContain('Пользователи: 614');
  expect(formatMainMenuStatsText('uz', stats)).toContain('Jami vakansiyalar: 48 751');
});
test('simultaneous menus share one load and subsequent menus use the cache', async () => {
  const load = createMainMenuStatsLoader(client());
  const first = load(), second = load();
  expect(first).toBe(second);
  const stats = await first;
  expect(await load()).toBe(stats);
  expect(calls).toHaveLength(5);
  await load(true);
  expect(calls).toHaveLength(10);
});
test('an unavailable archive stays unknown while available job and user counts survive', async () => {
  failArchive = true;
  const stats = await loadMainMenuStats(client());
  expect(stats).toMatchObject({ jobs: 9502, jobsDisabled: null, users: 614 });
  expect(formatMainMenuStatsText('ru', stats)).toContain('Всего вакансий: —');
});

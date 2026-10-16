import type { SupabaseClient } from '@supabase/supabase-js';
import { parseHomeCounts } from '../home-data';
import { loadHomeTotals } from '../home-totals';

export type MainMenuStats = {
  jobs: number | null;
  jobsDisabled: number | null;
  resumes: number | null;
  users: number | null;
  jobsStudentsGraduates: number | null;
  jobsDisabledFriendly: number | null;
  jobsWomenFriendly: number | null;
};

// The website and bot share the same archive definition and public aggregate.
export async function loadMainMenuStats(client: SupabaseClient): Promise<MainMenuStats> {
  const [aggregate, totals, resumes] = await Promise.all([
    (async () => {
      try {
        const result = await client.rpc('ishdasiz_public_home_counts').abortSignal(AbortSignal.timeout(15000));
        return result.error ? null : parseHomeCounts(result.data);
      } catch { return null; }
    })(),
    loadHomeTotals(client),
    (async () => {
      try {
        const result = await client.from('resumes').select('id', { head: true, count: 'exact' })
          .eq('is_public', true).eq('status', 'active').eq('ishdasiz_resume_available', true).abortSignal(AbortSignal.timeout(15000));
        return !result.error && Number.isSafeInteger(result.count) && result.count! >= 0 ? result.count : null;
      } catch { return null; }
    })(),
  ]);
  return {
    jobs: aggregate?.total ?? null, jobsDisabled: totals.archivedJobs,
    users: totals.totalUsers, resumes,
    jobsStudentsGraduates: aggregate?.special.students ?? null,
    jobsDisabledFriendly: aggregate?.special.disabled ?? null,
    jobsWomenFriendly: aggregate?.special.women ?? null,
  };
}

export function createMainMenuStatsLoader(client: SupabaseClient) {
  let cached: MainMenuStats | null = null;
  let expiresAt = 0;
  let pending: Promise<MainMenuStats> | null = null;
  return (forceRefresh = false): Promise<MainMenuStats> => {
    if (!forceRefresh && cached && Date.now() < expiresAt) return Promise.resolve(cached);
    if (pending) return pending;
    pending = loadMainMenuStats(client).then(stats => {
      cached = stats;
      expiresAt = Date.now() + (Object.values(stats).some(v => v === null) ? 5000 : 60000);
      return stats;
    }).finally(() => { pending = null; });
    return pending;
  };
}

export function formatMainMenuStatsText(lang: 'ru' | 'uz', stats: MainMenuStats): string {
  const formatCountValue = (value: number | null) => value === null ? '—' : value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  const jobsTotal = (typeof stats.jobs === 'number' && typeof stats.jobsDisabled === 'number')
      ? stats.jobs + stats.jobsDisabled
      : null;
  const usersShown = stats.users;
  if (lang === 'ru') {
      return `<blockquote><b>📊 | Статистика ISHDASIZ</b>\n📢 Всего вакансий: ${formatCountValue(jobsTotal)}\n✅ Доступно сейчас: ${formatCountValue(stats.jobs)}\n\n• Для студентов и выпускников: ${formatCountValue(stats.jobsStudentsGraduates)}\n• Для людей с инвалидностью: ${formatCountValue(stats.jobsDisabledFriendly)}\n• Для женщин: ${formatCountValue(stats.jobsWomenFriendly)}\n\n🧾 Резюме: ${formatCountValue(stats.resumes)}\n\n👥 Пользователи: ${formatCountValue(usersShown)}</blockquote>`;
  }

  return `<blockquote><b>📊 | ISHDASIZ statistikasi</b>\n📢 Jami vakansiyalar: ${formatCountValue(jobsTotal)}\n✅ Hozir mavjud: ${formatCountValue(stats.jobs)}\n\n• Talaba va bitiruvchilar uchun: ${formatCountValue(stats.jobsStudentsGraduates)}\n• Nogironligi bo'lgan shaxslar uchun: ${formatCountValue(stats.jobsDisabledFriendly)}\n• Ayollar uchun: ${formatCountValue(stats.jobsWomenFriendly)}\n\n🧾 Rezyumelar: ${formatCountValue(stats.resumes)}\n\n👥 Foydalanuvchilar: ${formatCountValue(usersShown)}</blockquote>`;
}

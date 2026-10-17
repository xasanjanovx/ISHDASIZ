import { act, fireEvent, render, screen } from '@testing-library/react';
import { HomeOverviewProvider } from '@/components/home/home-overview-provider';
import { CategoriesSection } from '@/components/home/categories-section';
import { SpecialCategoriesSection } from '@/components/home/special-categories-section';
import { HowItWorksSection } from '@/components/home/how-it-works-section';
import { vacancyNoun, tashkentStamp } from '@/lib/home-format';
import type { HomeOverview } from '@/lib/home-overview-types';
import type { Category } from '@/types/database';
const push = jest.fn(), open = jest.fn(), role = jest.fn(), step = jest.fn();
let seeker = false;
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user: seeker ? { has_job_seeker_profile: true } : null }) }));
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ openModal: open, setUserRole: role, setStep: step }) }));
const category = 'a0000001-0001-4000-8000-000000000001';
const overview: HomeOverview = { categoryCounts: { [category]: 199 }, specialCounts: { students: 4173, disabled: 1220, women: 40932 }, asOf: '2026-10-17T06:00:00Z' };
const originalFetch = global.fetch;
beforeEach(() => { jest.clearAllMocks(); seeker = false; });
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
function Sections({ initial = overview }: { initial?: HomeOverview | null }) {
  return <HomeOverviewProvider initial={initial}><CategoriesSection categories={[{ id: category, name_ru: 'IT', name_uz: 'IT', icon: 'Monitor' } as Category]} jobCounts={{ [category]: null }} /><SpecialCategoriesSection counts={{ students: null, disabled: null, women: null }} /></HomeOverviewProvider>;
}
it('uses complete totals for the correct category and special filters', () => {
  render(<Sections />);
  expect(screen.getByRole('link', { name: /IT\s*199/ })).toHaveAttribute('href', `/jobs?category=${category}`);
  expect(screen.getByRole('link', { name: /Студентам и выпускникам/ })).toHaveAttribute('href', '/jobs?special=students');
  expect(screen.getByRole('link', { name: /Студентам и выпускникам/ })).toHaveTextContent('4 173');
  expect(screen.getByRole('link', { name: /Людям с инвалидностью/ })).toHaveTextContent('1 220');
});
it('recovers an unavailable overview after a temporary request failure', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ overview }) });
  render(<Sections initial={null} />);
  await act(async () => {});
  expect(screen.getByRole('link', { name: /IT/ })).toHaveTextContent('—');
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(screen.getByRole('link', { name: /IT\s*199/ })).toBeInTheDocument();
});
it('refreshes visible counts from a newer snapshot', async () => {
  jest.useFakeTimers();
  const newer = { ...overview, categoryCounts: { [category]: 200 }, asOf: '2026-10-17T06:01:00Z' };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ overview: newer }) });
  render(<Sections />);
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(screen.getByRole('link', { name: /IT\s*200/ })).toBeInTheDocument();
});
it('keeps the actual resume creation flow for signed-out visitors and existing seekers', () => {
  const view = render(<HowItWorksSection />);
  fireEvent.click(screen.getByRole('button', { name: 'Создать резюме' }));
  expect(role).toHaveBeenCalledWith('seeker'); expect(step).toHaveBeenCalledWith('auth'); expect(open).toHaveBeenCalled();
  seeker = true; view.rerender(<HowItWorksSection />);
  fireEvent.click(screen.getByRole('button', { name: 'Создать резюме' }));
  expect(push).toHaveBeenCalledWith('/profile/job-seeker/resumes/new');
});
it('formats a Tashkent date consistently across a UTC day boundary and chooses Russian count endings', () => {
  expect(tashkentStamp('2026-10-16T23:30:00Z')).toBe('17.10 04:30');
  expect([1, 2, 5, 11, 21, 22].map(value => vacancyNoun(value, true))).toEqual(['вакансия', 'вакансии', 'вакансий', 'вакансий', 'вакансия', 'вакансии']);
});

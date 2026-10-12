import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import JobsPage from '@/app/jobs/page';
import { jobCatalogQuery } from '@/lib/job-catalog';
import { translations } from '@/lib/translations';
let urlQuery = '', lang = 'ru', referencesFail = false;
const replace = jest.fn();
const reads: Array<{ filters: any; signal: AbortSignal; finish: (value: any) => void }> = [];
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(urlQuery), useRouter: () => ({ replace }) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang, t: translations[lang as 'ru' | 'uz'] }) }));
jest.mock('@/lib/job-catalog', () => ({ ...jest.requireActual('@/lib/job-catalog'), jobCatalogQuery: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: () => {
  const query: any = { select: () => query, neq: () => query, order: () => query, abortSignal: () => Promise.resolve({ data: [], error: referencesFail ? new Error('reference unavailable') : null }) }; return query;
} } }));
jest.mock('@/components/jobs/job-card', () => ({ JobCard: ({ job }: any) => <p>{job.title_ru}</p> }));
jest.mock('@/components/jobs/job-filters', () => ({ JobFilters: (props: any) => <>
  <span data-testid="region">{props.selectedRegion}</span><span data-testid="district">{props.selectedDistrict}</span>
  <button onClick={() => props.onRegionChange('9')}>Бухара</button>
  <button onClick={() => props.onSalaryRangeChange([2000000, 6000000])}>Зарплата</button>
  <button onClick={props.onClear}>Сбросить</button>
</> }));
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); reads.length = 0; urlQuery = ''; lang = 'ru'; referencesFail = false;
  (jobCatalogQuery as jest.Mock).mockImplementation((_client, filters) => ({ abortSignal: (signal: AbortSignal) => new Promise(resolve => reads.push({ filters, signal, finish: resolve })) }));
});
afterEach(() => jest.useRealTimers());
const advance = async (ms = 300) => act(async () => { jest.advanceTimersByTime(ms); });
const complete = async (index: number, title = 'Результат', count = 25) => act(async () => reads[index].finish({ data: [{ id: title, title_ru: title }], error: null, count }));

test('fast typing cancels pending reads; no false zero count is shown during loading', async () => {
  render(<JobsPage />); expect(screen.queryByText('Найдено 0 вакансий')).not.toBeInTheDocument(); await advance();
  fireEvent.change(screen.getByRole('textbox', { name: 'Поиск вакансий' }), { target: { value: 'Бух' } });
  expect(reads[0].signal.aborted).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: 'Поиск вакансий' }), { target: { value: 'Бухгалтер' } }); await advance();
  expect(reads).toHaveLength(2); expect(reads[1].filters.q).toBe('Бухгалтер'); await complete(1, 'Новый результат'); await complete(0, 'Старый результат');
  expect(screen.getByText('Новый результат')).toBeInTheDocument(); expect(screen.queryByText('Старый результат')).not.toBeInTheDocument();
});
test('changing any filter resets pagination in the same update; a region change also clears its old district', async () => {
  urlQuery = 'region=22&district=100'; render(<JobsPage />); await advance(); await complete(0);
  fireEvent.click(screen.getByText('Далее')); await advance(); expect(reads[1].filters.page).toBe(2); await complete(1);
  fireEvent.click(screen.getByText('Бухара')); await advance(); expect(reads[2].filters).toMatchObject({ region: '9', district: 'all', page: 1 });
  expect(reads.some(read => read.filters.region === '9' && read.filters.page === 2)).toBe(false);
});
test('external Back/Forward navigation restores filters/page and cancels a pending URL write', async () => {
  const view = render(<JobsPage />); fireEvent.change(screen.getByRole('textbox', { name: 'Поиск вакансий' }), { target: { value: 'черновик' } });
  urlQuery = 'q=Водитель&region=12&page=3'; view.rerender(<JobsPage />); expect(screen.getByRole('textbox', { name: 'Поиск вакансий' })).toHaveValue('Водитель');
  await advance(500); expect(reads).toHaveLength(1); expect(reads[0].filters).toMatchObject({ q: 'Водитель', region: '12', page: 3 }); expect(replace).not.toHaveBeenCalled();
});
test('a delayed acknowledgement of our own URL cannot overwrite newer typing or restart its page', async () => {
  const view = render(<JobsPage />); fireEvent.change(screen.getByRole('textbox', { name: 'Поиск вакансий' }), { target: { value: 'Бух' } }); await advance(400);
  const previousWrite = replace.mock.calls[0][0]; fireEvent.change(screen.getByRole('textbox', { name: 'Поиск вакансий' }), { target: { value: 'Бухгалтер' } });
  urlQuery = previousWrite.split('?')[1]; view.rerender(<JobsPage />); expect(screen.getByRole('textbox', { name: 'Поиск вакансий' })).toHaveValue('Бухгалтер'); await advance(400);
  expect(replace.mock.calls.at(-1)[0]).toBe('/jobs?q=%D0%91%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80');
});
test('query errors and missing exact counts show retry instead of a false empty catalog', async () => {
  render(<JobsPage />); await advance(); await act(async () => reads[0].finish({ data: null, count: null, error: new Error('failure') }));
  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить вакансии'); expect(screen.queryByText('Найдено 0 вакансий')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Повторить')); await advance(); await act(async () => reads[1].finish({ data: [], count: null, error: null }));
  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить вакансии'); fireEvent.click(screen.getByText('Повторить')); await advance(); await complete(2);
  expect(screen.getByText('Найдено 25 вакансий')).toBeInTheDocument();
});
test('a reference-data failure has its own retry and does not discard search results', async () => {
  referencesFail = true; render(<JobsPage />); await advance(); await complete(0); expect(screen.getByRole('alert')).toHaveTextContent('справочники');
  referencesFail = false; fireEvent.click(screen.getByText('Повторить загрузку фильтров')); await act(async () => {}); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.getByText('Результат')).toBeInTheDocument();
});
test('changing language preserves the loaded page and query without another network read', async () => {
  const view = render(<JobsPage />); await advance(); await complete(0); lang = 'uz'; view.rerender(<JobsPage />); expect(screen.getByText('25 ta vakansiya topildi')).toBeInTheDocument(); expect(reads).toHaveLength(1);
});

test('the mobile filter disclosure preserves selected filters and loaded results when closed', async () => {
  render(<JobsPage />); await advance(); await complete(0);
  const open = screen.getByRole('button', { name: 'Показать фильтры' }); expect(open).toHaveAttribute('aria-expanded', 'false'); expect(open).toHaveAttribute('aria-controls', 'job-catalog-filters');
  fireEvent.click(open); expect(screen.getByRole('button', { name: 'Скрыть фильтры' })).toHaveAttribute('aria-expanded', 'true'); fireEvent.click(screen.getByText('Бухара')); await advance(); await complete(1);
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть фильтры' })); expect(screen.getByRole('button', { name: 'Показать фильтры' })).toHaveAttribute('aria-expanded', 'false'); expect(screen.getByTestId('region')).toHaveTextContent('9'); expect(screen.getByText('Результат')).toBeInTheDocument();
});

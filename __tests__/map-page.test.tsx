import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MapPage from '@/app/map/page';

const mockRequests: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];
const mockRange = jest.fn();
const mockMap = jest.fn();
const mockQuery: any = {};
for (const method of ['select', 'eq', 'gte', 'lte', 'order']) mockQuery[method] = jest.fn(() => mockQuery);
mockQuery.range = mockRange;
jest.mock('@/lib/supabase', () => ({ supabase: { from: () => mockQuery } }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru', t: { map: { title: 'Карта вакансий' } } }) }));
jest.mock('@/components/map/job-map', () => ({ JobMap: (props: any) => { mockMap(props); return <div data-testid="map" />; } }));
jest.mock('@/components/jobs/job-card', () => ({ JobCard: ({ job }: any) => <span>{job.title_ru}</span> }));
const job = (id: string) => ({ id, title_ru: `Работа ${id}`, latitude: 41.3, longitude: 69.2 });
const resolve = async (index: number, data: any[], count: number) => { await act(async () => mockRequests[index].resolve({ data, count, error: null })); };
beforeEach(() => {
  jest.clearAllMocks(); mockRequests.length = 0;
  mockRange.mockImplementation(() => new Promise((resolve, reject) => mockRequests.push({ resolve, reject })));
});

test('queries valid coordinates and loads beyond the first database page without duplicate cards', async () => {
  render(<MapPage />);
  expect(mockQuery.gte).toHaveBeenCalledWith('latitude', -90);
  expect(mockQuery.lte).toHaveBeenCalledWith('longitude', 180);
  expect(mockRange).toHaveBeenCalledWith(0, 99);
  await resolve(0, [job('a')], 102);
  fireEvent.click(screen.getByRole('button', { name: 'Загрузить ещё' }));
  expect(mockRange).toHaveBeenLastCalledWith(100, 199);
  await resolve(1, [job('a'), job('b')], 102);
  expect(screen.getAllByText('Работа a')).toHaveLength(1);
  expect(screen.getByText('Загружено 2 из 102 вакансий')).toBeInTheDocument();
});
test('shows a retryable network error instead of claiming the database is empty', async () => {
  render(<MapPage />);
  await act(async () => mockRequests[0].reject(new Error('offline')));
  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить');
  expect(screen.queryByText(/координатами пока нет/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await resolve(1, [job('a')], 1);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Работа a')).toBeInTheDocument();
});
test('selecting a vacancy changes the viewport and the country button restores it', async () => {
  render(<MapPage />); await resolve(0, [job('a')], 1);
  fireEvent.click(screen.getByRole('button', { name: 'Показать на карте' }));
  await waitFor(() => expect(mockMap).toHaveBeenLastCalledWith(expect.objectContaining({ center: { lat: 41.3, lng: 69.2 }, zoom: 12 })));
  fireEvent.click(screen.getByRole('button', { name: 'Весь Узбекистан' }));
  expect(mockMap).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 6, selectedJobId: undefined }));
});

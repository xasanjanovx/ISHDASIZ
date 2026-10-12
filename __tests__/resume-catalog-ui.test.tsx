import {ResumeCatalog} from '@/components/resumes/resume-catalog';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ResumesPage from '@/app/resumes/page';
import { ResumeCard } from '@/components/resumes/resume-card';
import { useResumeCatalog } from '@/hooks/use-resume-catalog';
let query: string, lang: 'ru' | 'uz', referenceFailure: boolean;
const replace = jest.fn(), openModal = jest.fn();
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(query), useRouter: () => ({ replace }) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang }) }));
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user: null, isAuthenticated: false }) }));
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ openModal }) }));
jest.mock('@/hooks/use-resume-catalog', () => ({ useResumeCatalog: jest.fn() }));
jest.mock('@/components/resumes/resume-filters', () => ({ ResumeFilters: (props: any) => <button onClick={() => props.onRegionChange('9')}>Choose region</button> }));
jest.mock('sonner', () => ({ toast: { info: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: () => { const request: any = { select: () => request, neq: () => request, order: () => Promise.resolve({ data: [], error: referenceFailure ? {} : null }) }; return request; } } }));
const catalog = useResumeCatalog as jest.Mock;
const state = (extra = {}) => ({ resumes: [], nextCursor: null, loading: false, error: null, moreError: null, loadingMore: false, refresh: jest.fn(), loadMore: jest.fn(), ...extra });
beforeEach(() => { jest.clearAllMocks(); query = ''; lang = 'ru'; referenceFailure = false; catalog.mockReturnValue(state()); });
test('partial empty searches expose continuation and never claim final absence', async () => {
  const current = state({ nextCursor: 'cursor' }); catalog.mockReturnValue(current); await act(async () => render(<ResumesPage />));
  expect(screen.getByText('Пока нет совпадений')).toBeInTheDocument(); expect(screen.queryByText('Резюме не найдены')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить поиск' })); expect(current.loadMore).toHaveBeenCalledTimes(1);
});
test('loading and failure are distinct from empty and pagination failures keep existing cards', async () => {
  catalog.mockReturnValue(state({ loading: true })); const view = render(<ResumesPage />); expect(screen.queryByText('Резюме не найдены')).not.toBeInTheDocument();
  const current = state({ resumes: [{ id: 'one', title: 'Developer', full_name: 'Candidate' }], nextCursor: 'cursor', moreError: new Error() });
  catalog.mockReturnValue(current); await act(async () => view.rerender(<ResumesPage />)); expect(screen.getByText('Developer')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' })); expect(current.loadMore).toHaveBeenCalledTimes(1);
});
test('external URL changes and return to the original URL restore filters instead of reviving old input', async () => {
  const view = render(<ResumesPage />); fireEvent.change(screen.getByRole('textbox', { name: 'Поиск резюме' }), { target: { value: 'React' } });
  expect(catalog).toHaveBeenLastCalledWith('q=React'); query = 'q=React'; await act(async () => view.rerender(<ResumesPage />));
  query = 'q=JS&region=22&district=100'; await act(async () => view.rerender(<ResumesPage />)); expect(screen.getByRole('textbox')).toHaveValue('JS');
  fireEvent.click(screen.getByRole('button', { name: 'Открыть фильтры' })); fireEvent.click(screen.getByText('Choose region')); expect(catalog).toHaveBeenLastCalledWith('q=JS&region=9');
  query = ''; await act(async () => view.rerender(<ResumesPage />)); expect(screen.getByRole('textbox')).toHaveValue(''); expect(catalog).toHaveBeenLastCalledWith('');
});
test('reference failures have retry and Uzbek empty results translate without reloading the data', async () => {
  referenceFailure = true; const view = render(<ResumesPage />); fireEvent.click(screen.getByRole('button', { name: 'Открыть фильтры' })); await act(async () => {});
  expect(screen.getByText('Не удалось загрузить справочники фильтров.')).toBeInTheDocument(); referenceFailure = false;
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))); expect(screen.queryByText('Не удалось загрузить справочники фильтров.')).not.toBeInTheDocument();
  lang = 'uz'; view.rerender(<ResumesPage />); expect(screen.getByText('Rezyumelar topilmadi')).toBeInTheDocument();
});
test('guest cards are keyboard accessible and a region displays even without a district', () => {
  const login = jest.fn(); render(<ResumeCard resume={{ id: 'one', title: 'Developer', full_name: 'Candidate', regions: { name_ru: 'Ташкент', name_uz: 'Toshkent' }, skills: '["React"]' }} canOpenDetails={false} onRequireEmployerAccess={login} />);
  expect(screen.getByText('Ташкент')).toBeInTheDocument(); expect(screen.getByText('React')).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('button', { name: 'Developer, Candidate' }), { key: 'Enter' }); expect(login).toHaveBeenCalledTimes(1);
});
test('the employer search keeps filter changes within its profile URL',async()=>{
 jest.useFakeTimers();try{query='region=22';await act(async()=>{render(<ResumeCatalog basePath="/profile/employer/search-resumes"/>);});fireEvent.change(screen.getByRole('textbox',{name:'Поиск резюме'}),{target:{value:'React'}});await act(async()=>{jest.advanceTimersByTime(401);});expect(replace).toHaveBeenLastCalledWith('/profile/employer/search-resumes?q=React&region=22',{scroll:false});}finally{jest.useRealTimers();}
});

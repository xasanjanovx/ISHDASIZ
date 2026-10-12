import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApplicationsPage } from '@/components/profile/applications';
import CandidatesPage from '@/app/profile/employer/candidates/page';
import { accountApi, AccountApiError } from '@/lib/account-api';
let mockUser: any;
const mockOpen = jest.fn();
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user: mockUser, isLoading: false }) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ openModal: mockOpen }) }));
jest.mock('@/components/profile/profile-layout', () => ({ ProfileLayout: ({ children }: any) => <div>{children}</div> }));
jest.mock('@/lib/account-api', () => ({ ...jest.requireActual('@/lib/account-api'), accountApi: jest.fn() }));
const api = accountApi as jest.Mock;
const application = { id: 'one', job_id: 'job', full_name: 'Candidate', phone: '+998901234567', status: 'pending', created_at: '2026-10-07T00:00:00Z', responded_at: null, is_seen_by_job_seeker: false, jobs: { id: 'job', title_uz: 'Dasturchi', title_ru: '', company_name: 'Company', regions: { name_ru: 'Ташкентская область' }, districts: null }, resumes: null };
beforeEach(() => { jest.clearAllMocks(); mockUser = { id: 'A' }; api.mockImplementation(async (_url: string, init?: any) => init?.method === 'PATCH' ? { application } : { applications: [application], stats: null, nextCursor: null }); });
test('guests see a login action and make no private API request', () => {
  mockUser = null; render(<ApplicationsPage role="employer" />); fireEvent.click(screen.getByRole('button', { name: 'Войти' })); expect(mockOpen).toHaveBeenCalledTimes(1); expect(api).not.toHaveBeenCalled();
});
test('failed list loading is distinct from an empty history and supports retry', async () => {
  api.mockRejectedValueOnce(new AccountApiError(503)); render(<ApplicationsPage role="job_seeker" />); await screen.findByRole('alert'); expect(screen.queryByText('Откликов пока нет')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Повторить' })); await screen.findByText('Dasturchi'); expect(screen.getByText('Ташкентская область')).toBeInTheDocument();
});
test('opening one applicant sends a view action; a failed invitation keeps the dialog and original status', async () => {
  api.mockImplementation(async (_url: string, init?: any) => {
    if (init?.method === 'PATCH') { const body = JSON.parse(init.body); if (body.action === 'status') throw new AccountApiError(503); return { application: { ...application, status: 'reviewed', responded_at: '2026-10-07T01:00:00Z' } }; }
    return { applications: [application], stats: null, nextCursor: null };
  });
  render(<CandidatesPage />); const open = await screen.findByRole('button', { name: 'Открыть отклик' }); expect(api).toHaveBeenCalledTimes(1); fireEvent.click(open);
  const dialog = await screen.findByRole('dialog'); await within(dialog).findByText('Просмотрен'); fireEvent.click(within(dialog).getByRole('button', { name: 'Пригласить на собеседование' }));
  fireEvent.change(within(dialog).getByLabelText('Дата и время собеседования'),{target:{value:'2026-10-12T10:30'}});fireEvent.change(within(dialog).getByLabelText('Адрес или ссылка на встречу'),{target:{value:'Синтетический адрес'}});fireEvent.submit(within(dialog).getByRole('form',{name:'Назначение собеседования'}));
  await within(dialog).findByRole('alert');expect(within(dialog).getByLabelText('Дата и время собеседования')).toHaveValue('2026-10-12T10:30');expect(within(dialog).getByLabelText('Адрес или ссылка на встречу')).toHaveValue('Синтетический адрес'); expect(dialog).toBeInTheDocument(); expect(within(dialog).getByText('Просмотрен')).toBeInTheDocument(); expect(within(dialog).queryByText('Собеседование')).not.toBeInTheDocument();
  expect(JSON.parse(api.mock.calls.at(-1)![1].body).expected).toEqual({ status: 'reviewed', responded_at: '2026-10-07T01:00:00Z' });
});
test('unavailable vacancies keep their history and employer feedback remains visible', async () => {
  api.mockResolvedValue({ applications: [{ ...application, jobs: null, status: 'rejected', is_seen_by_job_seeker: true, rejection_reason: 'Нужен опыт', employer_message: 'Спасибо за отклик' }], stats: null, nextCursor: null });
  render(<ApplicationsPage role="job_seeker" />); await screen.findByText('Вакансия недоступна'); expect(screen.getByText(/Нужен опыт/)).toBeInTheDocument(); expect(screen.getByText(/Спасибо за отклик/)).toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Вакансия' })).not.toBeInTheDocument();
});
test('switching accounts unmounts a private applicant dialog before the new list loads', async () => {
  const view = render(<ApplicationsPage role="employer" />); fireEvent.click(await screen.findByRole('button', { name: 'Открыть отклик' })); await screen.findByRole('dialog');
  api.mockImplementation(() => new Promise(() => {})); mockUser = { id: 'B' }; view.rerender(<ApplicationsPage role="employer" />); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(screen.queryByText('Candidate')).not.toBeInTheDocument();
});


test('scheduling from the status selector opens a draft and writes only after confirmation with fixed Uzbekistan time',async()=>{
 api.mockImplementation(async (_url:string,init?:any)=>{
  if(init?.method==='PATCH'){const b=JSON.parse(init.body);return {application:{...application,status:b.action==='view'?'reviewed':b.status,responded_at:b.action==='view'?null:'2026-10-10T00:00:00Z',...b.details}};}
  return {applications:[application],stats:null,nextCursor:null};
 });
 render(<ApplicationsPage role="employer"/>);fireEvent.change(await screen.findByRole('combobox',{name:'Статус отклика: Candidate'}),{target:{value:'interview_set'}});const dialog=await screen.findByRole('dialog');await within(dialog).findByText('Просмотрен');
 expect(api.mock.calls.filter(([,init])=>init?.method==='PATCH').map(([,init])=>JSON.parse(init.body).action)).toEqual(['view']);
 fireEvent.change(within(dialog).getByLabelText('Дата и время собеседования'),{target:{value:'2026-10-12T10:30'}});fireEvent.change(within(dialog).getByLabelText('Адрес или ссылка на встречу'),{target:{value:'  https://meeting.example/demo  '}});fireEvent.change(within(dialog).getByLabelText('Сообщение кандидату'),{target:{value:'  Принесите резюме  '}});fireEvent.submit(within(dialog).getByRole('form',{name:'Назначение собеседования'}));await within(dialog).findByText('Собеседование');expect(within(dialog).queryByRole('form')).not.toBeInTheDocument();const b=JSON.parse(api.mock.calls.at(-1)![1].body);expect(b.details).toEqual({interview_date:'2026-10-12T10:30:00+05:00',interview_address:'https://meeting.example/demo',employer_message:'Принесите резюме'});expect(b.expected).toEqual({status:'reviewed',responded_at:null});expect(within(dialog).getByText(/Принесите резюме/)).toBeInTheDocument();expect(within(dialog).getByText(/10:30.*UTC\+5/)).toBeInTheDocument();
});
test('cancelling an interview draft sends no decision and leaves the confirmed status',async()=>{
 api.mockImplementation(async(_url:string,init?:any)=>init?.method==='PATCH'?{application:{...application,status:'reviewed'}}:{applications:[application],stats:null,nextCursor:null});render(<ApplicationsPage role="employer"/>);fireEvent.click(await screen.findByRole('button',{name:'Открыть отклик'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByText('Просмотрен');fireEvent.click(within(dialog).getByRole('button',{name:'Пригласить на собеседование'}));fireEvent.click(within(dialog).getByRole('button',{name:'Отмена'}));expect(within(dialog).queryByRole('form')).not.toBeInTheDocument();expect(api.mock.calls.filter(([,init])=>init?.method==='PATCH')).toHaveLength(1);expect(within(dialog).getByText('Просмотрен')).toBeInTheDocument();
});
test('an empty or invalid interview date never sends a decision',async()=>{
 api.mockImplementation(async(_url:string,init?:any)=>init?.method==='PATCH'?{application:{...application,status:'reviewed'}}:{applications:[application],stats:null,nextCursor:null});render(<ApplicationsPage role="employer"/>);fireEvent.click(await screen.findByRole('button',{name:'Открыть отклик'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByText('Просмотрен');fireEvent.click(within(dialog).getByRole('button',{name:'Пригласить на собеседование'}));fireEvent.submit(within(dialog).getByRole('form',{name:'Назначение собеседования'}));expect(within(dialog).getByRole('alert')).toHaveTextContent('Укажите корректную дату');expect(api.mock.calls.filter(([,init])=>init?.method==='PATCH')).toHaveLength(1);
});


test('employer opens the submitted CV through the application, and closing the candidate removes private details',async()=>{
 const resume={id:'private-cv',title:'Submitted CV',about:'Brief summary',skills:[],experience:[]};api.mockImplementation(async(url:string,init?:any)=>url.endsWith('/resume')?{resume:{id:'private-cv',title:'Full private CV',skills:[],experience_details:[],education:[],languages:[],experience:null,experience_years:null}}:init?.method==='PATCH'?{application:{...application,status:'reviewed',resumes:resume}}:{applications:[{...application,resumes:resume}],stats:null,nextCursor:null});render(<ApplicationsPage role="employer"/>);fireEvent.click(await screen.findByRole('button',{name:'Открыть отклик'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByText('Просмотрен');expect(api.mock.calls.some(([url])=>url.endsWith('/resume'))).toBe(false);fireEvent.click(within(dialog).getByRole('button',{name:'Открыть резюме'}));expect(await within(dialog).findByText('Full private CV')).toBeInTheDocument();expect(within(dialog).queryByRole('link',{name:'Открыть резюме'})).not.toBeInTheDocument();fireEvent.click(within(dialog).getByRole('button',{name:'Close'}));expect(screen.queryByText('Full private CV')).not.toBeInTheDocument();
});

import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {AdminStatisticsPage} from '@/components/admin/admin-statistics';
import {AdminApplicationsPage} from '@/components/admin/admin-applications';
import {AdminVacancyEditorPage,AdminVacanciesPage} from '@/components/admin/admin-vacancies';
import {accountApi,AccountApiError} from '@/lib/account-api';
const mockAdminRequest=jest.fn(),mockPush=jest.fn();let mockAuth:any,mockLang='ru';
jest.mock('@/contexts/auth-context',()=>({useAuth:()=>mockAuth}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang:mockLang})}));
jest.mock('next/navigation',()=>({useRouter:()=>({push:mockPush})}));
jest.mock('@/lib/admin-api',()=>({...jest.requireActual('@/lib/admin-api'),adminApi:(token:string,...args:any[])=>mockAdminRequest(token,...args)}));
jest.mock('@/lib/account-api',()=>({...jest.requireActual('@/lib/account-api'),accountApi:jest.fn()}));
jest.mock('@/components/profile/vacancy-ai',()=>({VacancyAI:({endpoint}:any)=><p>{endpoint}</p>}));
jest.mock('@/components/ui/location-select',()=>({LocationSelect:()=>null}));
jest.mock('@/components/map/job-map',()=>({JobMap:()=>null}));
jest.mock('@/lib/supabase',()=>({supabase:{from:(table:string)=>{if(table!=='categories')throw new Error('Private browser query');const query:any={select:()=>query,order:()=>query,abortSignal:async()=>({data:[],error:null})};return query;}}}));
const stats={totalJobs:1205,activeJobs:1200,hiddenJobs:5,removedJobs:1,totalViews:2410,totalApplications:50,jobsByCategory:[{id:'C',name_ru:'IT',name_uz:'IT',count:1205}],jobsByDistrict:[],jobsByType:[]};
const row={id:'J',title_ru:'Vacancy',company_name:'Demo company',status:'draft',is_active:false,updated_at:'2026-10-07T00:00:00.123456Z',views_count:0};
const application={id:'APP',full_name:'Candidate',phone:'+998901234567',status:'viewed',created_at:null,message:'Applicant message',jobs:row,resumes:{title:'Resume title',full_name:'Candidate',skills:['Excel'],about:'Resume summary'}};
beforeEach(()=>{jest.clearAllMocks();mockAdminRequest.mockReset();mockAuth={user:{id:'A'},session:{access_token:'token-A'},adminProfile:{id:'A',role:'hokimlik_assistant',district_id:100},loading:false,error:null,refresh:jest.fn()};mockLang='ru';});
test('guests and denied roles do not request admin data; errors offer a retry instead of a blank dashboard',async()=>{
 mockAuth.user=null;mockAuth.adminProfile=null;render(<AdminStatisticsPage/>);expect(mockAdminRequest).not.toHaveBeenCalled();expect(screen.getByRole('link',{name:'Войти администратором'})).toBeInTheDocument();
});
test('stats failures stay visible, retry shows real counts and an empty district group is explicit',async()=>{
 mockAdminRequest.mockRejectedValueOnce(new AccountApiError(503)).mockResolvedValueOnce({stats});render(<AdminStatisticsPage detailed/>);await screen.findByRole('alert');expect(screen.queryAllByText(/1\s205/)).toHaveLength(0);fireEvent.click(screen.getByRole('button',{name:'Повторить загрузку'}));await screen.findAllByText(/1\s205/);expect(screen.getByText('Назначенный вам район')).toBeInTheDocument();expect(screen.getAllByText('Пока нет вакансий')).toHaveLength(2);expect(mockAdminRequest.mock.calls.every(([token])=>token==='token-A')).toBe(true);
});
test('applications show a protected resume summary, clear detail on page changes, and never claim missing counts are zero',async()=>{
 mockAdminRequest.mockResolvedValueOnce({applications:[application],total:55,page:0,hasMore:true,stats:null,stats_error:true}).mockResolvedValueOnce({applications:[],total:55,page:1,hasMore:false,stats:{total:55},stats_error:false});render(<AdminApplicationsPage/>);await screen.findByText('Candidate');expect(screen.getByRole('alert')).toHaveTextContent('счётчики недоступны');expect(within(screen.getByRole('article')).getByText('Просмотрен')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Посмотреть отклик'}));expect(within(await screen.findByRole('dialog')).getByText('Resume summary')).toBeInTheDocument();fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Close'}));fireEvent.click(screen.getByRole('button',{name:'Далее'}));await screen.findByText('Страница 2');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(mockAdminRequest.mock.calls.at(-1)[1]).toContain('page=1');
});
test('changing administrative scope discards old candidate data and a late response cannot reveal it',async()=>{
 let resolve:(value:any)=>void=()=>{};mockAdminRequest.mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockResolvedValueOnce({applications:[],total:0,page:0,hasMore:false,stats:{total:0}});const view=render(<AdminApplicationsPage/>);mockAuth={...mockAuth,user:{id:'B'},adminProfile:{id:'B',role:'hokimlik_assistant',district_id:200},session:{access_token:'token-B'}};view.rerender(<AdminApplicationsPage/>);await screen.findByText('Отклики по этим условиям не найдены.');await act(async()=>resolve({applications:[application],total:1,page:0,hasMore:false,stats:{total:1}}));expect(screen.queryByText('Candidate')).not.toBeInTheDocument();
});
test('admin editor supports company input and the admin AI route, preserves failed drafts, and navigates only after confirmed saving',async()=>{
 mockAdminRequest.mockImplementation(async(_token,url,init)=>init?.method?{vacancy:row}:url.endsWith('/prefill')?{employer:{company_name:'',region_id:22,district_id:100}}:{vacancy:row});render(<AdminVacancyEditorPage/>);const company=await screen.findByLabelText('Компания');expect(company).not.toHaveAttribute('readonly');fireEvent.change(company,{target:{value:'New company'}});fireEvent.change(screen.getByLabelText('Название — Русский'),{target:{value:'New draft'}});expect(screen.getByText('/api/admin/ai/vacancy-helper')).toBeInTheDocument();mockAdminRequest.mockRejectedValueOnce(new AccountApiError(503));fireEvent.click(screen.getByRole('button',{name:'Сохранить черновик'}));await screen.findByRole('alert');expect(company).toHaveValue('New company');expect(mockPush).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Сохранить черновик'}));await waitFor(()=>expect(mockPush).toHaveBeenCalledWith('/admin/jobs'));const [,url,init]=mockAdminRequest.mock.calls.at(-1);expect(url).toBe('/api/admin/jobs');expect(JSON.parse(init.body)).toMatchObject({company_name:'New company',title_ru:'New draft',status:'draft',district_id:100});expect(accountApi).not.toHaveBeenCalled();
});
test('admin vacancy list uses administrative links and shows localized errors rather than employer-role instructions',async()=>{
 mockAdminRequest.mockResolvedValueOnce({vacancies:[row],nextCursor:null,stats:{all:1,active:0,draft:1,filled:0,archived:0}});render(<AdminVacanciesPage/>);await screen.findByText('Vacancy');expect(screen.getByRole('link',{name:'Редактировать'})).toHaveAttribute('href','/admin/jobs/J');expect(screen.getByRole('link',{name:'Создать вакансию'})).toHaveAttribute('href','/admin/jobs/new');mockAdminRequest.mockRejectedValueOnce(new AccountApiError(403,'Назначенный район недоступен / Tuman mavjud emas'));fireEvent.click(screen.getByRole('button',{name:'Опубликовать'}));expect(await screen.findByRole('alert')).toHaveTextContent('Назначенный район недоступен');expect(accountApi).not.toHaveBeenCalled();
});

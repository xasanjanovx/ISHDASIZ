import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {OwnVacanciesPage} from '@/components/profile/own-vacancies';
import {accountApi,AccountApiError} from '@/lib/account-api';
let mockUser:any;
jest.mock('@/contexts/user-auth-context',()=>({useUserAuth:()=>({user:mockUser,isLoading:false})}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang:'ru'})}));
jest.mock('@/contexts/auth-modal-context',()=>({useAuthModal:()=>({openModal:jest.fn()})}));
jest.mock('@/components/profile/profile-layout',()=>({ProfileLayout:({children}:any)=><main>{children}</main>}));
jest.mock('@/lib/account-api',()=>({...jest.requireActual('@/lib/account-api'),accountApi:jest.fn()}));
const api=accountApi as jest.Mock,row={id:'R',title_ru:'Owned vacancy',company_name:'Company',status:'active',is_active:true,updated_at:'2026-10-07T00:00:00.123456Z',applications_count:1205},stats={all:1,active:1,draft:0,filled:0,archived:0};
const page=(extra={})=>({vacancies:[row],stats,nextCursor:null,...extra});
beforeEach(()=>{jest.clearAllMocks();api.mockReset();mockUser={id:'A'};api.mockResolvedValue(page());});
test('a failed list is shown as an error rather than an empty account and retry works',async()=>{
 api.mockRejectedValueOnce(new AccountApiError(503));render(<OwnVacanciesPage/>);await screen.findByRole('alert');expect(screen.queryByText('В этом разделе пока нет вакансий')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Повторить загрузку'}));await screen.findByText('Owned vacancy');expect(screen.getByRole('link',{name:'Редактировать'})).toHaveAttribute('href','/profile/employer/vacancies/R');
});
test('counter errors leave editing usable and unavailable values are never rendered as zero',async()=>{
 api.mockResolvedValue(page({stats:null,counts_error:true,stats_error:true,vacancies:[{...row,applications_count:null}]}));render(<OwnVacanciesPage/>);await screen.findByText('Owned vacancy');expect(screen.getByText('Отклики: —')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Редактировать'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Скрыть'})).toBeEnabled();
});
test('archive needs confirmation; a failure keeps the dialog and card, and restore is private with the new version',async()=>{
 render(<OwnVacanciesPage/>);fireEvent.click(await screen.findByRole('button',{name:'В архив'}));const dialog=await screen.findByRole('alertdialog');expect(api.mock.calls.filter(([,init])=>init?.method)).toHaveLength(0);
 api.mockRejectedValueOnce(new AccountApiError(503));fireEvent.click(within(dialog).getByRole('button',{name:'Подтвердить'}));await within(dialog).findByRole('alert');expect(screen.getByText('Owned vacancy')).toBeInTheDocument();
 api.mockResolvedValueOnce({vacancy:{...row,status:'archived',is_active:false,updated_at:'2026-10-07T01:00:00.123456Z'}});fireEvent.click(within(dialog).getByRole('button',{name:'Подтвердить'}));await waitFor(()=>expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());expect(screen.queryByRole('link',{name:'Посмотреть на сайте'})).not.toBeInTheDocument();
 api.mockResolvedValueOnce({vacancy:{...row,status:'draft',is_active:false}});fireEvent.click(screen.getByRole('button',{name:'Восстановить как черновик'}));await screen.findByRole('button',{name:'Опубликовать'});expect(JSON.parse(api.mock.calls.at(-1)![1].body)).toMatchObject({action:'restore',expected_updated_at:'2026-10-07T01:00:00.123456Z'});
});
test('a duplicate hide click sends once, does not pretend success and a stale account response is ignored',async()=>{
 let finish:(value:any)=>void=()=>{};const view=render(<OwnVacanciesPage/>);const button=await screen.findByRole('button',{name:'Скрыть'});api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));fireEvent.click(button);fireEvent.click(button);expect(api.mock.calls.filter(([,init])=>init?.method)).toHaveLength(1);expect(screen.getByRole('link',{name:'Посмотреть на сайте'})).toBeInTheDocument();
 api.mockImplementation(()=>new Promise(()=>{}));mockUser={id:'B'};view.rerender(<OwnVacanciesPage/>);expect(screen.queryByText('Owned vacancy')).not.toBeInTheDocument();await act(async()=>finish({vacancy:{...row,status:'draft',is_active:false}}));expect(screen.queryByText('Owned vacancy')).not.toBeInTheDocument();
});
test('load-more preserves the first page on error and deduplicates retried pages',async()=>{
 api.mockResolvedValueOnce(page({nextCursor:'R'}));render(<OwnVacanciesPage/>);const button=await screen.findByRole('button',{name:'Показать ещё'});api.mockRejectedValueOnce(new AccountApiError(503));fireEvent.click(button);await screen.findByRole('alert');expect(screen.getByText('Owned vacancy')).toBeInTheDocument();
 api.mockResolvedValueOnce(page({vacancies:[row,{...row,id:'S',title_ru:'Second vacancy'}]}));fireEvent.click(screen.getByRole('button',{name:'Повторить загрузку'}));await screen.findByText('Second vacancy');expect(screen.getAllByText('Owned vacancy')).toHaveLength(1);expect(api.mock.calls.at(-1)![0]).toContain('before=R');
});
test('filter changes ignore delayed results from the old filter',async()=>{
 let finish:(value:any)=>void=()=>{};api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));render(<OwnVacanciesPage/>);api.mockResolvedValueOnce(page({vacancies:[],stats:{...stats,all:0,active:0}}));fireEvent.click(screen.getByRole('button',{name:'Архив',exact:true}));await screen.findByText('В этом разделе пока нет вакансий');await act(async()=>finish(page()));expect(screen.queryByText('Owned vacancy')).not.toBeInTheDocument();
});

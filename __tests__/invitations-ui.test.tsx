import React from 'react';
import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { InvitationsPage } from '@/components/profile/invitations';
import { accountApi } from '@/lib/account-api';
let mockUser:any={id:'seeker'},mockLang:'ru'|'uz'='ru',mockApplication:any;
jest.mock('@/contexts/user-auth-context',()=>({useUserAuth:()=>({user:mockUser,isLoading:false})}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang:mockLang})}));
jest.mock('@/contexts/auth-modal-context',()=>({useAuthModal:()=>({openModal:jest.fn()})}));
jest.mock('@/components/profile/profile-layout',()=>({ProfileLayout:({children}:any)=><div>{children}</div>}));
jest.mock('@/components/jobs/application-modal',()=>({ApplicationModal:(props:any)=>{mockApplication=props;return props.isOpen?<div role="dialog" aria-label="Application window">Resume required</div>:null;}}));
jest.mock('@/lib/account-api',()=>({accountApi:jest.fn(),AccountApiError:class extends Error{constructor(public status:number){super();}}}));
const api=accountApi as jest.Mock,DATE='2026-10-10T00:00:00.123456Z';
const item=(n=1,extra:any={})=>({id:'offer-'+n,created_at:DATE,seen_at:null,status:'sent',job_available:true,job:{id:'job-'+n,title_ru:'Вакансия '+n,title_uz:'Vakansiya '+n,company_name:'Компания '+n},...extra});
const detail=(n=1,extra:any={})=>({...item(n),message:'Message '+n,resume:{id:'resume-'+n,title:'Own CV'},job:{...item(n).job,is_active:true,source:'local',description_ru:'Current description '+n},...extra});
const deferred=()=>{let resolve:(value:any)=>void=()=>{},reject:(error:unknown)=>void=()=>{};const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});return{promise,resolve,reject};};
beforeEach(()=>{api.mockReset();mockUser={id:'seeker'};mockLang='ru';mockApplication=null;});

test('load failure has a retry and is never shown as an empty invitation history',async()=>{
 api.mockRejectedValueOnce(Error()).mockResolvedValueOnce({offers:[item()],nextCursor:null});render(<InvitationsPage/>);await screen.findByRole('alert');expect(screen.queryByText('Приглашений пока нет')).not.toBeInTheDocument();fireEvent.click(screen.getByText('Повторить загрузку'));expect(await screen.findByText('Вакансия 1')).toBeInTheDocument();expect(api.mock.calls.every(([url])=>url==='/api/account/offers')).toBe(true);
});
test('failed subsequent pages keep loaded history and retry the same cursor without duplicating cards',async()=>{
 api.mockResolvedValueOnce({offers:[item()],nextCursor:'cursor-one'}).mockRejectedValueOnce(Error()).mockResolvedValueOnce({offers:[item(),item(2)],nextCursor:null});render(<InvitationsPage/>);await screen.findByText('Вакансия 1');fireEvent.click(screen.getByText('Ещё приглашения'));await screen.findByRole('alert');expect(screen.getByText('Вакансия 1')).toBeInTheDocument();fireEvent.click(screen.getByText('Повторить загрузку'));await screen.findByText('Вакансия 2');expect(screen.getAllByText('Вакансия 1')).toHaveLength(1);expect(api.mock.calls.slice(1).map(([url])=>url)).toEqual(['/api/account/offers?before=cursor-one','/api/account/offers?before=cursor-one']);
});
test('read badges clear only after a confirmed receipt; failed receipts can be retried separately',async()=>{
 const ack=deferred();api.mockResolvedValueOnce({offers:[item()],nextCursor:null}).mockResolvedValueOnce({offer:detail()}).mockReturnValueOnce(ack.promise).mockResolvedValueOnce({id:'offer-1',seen_at:DATE});render(<InvitationsPage/>);await screen.findByText('Вакансия 1');fireEvent.click(screen.getByText('Открыть приглашение'));await screen.findByText('Message 1');expect(screen.getByText('Новое')).toBeInTheDocument();await act(async()=>ack.reject(Error()));await screen.findByText('Не удалось отметить приглашение прочитанным.');expect(screen.getByText('Новое')).toBeInTheDocument();fireEvent.click(screen.getByText('Повторить отметку'));await waitFor(()=>expect(screen.queryByText('Новое')).not.toBeInTheDocument());expect(api.mock.calls.slice(2).map(([url])=>url)).toEqual(['/api/account/offers/offer-1/seen','/api/account/offers/offer-1/seen']);
});
test('detail loading errors do not mark reads or expose actions before a successful retry',async()=>{
 api.mockResolvedValueOnce({offers:[item()],nextCursor:null}).mockRejectedValueOnce(Error()).mockResolvedValueOnce({offer:detail(1,{seen_at:DATE})});render(<InvitationsPage/>);await screen.findByText('Вакансия 1');fireEvent.click(screen.getByText('Открыть приглашение'));await screen.findByRole('alert');expect(screen.queryByText('Откликнуться с резюме')).not.toBeInTheDocument();expect(api.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);fireEvent.click(screen.getByText('Повторить загрузку'));await screen.findByText('Message 1');expect(screen.getByText('Откликнуться с резюме')).toBeInTheDocument();expect(api.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);await waitFor(()=>expect(screen.queryByText('Новое')).not.toBeInTheDocument());
});
test('unavailable vacancies retain the invitation message without an apply button or current vacancy link',async()=>{
 const inactive={job_available:false,job:null,resume:null,seen_at:DATE};api.mockResolvedValueOnce({offers:[item(1,inactive)],nextCursor:null}).mockResolvedValueOnce({offer:detail(1,inactive)});render(<InvitationsPage/>);await screen.findByText('Вакансия недоступна');fireEvent.click(screen.getByText('Открыть приглашение'));await screen.findByText('Эта вакансия больше недоступна. Приглашение сохранено в истории.');expect(screen.getByText('Message 1')).toBeInTheDocument();expect(screen.queryByText('Откликнуться с резюме')).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:'Открыть вакансию'})).not.toBeInTheDocument();
});
test('applying opens the existing mandatory-resume form for the confirmed vacancy',async()=>{
 api.mockResolvedValueOnce({offers:[item()],nextCursor:null}).mockResolvedValueOnce({offer:detail(1,{seen_at:DATE})});render(<InvitationsPage/>);await screen.findByText('Вакансия 1');fireEvent.click(screen.getByText('Открыть приглашение'));fireEvent.click(await screen.findByText('Откликнуться с резюме'));expect(await screen.findByRole('dialog',{name:'Application window'})).toBeInTheDocument();expect(mockApplication.job).toEqual({id:'job-1',title:'Вакансия 1',company_name:'Компания 1'});
});
test('late details from a closed selection never replace the current invitation or send its read receipt',async()=>{
 const old=deferred();api.mockResolvedValueOnce({offers:[item(1),item(2)],nextCursor:null}).mockReturnValueOnce(old.promise).mockResolvedValueOnce({offer:detail(2,{seen_at:DATE})});render(<InvitationsPage/>);await screen.findByText('Вакансия 1');fireEvent.click(screen.getAllByText('Открыть приглашение')[0]);await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:'Close'}));fireEvent.click(screen.getAllByText('Открыть приглашение')[1]);await screen.findByText('Message 2');await act(async()=>old.resolve({offer:detail(1,{message:'OLD PRIVATE DETAILS'})}));expect(screen.queryByText('OLD PRIVATE DETAILS')).not.toBeInTheDocument();expect(within(screen.getByRole('dialog')).getByRole('heading',{name:'Вакансия 2'})).toBeInTheDocument();expect(api.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
});
test("account switches discard a pending previous user's history",async()=>{
 const old=deferred();api.mockReturnValueOnce(old.promise).mockResolvedValueOnce({offers:[item(2)],nextCursor:null});const view=render(<InvitationsPage/>);await waitFor(()=>expect(api).toHaveBeenCalledTimes(1));mockUser={id:'other-seeker'};view.rerender(<InvitationsPage/>);await screen.findByText('Вакансия 2');await act(async()=>old.resolve({offers:[item(1)],nextCursor:null}));expect(screen.queryByText('Вакансия 1')).not.toBeInTheDocument();
});
test('guests are asked to sign in before any private invitation request',()=>{
 mockUser=null;render(<InvitationsPage/>);expect(screen.getByText('Войдите, чтобы открыть личный кабинет')).toBeInTheDocument();expect(api).not.toHaveBeenCalled();
});
test('Uzbek invitation history has its own labels and useful empty state',async()=>{
 mockLang='uz';api.mockResolvedValueOnce({offers:[],nextCursor:null});render(<InvitationsPage/>);expect(await screen.findByText('Hozircha takliflar yo‘q')).toBeInTheDocument();expect(screen.getByRole('heading',{name:'Takliflar'})).toBeInTheDocument();expect(screen.getByRole('link',{name:'Rezyumelarim'})).toHaveAttribute('href','/profile/job-seeker/resumes');
});

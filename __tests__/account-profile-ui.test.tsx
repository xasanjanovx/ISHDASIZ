import { act, fireEvent, render, screen } from '@testing-library/react';
import { AccountProfile } from '@/components/profile/account-profile';
import { accountApi, AccountApiError } from '@/lib/account-api';
let currentUser: any, lang: 'ru' | 'uz';
const updateProfile=jest.fn(),logout=jest.fn(),openModal=jest.fn();
jest.mock('@/contexts/user-auth-context',()=>({useUserAuth:()=>({user:currentUser,isLoading:false,updateProfile,logout})}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang})}));
jest.mock('@/contexts/auth-modal-context',()=>({useAuthModal:()=>({openModal})}));
jest.mock('@/components/profile/profile-layout',()=>({ProfileLayout:({children}:any)=><main>{children}</main>}));
jest.mock('@/components/ui/location-select',()=>({LocationSelect:()=> <div>Location</div>}));
jest.mock('@/lib/account-api',()=>({...jest.requireActual('@/lib/account-api'),accountApi:jest.fn()}));
let requests: Array<{url:string;init:any;resolve:(data:any)=>void;reject:(error:any)=>void}>;
const profile=(extra={})=>({id:'profile',full_name:'Candidate',company_name:'Company',phone:'+998905555555',account_phone:'+998901234567',updated_at:'2026-10-07T00:00:00.123456Z',region_id:22,district_id:100,is_verified:false,inn:'123456789',director_name:'Director',...extra});
beforeEach(()=>{jest.clearAllMocks();currentUser={id:'A'};lang='ru';requests=[];(accountApi as jest.Mock).mockImplementation((url,init)=>new Promise((resolve,reject)=>requests.push({url,init,resolve,reject})));logout.mockResolvedValue(undefined);});
const load=async(extra={})=>{await act(async()=>{requests.find(request=>request.url.includes('/profile?'))!.resolve({profile:profile(extra)});});};
test('guests see login rather than fake profile data and do not start private requests',async()=>{
  currentUser=null;await act(async()=>render(<AccountProfile role="job_seeker" settings/>));expect(requests).toHaveLength(0);expect(screen.queryByLabelText('Контактный телефон')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Войти'}));expect(openModal).toHaveBeenCalledTimes(1);
});
test('failed loading is explicit and retry loads the actual profile',async()=>{
  render(<AccountProfile role="job_seeker" settings/>);await act(async()=>requests[0].reject(new AccountApiError(503)));
  expect(screen.getByRole('alert')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Повторить загрузку'}));await act(async()=>requests[1].resolve({profile:profile()}));
  expect(screen.getByLabelText('ФИО')).toHaveValue('Candidate');expect(screen.getByLabelText('Номер для входа')).toHaveValue('+998901234567');expect(screen.getByLabelText('Номер для входа')).toHaveAttribute('readonly');
});
test('a failed save preserves input, locks duplicate submission and retries with the observed version',async()=>{
  render(<AccountProfile role="job_seeker" settings/>);await load();fireEvent.change(screen.getByLabelText('ФИО'),{target:{value:'New name'}});
  const form=screen.getByLabelText('ФИО').closest('form')!;fireEvent.submit(form);fireEvent.submit(form);expect(requests).toHaveLength(2);
  expect(JSON.parse(requests[1].init.body)).toMatchObject({full_name:'New name',expected_updated_at:'2026-10-07T00:00:00.123456Z',region_id:22,district_id:100});
  await act(async()=>requests[1].reject(new AccountApiError(503)));expect(screen.getByLabelText('ФИО')).toHaveValue('New name');expect(updateProfile).not.toHaveBeenCalled();expect(screen.queryByText('Профиль сохранён')).not.toBeInTheDocument();
  fireEvent.submit(form);await act(async()=>requests[2].resolve({profile:profile({full_name:'New name',updated_at:'2026-10-07T01:00:00Z'})}));
  expect(screen.getByText('Профиль сохранён')).toBeInTheDocument();expect(updateProfile).toHaveBeenCalledWith({full_name:'New name'});expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeDisabled();
});
test('company verification is displayed from the server, identity fields are read-only and cancellation sends nothing',async()=>{
  render(<AccountProfile role="employer" settings/>);await load({is_verified:true});expect(screen.getByText('Компания подтверждена')).toBeInTheDocument();
  for(const label of ['Название компании','ИНН','Имя руководителя'])expect(screen.getByLabelText(label)).toHaveAttribute('readonly');
  fireEvent.change(screen.getByLabelText('Контактный телефон'),{target:{value:'90 555 55 55'}});fireEvent.click(screen.getByRole('button',{name:'Отменить изменения'}));expect(screen.getByLabelText('Контактный телефон')).toHaveValue('+998905555555');expect(requests).toHaveLength(1);
});
test('statistics failures leave the form usable and do not appear as zero counts',async()=>{
  render(<AccountProfile role="job_seeker"/>);await load();await act(async()=>requests.find(request=>request.url.includes('/stats?'))!.reject(new AccountApiError(503)));
  expect(screen.getByText('Не удалось загрузить статистику.')).toBeInTheDocument();expect(screen.getAllByText('—')).toHaveLength(3);expect(screen.getByLabelText('ФИО')).toHaveValue('Candidate');
  fireEvent.click(screen.getByRole('button',{name:'Повторить статистику'}));await act(async()=>requests.at(-1)!.resolve({stats:{items:1205,applications:2,views:2410}}));expect(screen.queryByText('Не удалось загрузить статистику.')).not.toBeInTheDocument();
});
test('late saves from an earlier account cannot update the new account context or reveal the old draft',async()=>{
  const view=render(<AccountProfile role="job_seeker" settings/>);await load();fireEvent.change(screen.getByLabelText('ФИО'),{target:{value:'Old private draft'}});fireEvent.submit(screen.getByLabelText('ФИО').closest('form')!);
  currentUser={id:'B'};view.rerender(<AccountProfile role="job_seeker" settings/>);expect(screen.queryByDisplayValue('Old private draft')).not.toBeInTheDocument();
  await act(async()=>requests[1].resolve({profile:profile({full_name:'Old private draft'})}));expect(updateProfile).not.toHaveBeenCalled();await act(async()=>requests[2].resolve({profile:profile({full_name:'New account'})}));expect(screen.getByLabelText('ФИО')).toHaveValue('New account');
});
test('conflicts preserve the draft and reload requires an explicit choice; failed logout is not announced as success',async()=>{
  render(<AccountProfile role="job_seeker" settings/>);await load();fireEvent.change(screen.getByLabelText('ФИО'),{target:{value:'Draft'}});fireEvent.submit(screen.getByLabelText('ФИО').closest('form')!);
  await act(async()=>requests[1].reject(new AccountApiError(409,'Профиль изменился / Profil o‘zgargan')));fireEvent.click(screen.getByRole('button',{name:'Загрузить актуальную версию'}));expect(screen.getByRole('alertdialog')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Оставить форму'}));expect(screen.getByLabelText('ФИО')).toHaveValue('Draft');
  logout.mockRejectedValue(new Error());await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Выйти на этом устройстве'})));expect(screen.getByText('Не удалось завершить сеанс. Попробуйте ещё раз.')).toBeInTheDocument();
});
test('switching language translates fields without reloading or erasing a draft',async()=>{
  const view=render(<AccountProfile role="job_seeker" settings/>);await load();fireEvent.change(screen.getByLabelText('ФИО'),{target:{value:'Draft'}});lang='uz';view.rerender(<AccountProfile role="job_seeker" settings/>);expect(screen.getByLabelText('To‘liq ism')).toHaveValue('Draft');expect(requests).toHaveLength(1);
});

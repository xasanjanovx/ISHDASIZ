import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {VacancyEditorPage} from '@/components/profile/vacancy-editor';
import {accountApi,AccountApiError} from '@/lib/account-api';
let mockUser:any,mockLang='ru';const mockPush=jest.fn(),mockOpen=jest.fn();
jest.mock('next/navigation',()=>({useRouter:()=>({push:mockPush})}));
jest.mock('@/contexts/user-auth-context',()=>({useUserAuth:()=>({user:mockUser,isLoading:false})}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang:mockLang})}));
jest.mock('@/contexts/auth-modal-context',()=>({useAuthModal:()=>({openModal:mockOpen})}));
jest.mock('@/components/profile/profile-layout',()=>({ProfileLayout:({children}:any)=><main>{children}</main>}));
jest.mock('@/lib/account-api',()=>({...jest.requireActual('@/lib/account-api'),accountApi:jest.fn()}));
jest.mock('@/components/profile/vacancy-ai',()=>({VacancyAI:()=>null}));
jest.mock('@/components/ui/location-select',()=>({LocationSelect:({onRegionChange}:any)=><button type="button" onClick={()=>onRegionChange('22')}>Choose region</button>}));
jest.mock('@/components/map/job-map',()=>({JobMap:()=> <div>Map</div>}));
jest.mock('@/lib/supabase',()=>({supabase:{from:(table:string)=>{
 if(table!=='categories')throw new Error('Private browser query');const query:any={select:()=>query,order:()=>query,abortSignal:async()=>({data:[{id:'C',name_ru:'IT'}],error:null})};return query;
}}}));
const api=accountApi as jest.Mock,version='2026-10-07T00:00:00.123456Z';
const employer={company_name:'Company',contact_phone:'+998901234567',region_id:20,district_id:100};
const vacancy={id:'R',title_ru:'Existing vacancy',description_ru:'Description',category_id:'C',latitude:40.123,longitude:69.456,skills:['Excel'],languages:[{language:'Russian',level:'native'}],status:'draft',is_active:false,updated_at:version};
beforeEach(()=>{jest.clearAllMocks();api.mockReset();mockUser={id:'A'};mockLang='ru';api.mockImplementation(async(url:string,init?:any)=>init?.method?{vacancy}:url.endsWith('/prefill')?{employer}:{vacancy});});
test('guests do not fetch private form data and can open login',()=>{
 mockUser=null;render(<VacancyEditorPage/>);expect(api).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Войти'}));expect(mockOpen).toHaveBeenCalledTimes(1);
});
test('a denied edit never renders an editable empty form and retry loads the owned record',async()=>{
 api.mockRejectedValueOnce(new AccountApiError(404));render(<VacancyEditorPage id="R"/>);await screen.findByRole('alert');expect(screen.queryByLabelText('Название — Русский')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Повторить загрузку'}));expect(await screen.findByLabelText('Название — Русский')).toHaveValue('Existing vacancy');
});
test('a partial draft locks duplicate clicks, preserves input on failure and reuses its request identifier on retry',async()=>{
 let reject:(error:any)=>void=()=>{};render(<VacancyEditorPage/>);const title=await screen.findByLabelText('Название — Русский');fireEvent.change(title,{target:{value:'Unfinished draft'}});
 api.mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail;}));const button=screen.getByRole('button',{name:'Сохранить черновик'});fireEvent.click(button);fireEvent.click(button);
 const writes=api.mock.calls.filter(([,init])=>init?.method);expect(writes).toHaveLength(1);const payload=JSON.parse(writes[0][1].body);expect(payload).toMatchObject({title_ru:'Unfinished draft',status:'draft',category_id:''});expect(payload).not.toHaveProperty('employer_id');expect(payload).not.toHaveProperty('user_id');
 await act(async()=>reject(new AccountApiError(503)));await screen.findByRole('alert');expect(title).toHaveValue('Unfinished draft');expect(mockPush).not.toHaveBeenCalled();
 fireEvent.click(button);await waitFor(()=>expect(mockPush).toHaveBeenCalledWith('/profile/employer/vacancies'));expect(JSON.parse(api.mock.calls.at(-1)![1].body).request_id).toBe(payload.request_id);
});
test('edits keep the exact observed version; conflicts retain input until the user confirms reloading',async()=>{
 render(<VacancyEditorPage id="R"/>);const title=await screen.findByLabelText('Название — Русский');fireEvent.change(title,{target:{value:'Unsaved changes'}});api.mockRejectedValueOnce(new AccountApiError(409));fireEvent.submit(title.closest('form')!);
 await screen.findByRole('alert');expect(title).toHaveValue('Unsaved changes');expect(JSON.parse(api.mock.calls.at(-1)![1].body).expected_updated_at).toBe(version);
 fireEvent.click(screen.getByRole('button',{name:'Загрузить актуальную вакансию'}));const dialog=await screen.findByRole('alertdialog');fireEvent.click(within(dialog).getByRole('button',{name:'Оставить форму'}));expect(title).toHaveValue('Unsaved changes');
 fireEvent.click(screen.getByRole('button',{name:'Загрузить актуальную вакансию'}));fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button',{name:'Обновить'}));await waitFor(()=>expect(screen.getByLabelText('Название — Русский')).toHaveValue('Existing vacancy'));
});
test('changing region removes the old map point, decimal coordinates are allowed and language levels are localized',async()=>{
 render(<VacancyEditorPage id="R"/>);await screen.findByLabelText('Широта (необязательно)');expect(screen.getByLabelText('Широта (необязательно)')).toHaveAttribute('step','any');expect(screen.getByRole('option',{name:'Родной язык'})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Choose region'}));expect(screen.getByLabelText('Широта (необязательно)')).toHaveValue(null);expect(screen.getByLabelText('Долгота (необязательно)')).toHaveValue(null);
 fireEvent.change(screen.getByLabelText('Форма оплаты'),{target:{value:'1'}});fireEvent.submit(screen.getByLabelText('Название — Русский').closest('form')!);await screen.findByText('Изменения сохранены. Статус публикации не изменён.');expect(JSON.parse(api.mock.calls.at(-1)![1].body)).toMatchObject({region_id:22,district_id:null,latitude:null,longitude:null,salary_min:null,salary_max:null});
});
test('an account change hides the old form and a late response cannot navigate the next account',async()=>{
 let finish:(value:any)=>void=()=>{};const view=render(<VacancyEditorPage/>);await screen.findByLabelText('Название — Русский');api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));fireEvent.click(screen.getByRole('button',{name:'Сохранить черновик'}));
 api.mockImplementation(()=>new Promise(()=>{}));mockUser={id:'B'};view.rerender(<VacancyEditorPage/>);expect(screen.queryByLabelText('Название — Русский')).not.toBeInTheDocument();await act(async()=>finish({vacancy}));expect(mockPush).not.toHaveBeenCalled();
});
test('Uzbek employers see translated editing controls',async()=>{
 mockLang='uz';render(<VacancyEditorPage/>);await screen.findByLabelText('Kompaniya');expect(screen.getByRole('button',{name:'Qoralamani saqlash'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Vakansiyani e’lon qilish'})).toBeInTheDocument();
});

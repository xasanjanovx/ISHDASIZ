import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {SavedJobsPage} from '@/components/profile/saved-jobs';
import {JobAccountActions} from '@/components/jobs/job-account-actions';
import {accountApi,AccountApiError} from '@/lib/account-api';
let mockLang='ru',mockUser:any={id:'A',active_role:'job_seeker'};const mockLogin=jest.fn();
jest.mock('@/lib/account-api',()=>({...jest.requireActual('@/lib/account-api'),accountApi:jest.fn()}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang:mockLang})}));
jest.mock('@/contexts/user-auth-context',()=>({useUserAuth:()=>({user:mockUser})}));
jest.mock('@/contexts/auth-modal-context',()=>({useAuthModal:()=>({openModal:mockLogin})}));
jest.mock('@/components/profile/account-gate',()=>({AccountGate:({children}:any)=><>{children}</>}));
jest.mock('@/components/profile/profile-layout',()=>({ProfileLayout:({children}:any)=><>{children}</>}));
jest.mock('@/components/jobs/application-modal',()=>({ApplicationModal:({isOpen,onSuccess}:any)=>isOpen?<button onClick={onSuccess}>Подтверждённый отклик с резюме</button>:null}));
const job={id:'J',title_ru:'Оператор',title_uz:'Operator',company_name:'Test company',salary_min:null,salary_max:null};
const item={id:'F',job_id:'J',at:null,job};
beforeEach(()=>{jest.clearAllMocks();mockLang='ru';mockUser={id:'A',active_role:'job_seeker'};});afterEach(cleanup);
test('failed favorites loading is an error with retry, not an empty list',async()=>{
 (accountApi as jest.Mock).mockRejectedValueOnce(new AccountApiError(503)).mockResolvedValueOnce({items:[item],nextCursor:null});render(<SavedJobsPage kind="favorites"/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось');expect(screen.queryByText('Пока нет избранных вакансий')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Повторить загрузку'}));expect(await screen.findByText('Оператор')).toBeInTheDocument();
});
test('failed removal retains the bookmark; pending duplicate clicks do not send another write',async()=>{
 let reject:any;(accountApi as jest.Mock).mockResolvedValueOnce({items:[item],nextCursor:null}).mockImplementationOnce(()=>new Promise((_r,j)=>{reject=j;})).mockResolvedValueOnce({favorite:false});render(<SavedJobsPage kind="favorites"/>);await screen.findByText('Оператор');
 const button=screen.getByRole('button',{name:'Убрать из избранного: Оператор'});fireEvent.click(button);fireEvent.click(button);expect(accountApi).toHaveBeenCalledTimes(2);await act(async()=>reject(new AccountApiError(503)));expect(screen.getByText('Оператор')).toBeInTheDocument();
 fireEvent.click(button);await act(async()=>{});expect(screen.getByText('Пока нет избранных вакансий')).toBeInTheDocument();expect(JSON.parse((accountApi as jest.Mock).mock.calls[2][1].body)).toEqual({job_id:'J',favorite:false});
});
test('unavailable bookmarks reveal no saved title or link and remain removable',async()=>{
 (accountApi as jest.Mock).mockResolvedValue({items:[{...item,job:null}],nextCursor:null});render(<SavedJobsPage kind="favorites"/>);await screen.findByText('Вакансия больше недоступна');expect(screen.queryByText('Test company')).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:'Оператор'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:/Убрать из избранного/})).toBeEnabled();
});
test('clear requires confirmation, failed writes remain in the dialog, and undo is offered after confirmed storage',async()=>{
 (accountApi as jest.Mock).mockResolvedValueOnce({items:[item],nextCursor:null,supportsClear:true}).mockRejectedValueOnce(new AccountApiError(503)).mockResolvedValueOnce({undoId:'batch'}).mockResolvedValueOnce({items:[],nextCursor:null,supportsClear:true,undoId:'batch'}).mockResolvedValueOnce({undoId:null}).mockResolvedValueOnce({items:[item],nextCursor:null,supportsClear:true,undoId:null});
 render(<SavedJobsPage kind="history"/>);await screen.findByText('Оператор');fireEvent.click(screen.getByRole('button',{name:'Скрыть историю'}));expect(accountApi).toHaveBeenCalledTimes(1);expect(screen.getByRole('alertdialog')).toHaveTextContent('Скрытие можно отменить');
 fireEvent.click(screen.getByRole('button',{name:'Скрыть'}));await act(async()=>{});expect(screen.getByRole('alertdialog')).toBeInTheDocument();expect(screen.getByText('Оператор')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Скрыть'}));await screen.findByText('История пока пуста');
 fireEvent.click(screen.getByRole('button',{name:'Отменить скрытие истории'}));expect(await screen.findByText('Оператор')).toBeInTheDocument();expect(JSON.parse((accountApi as jest.Mock).mock.calls[4][1].body)).toEqual({action:'restore',undo_id:'batch'});
});
test('a changed pagination anchor offers refresh instead of retrying the stale cursor',async()=>{
 (accountApi as jest.Mock).mockResolvedValueOnce({items:[item],nextCursor:'old'}).mockRejectedValueOnce(new AccountApiError(409)).mockResolvedValueOnce({items:[item],nextCursor:null});render(<SavedJobsPage kind="favorites"/>);await screen.findByText('Оператор');fireEvent.click(screen.getByRole('button',{name:'Показать ещё'}));fireEvent.click(await screen.findByRole('button',{name:'Обновить список'}));await screen.findByText('Оператор');expect((accountApi as jest.Mock).mock.calls[2][0]).toBe('/api/account/favorites');
});
test('late private state from a previous user cannot mark the next user as applied or favorite',async()=>{
 let resolveA:any;(accountApi as jest.Mock).mockImplementation((url:string)=>url.includes('/jobs/')&&mockUser.id==='A'?new Promise(resolve=>{resolveA=resolve;}):url.includes('/jobs/')?Promise.resolve({favorite:false,applied:false}):Promise.resolve({recorded:true}));
 const view=render(<JobAccountActions job={{id:'J',title:'Оператор',company_name:'Test company'}}/>);mockUser={id:'B',active_role:'job_seeker'};view.rerender(<JobAccountActions job={{id:'J',title:'Оператор',company_name:'Test company'}}/>);await act(async()=>{});await act(async()=>resolveA({favorite:true,applied:true}));
 expect(screen.getByRole('button',{name:'Откликнуться'})).toBeEnabled();expect(screen.getByRole('button',{name:'Добавить в избранное'})).toHaveAttribute('aria-pressed','false');
});
test('favorite write failures retain confirmed state and application success updates the CTA',async()=>{
 (accountApi as jest.Mock).mockImplementation((url:string,init:any)=>url.includes('/jobs/')?Promise.resolve({favorite:false,applied:false}):url.endsWith('/history')?Promise.resolve({recorded:true}):init?.method==='PUT'?Promise.reject(new AccountApiError(503)):Promise.reject(Error('Unexpected')));
 render(<JobAccountActions job={{id:'J',title:'Оператор',company_name:'Test company'}}/>);await act(async()=>{});fireEvent.click(screen.getByRole('button',{name:'Добавить в избранное'}));await act(async()=>{});expect(screen.getByRole('button',{name:'Добавить в избранное'})).toHaveAttribute('aria-pressed','false');expect(screen.getByRole('alert')).toHaveTextContent('Не удалось');
 fireEvent.click(screen.getByRole('button',{name:'Откликнуться'}));fireEvent.click(screen.getByRole('button',{name:'Подтверждённый отклик с резюме'}));expect(screen.getByRole('button',{name:'Заявка отправлена'})).toBeDisabled();
});
test('guests are sent to login, employer accounts have no seeker actions and Uzbek errors are readable',async()=>{
 mockUser=null;const view=render(<JobAccountActions job={{id:'J',title:'Оператор',company_name:'Test company'}}/>);fireEvent.click(screen.getByRole('button',{name:'Откликнуться'}));expect(mockLogin).toHaveBeenCalled();expect(accountApi).not.toHaveBeenCalled();
 mockUser={id:'E',active_role:'employer'};view.rerender(<JobAccountActions job={{id:'J',title:'Оператор',company_name:'Test company'}}/>);expect(screen.queryByRole('button')).not.toBeInTheDocument();expect(accountApi).not.toHaveBeenCalled();view.unmount();
 mockLang='uz';(accountApi as jest.Mock).mockRejectedValue(new AccountApiError(503));render(<SavedJobsPage kind="favorites"/>);expect(await screen.findByRole('alert')).toHaveTextContent('Ma’lumotlarni yuklab');expect(screen.queryByText('Hozircha sevimli vakansiyalar yo‘q')).not.toBeInTheDocument();
});
test('a late favorite response cannot undo the confirmed applied state',async()=>{
 let resolveFavorite:any;(accountApi as jest.Mock).mockImplementation((url:string,init:any)=>url.includes('/jobs/')?Promise.resolve({favorite:false,applied:false}):url.endsWith('/history')?Promise.resolve({recorded:true}):init?.method==='PUT'?new Promise(resolve=>{resolveFavorite=resolve;}):Promise.reject(Error('Unexpected')));
 render(<JobAccountActions job={{id:'J',title:'Оператор',company_name:'Test company'}}/>);await act(async()=>{});fireEvent.click(screen.getByRole('button',{name:'Добавить в избранное'}));fireEvent.click(screen.getByRole('button',{name:'Откликнуться'}));fireEvent.click(screen.getByRole('button',{name:'Подтверждённый отклик с резюме'}));
 await act(async()=>resolveFavorite({favorite:true}));expect(screen.getByRole('button',{name:'Заявка отправлена'})).toBeDisabled();expect(screen.getByRole('button',{name:'Убрать из избранного'})).toHaveAttribute('aria-pressed','true');
});

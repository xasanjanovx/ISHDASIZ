import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Conversation } from '@/components/messages/conversation';
import { accountApi, AccountApiError } from '@/lib/account-api';

const mockOpen=jest.fn();
let currentUser:any={id:'user-1'},currentId='chat-1',lang='ru';
jest.mock('next/navigation',()=>({useParams:()=>({id:currentId})}));
jest.mock('@/contexts/user-auth-context',()=>({useUserAuth:()=>({user:currentUser,isLoading:false})}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang})}));
jest.mock('@/contexts/auth-modal-context',()=>({useAuthModal:()=>({openModal:mockOpen})}));
jest.mock('@/components/profile/profile-layout',()=>({ProfileLayout:({children}:any)=><div>{children}</div>}));
jest.mock('@/lib/supabase',()=>({supabase:{}}));
jest.mock('@/lib/account-api',()=>({accountApi:jest.fn(),accountErrorText:()=> 'Попробуйте ещё раз',AccountApiError:class extends Error {constructor(public status:number){super('error')}}}));
jest.mock('sonner',()=>({toast:{error:jest.fn()}}));
const api=accountApi as jest.Mock;
afterEach(()=>jest.restoreAllMocks());
beforeEach(()=>{
 jest.clearAllMocks();currentUser={id:'user-1'};currentId='chat-1';lang='ru';
 window.requestAnimationFrame=(callback:FrameRequestCallback)=>{callback(0);return 0;};
 HTMLElement.prototype.scrollIntoView=jest.fn();
 api.mockImplementation(async (_url:string,init:any={})=>{
  if(init.method==='PATCH')return{success:true};
  if(init.method==='POST')return{message:{id:'saved-1',content:JSON.parse(init.body).content,sender_id:'user-1',created_at:'2026-10-06T12:00:00Z'}};
  return{messages:[],name:'Company',more:false};
 });
});
it('keeps the draft after a failed send and lets the user retry',async()=>{
 render(<Conversation role="job_seeker" />);
 const input=await screen.findByLabelText('Ваше сообщение');fireEvent.change(input,{target:{value:'My draft'}});
 api.mockImplementationOnce(async()=>{throw new AccountApiError(503);});
 fireEvent.click(screen.getByRole('button',{name:'Отправить'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Отправить'})).toBeEnabled());expect(input).toHaveValue('My draft');expect(jest.requireMock('sonner').toast.error).toHaveBeenCalledWith('Не удалось подтвердить отправку. Черновик сохранён. Попробуйте ещё раз.');
 fireEvent.click(screen.getByRole('button',{name:'Отправить'}));
 await waitFor(()=>expect(input).toHaveValue(''));expect(screen.getByText('My draft')).toBeInTheDocument();
});
it('prevents duplicate submits and shows only the saved server message',async()=>{
 let finish:(value:any)=>void=()=>{};
 render(<Conversation role="job_seeker" />);const input=await screen.findByLabelText('Ваше сообщение');
 api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 fireEvent.change(input,{target:{value:'Hello'}});const button=screen.getByRole('button',{name:'Отправить'});fireEvent.click(button);fireEvent.click(button);
 expect(api.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
 finish({message:{id:'saved-1',content:'Hello',sender_id:'user-1',created_at:'2026-10-06T12:00:00Z'}});
 await waitFor(()=>expect(input).toHaveValue(''));expect(screen.getAllByText('Hello')).toHaveLength(1);
});
it('does not show a send form when the server denies access to the chat',async()=>{
 api.mockRejectedValue(new AccountApiError(404));render(<Conversation role="job_seeker" />);
 await screen.findByRole('alert');expect(screen.queryByLabelText('Ваше сообщение')).not.toBeInTheDocument();
});
it('switching language preserves the unsent draft and previously loaded conversation',async()=>{
 const view=render(<Conversation role="job_seeker"/>);const input=await screen.findByLabelText('Ваше сообщение');fireEvent.change(input,{target:{value:'Keep this draft'}});lang='uz';view.rerender(<Conversation role="job_seeker"/>);await waitFor(()=>expect(screen.getByLabelText('Xabaringiz')).toHaveValue('Keep this draft'));expect(screen.getByText('Company')).toBeInTheDocument();
});
it('changing conversations hides the old participant and draft immediately and ignores a late previous response',async()=>{
 const view=render(<Conversation role="job_seeker"/>);const input=await screen.findByLabelText('Ваше сообщение');fireEvent.change(input,{target:{value:'Private draft'}});let finish:any;api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));fireEvent.click(screen.getByRole('button',{name:'Отправить'}));expect(finish).toBeDefined();
 currentId='chat-2';api.mockImplementation(async(url:string,init:any={})=>init.method==='PATCH'?{success:true}:{messages:[],name:'New company',more:false});view.rerender(<Conversation role="job_seeker"/>);expect(screen.queryByText('Company')).not.toBeInTheDocument();await screen.findByText('New company');expect(screen.getByLabelText('Ваше сообщение')).toHaveValue('');if(finish)await act(async()=>finish({message:{id:'old',content:'Private draft',sender_id:'user-1',created_at:'2026-10-09T00:00:00Z'}}));expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
});
it('signing out removes private messages and a pending previous-account read cannot repopulate them',async()=>{
 let finish:any;api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const view=render(<Conversation role="job_seeker"/>);currentUser=null;view.rerender(<Conversation role="job_seeker"/>);expect(screen.getByText('Войдите, чтобы открыть чат.')).toBeInTheDocument();await act(async()=>finish({messages:[{id:'private',content:'Old account secret',sender_id:'partner',created_at:'2026-10-09T00:00:00Z'}],name:'Old partner',more:false}));expect(screen.queryByText('Old account secret')).not.toBeInTheDocument();expect(screen.queryByText('Old partner')).not.toBeInTheDocument();
});
it('selecting a job adds an offer to the existing draft and sends nothing until explicit submission',async()=>{
 api.mockImplementation(async(url:string,init:any={})=>{
  if(url==='/api/account/chat/offers')return{jobs:[{id:'job-1',title_ru:'Оператор',title_uz:'Operator'}],nextCursor:null};
  if(init.method==='PATCH')return{success:true};if(init.method==='POST')return{message:{id:'sent',content:JSON.parse(init.body).content,sender_id:'user-1',created_at:'2026-10-09T00:00:00Z'}};return{messages:[],name:'Company',more:false};
 });
 render(<Conversation role="employer"/>);const input=await screen.findByLabelText('Ваше сообщение');fireEvent.change(input,{target:{value:'Здравствуйте!'}});fireEvent.click(screen.getByRole('button',{name:'Предложить работу'}));await screen.findByRole('dialog');fireEvent.click(await screen.findByRole('button',{name:'Оператор'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(input).toHaveValue('Здравствуйте!\n\nПредлагаем рассмотреть нашу вакансию: Оператор\nhttp://localhost/jobs/job-1');expect(api.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);fireEvent.click(screen.getByRole('button',{name:'Отправить'}));await waitFor(()=>expect(input).toHaveValue(''));expect(api.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
});
it('a long existing draft is never truncated or sent when an offer would exceed the message limit',async()=>{
 api.mockImplementation(async(url:string,init:any={})=>url==='/api/account/chat/offers'?{jobs:[{id:'job-1',title_ru:'Оператор'}],nextCursor:null}:init.method==='PATCH'?{success:true}:{messages:[],name:'Company',more:false});render(<Conversation role="employer"/>);const input=await screen.findByLabelText('Ваше сообщение');const draft='A'.repeat(3990);fireEvent.change(input,{target:{value:draft}});fireEvent.click(screen.getByRole('button',{name:'Предложить работу'}));fireEvent.click(await screen.findByRole('button',{name:'Оператор'}));expect(input).toHaveValue(draft);expect(screen.getByRole('dialog')).toBeInTheDocument();expect(api.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);
});

it('reuses the message request after an uncertain failure and allocates a new ID for the next message',async()=>{
 render(<Conversation role="job_seeker"/>);const input=await screen.findByLabelText('Ваше сообщение');fireEvent.change(input,{target:{value:'Same message'}});
 api.mockImplementationOnce(async()=>{throw new AccountApiError(503);});fireEvent.click(screen.getByRole('button',{name:'Отправить'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Отправить'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Отправить'}));await waitFor(()=>expect(input).toHaveValue(''));fireEvent.change(input,{target:{value:'Same message'}});fireEvent.click(screen.getByRole('button',{name:'Отправить'}));await waitFor(()=>expect(input).toHaveValue(''));
 const requests=api.mock.calls.filter(([,init])=>init?.method==='POST').map(([,init])=>JSON.parse(init.body));expect(requests).toHaveLength(3);expect(requests[0].request_id).toMatch(/^[0-9a-f-]{36}$/);expect(requests[1].request_id).toBe(requests[0].request_id);expect(requests[2].request_id).not.toBe(requests[1].request_id);
});
it('editing a failed draft produces a new request instead of reusing the old payload identity',async()=>{
 render(<Conversation role="job_seeker"/>);const input=await screen.findByLabelText('Ваше сообщение');fireEvent.change(input,{target:{value:'Before'}});api.mockImplementationOnce(async()=>{throw new AccountApiError(503);});fireEvent.click(screen.getByRole('button',{name:'Отправить'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Отправить'})).toBeEnabled());fireEvent.change(input,{target:{value:'After'}});fireEvent.click(screen.getByRole('button',{name:'Отправить'}));await waitFor(()=>expect(input).toHaveValue(''));const requests=api.mock.calls.filter(([,init])=>init?.method==='POST').map(([,init])=>JSON.parse(init.body));expect(requests[1].request_id).not.toBe(requests[0].request_id);expect(requests[1].content).toBe('After');
});
it('changing language while a send is pending cannot leave the button stuck',async()=>{
 const view=render(<Conversation role="job_seeker"/>);const input=await screen.findByLabelText('Ваше сообщение');fireEvent.change(input,{target:{value:'Pending message'}});let finish:any;api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));fireEvent.click(screen.getByRole('button',{name:'Отправить'}));lang='uz';view.rerender(<Conversation role="job_seeker"/>);await screen.findByLabelText('Xabaringiz');await act(async()=>finish({message:{id:'confirmed',content:'Pending message',sender_id:'user-1',created_at:'2026-10-10T07:00:00Z'}}));expect(screen.getByLabelText('Xabaringiz')).toHaveValue('');expect(screen.getByLabelText('Xabaringiz')).toBeEnabled();expect(screen.getByText('Pending message')).toBeInTheDocument();
});
it('unavailable partner preserves history, hides the send form and does not send',async()=>{
 api.mockImplementation(async(_url:string,init:any={})=>init.method==='PATCH'?{success:true}:{can_send:false,messages:[{id:'old',content:'Saved history',sender_id:'partner',created_at:'2026-10-10T07:00:00Z'}],name:'Company',more:false});render(<Conversation role="job_seeker"/>);await screen.findByText('Saved history');expect(screen.getByText('Собеседник временно недоступен. История переписки сохранена.').compareDocumentPosition(screen.getByRole('log')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(screen.queryByLabelText('Ваше сообщение')).not.toBeInTheDocument();expect(api.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);const receipt=api.mock.calls.find(([,init])=>init?.method==='PATCH');expect(JSON.parse(receipt?.[1].body)).toEqual({action:'read',through:'old',role:'job_seeker'});
});
it('a rejected send preserves its draft and request through partner restore',async()=>{
 let poll:()=>void=()=>{};jest.spyOn(window,'setInterval').mockImplementation(((callback:()=>void,delay:number)=>{if(delay===5000)poll=callback;return 0;}) as any);
 render(<Conversation role="job_seeker"/>);const input=await screen.findByLabelText('Ваше сообщение');fireEvent.change(input,{target:{value:'Retain after restore'}});api.mockImplementationOnce(async()=>{throw new AccountApiError(423);});fireEvent.click(screen.getByRole('button',{name:'Отправить'}));await screen.findByText('Собеседник временно недоступен. История переписки сохранена.');expect(screen.queryByLabelText('Ваше сообщение')).not.toBeInTheDocument();await act(async()=>poll());const restored=await screen.findByLabelText('Ваше сообщение');expect(restored).toHaveValue('Retain after restore');fireEvent.click(screen.getByRole('button',{name:'Отправить'}));await waitFor(()=>expect(restored).toHaveValue(''));const requests=api.mock.calls.filter(([,init])=>init?.method==='POST').map(([,init])=>JSON.parse(init.body));expect(requests[1].request_id).toBe(requests[0].request_id);
});

it('initial load and send scroll only the message viewport without jumping the page',async()=>{
 const frames:FrameRequestCallback[]=[];window.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};render(<Conversation role="job_seeker"/>);const input=await screen.findByLabelText('Ваше сообщение');const log=screen.getByRole('log');Object.defineProperty(log,'scrollHeight',{configurable:true,value:800});await act(async()=>frames.splice(0).forEach(frame=>frame(0)));expect(log.scrollTop).toBe(800);expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
 log.scrollTop=0;fireEvent.change(input,{target:{value:'Keep page position'}});fireEvent.click(screen.getByRole('button',{name:'Отправить'}));await waitFor(()=>expect(input).toHaveValue(''));await act(async()=>frames.splice(0).forEach(frame=>frame(0)));expect(log.scrollTop).toBe(800);expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
});

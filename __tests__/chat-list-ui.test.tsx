import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ChatList} from '@/components/messages/chat-list';
import {accountApi} from '@/lib/account-api';
let lang='ru',user:any={id:'one'},authLoading=false;
jest.mock('next/navigation',()=>({useRouter:()=>({replace:jest.fn()}),useSearchParams:()=>new URLSearchParams()}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang})}));
jest.mock('@/contexts/user-auth-context',()=>({useUserAuth:()=>({user,isLoading:authLoading})}));
jest.mock('@/contexts/auth-modal-context',()=>({useAuthModal:()=>({openModal:jest.fn()})}));
jest.mock('@/components/profile/profile-layout',()=>({ProfileLayout:({children}:any)=><div>{children}</div>}));
jest.mock('@/lib/account-api',()=>({accountApi:jest.fn(),accountErrorText:()=> 'Ошибка загрузки'}));
jest.mock('sonner',()=>({toast:{error:jest.fn(),success:jest.fn()}}));
const api=accountApi as jest.Mock,chat=(id:string)=>({id,name:id,lastMessage:'Message '+id,lastMessageAt:'2026-10-09T00:00:00Z',unread:0});
beforeEach(()=>{jest.clearAllMocks();lang='ru';user={id:'one'};authLoading=false;});
test('a guest gets sign-in instead of an endless spinner or an API read',()=>{
 user=null;render(<ChatList role="employer"/>);expect(screen.getByRole('button',{name:'Войти'})).toBeInTheDocument();expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(api).not.toHaveBeenCalled();
});
test('account changes immediately remove old chat summaries while the new list is loading',async()=>{
 let finish:any;api.mockResolvedValueOnce({conversations:[chat('Old partner')],nextOffset:null}).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const view=render(<ChatList role="employer"/>);await screen.findByText('Old partner');user={id:'two'};view.rerender(<ChatList role="employer"/>);expect(screen.queryByText('Old partner')).not.toBeInTheDocument();expect(screen.getByRole('status')).toBeInTheDocument();await act(async()=>finish({conversations:[chat('New partner')],nextOffset:null}));expect(screen.getByText('New partner')).toBeInTheDocument();
});
test('signing out ignores a previous account’s delayed private list',async()=>{
 let finish:any;api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const view=render(<ChatList role="job_seeker"/>);user=null;view.rerender(<ChatList role="job_seeker"/>);await act(async()=>finish({conversations:[chat('Private partner')],nextOffset:null}));expect(screen.queryByText('Private partner')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Войти'})).toBeInTheDocument();
});
test('switching language retains loaded pages and refreshes all of them',async()=>{
 api.mockImplementation(async(url:string)=>({conversations:[chat(url.includes('offset=25')?'Second page':'First page')],nextOffset:url.includes('offset=25')?null:25}));const view=render(<ChatList role="employer"/>);await screen.findByText('First page');fireEvent.click(screen.getByText('Ещё чаты'));await screen.findByText('Second page');lang='uz';view.rerender(<ChatList role="employer"/>);await waitFor(()=>expect(api.mock.calls.filter(([url])=>url.includes('offset=25'))).toHaveLength(2));expect(screen.getByText('Second page')).toBeInTheDocument();expect(screen.getByText('First page')).toBeInTheDocument();
});
test('failed archive and failed initial reads do not claim a hidden or empty conversation',async()=>{
 api.mockResolvedValueOnce({conversations:[chat('Partner')],nextOffset:null}).mockRejectedValueOnce(new Error());render(<ChatList role="employer"/>);await screen.findByText('Partner');fireEvent.click(screen.getByRole('button',{name:'Скрыть чат с Partner'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Скрыть чат с Partner'})).toBeEnabled());expect(screen.getByText('Partner')).toBeInTheDocument();
});
test('a delayed poll from before archival cannot bring the hidden chat back',async()=>{
 jest.useFakeTimers();try{
  let reads=0,finish:any;api.mockImplementation((_:string,init:any={})=>{if(init.method==='DELETE')return Promise.resolve({success:true});reads++;if(reads===2)return new Promise(resolve=>{finish=resolve;});return Promise.resolve({conversations:reads===1?[chat('Partner')]:[],nextOffset:null});});
  await act(async()=>{render(<ChatList role="employer"/>);});await act(async()=>{jest.advanceTimersByTime(20000);});expect(finish).toBeDefined();await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Скрыть чат с Partner'}));});expect(screen.queryByText('Partner')).not.toBeInTheDocument();await act(async()=>finish({conversations:[chat('Partner')],nextOffset:null}));expect(screen.queryByText('Partner')).not.toBeInTheDocument();
 }finally{jest.useRealTimers();}
});

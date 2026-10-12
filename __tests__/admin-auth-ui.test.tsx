import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {useState} from 'react';
import {AuthProvider,useAuth} from '@/contexts/auth-context';
import {AdminGate,useAdminApi} from '@/components/admin/admin-gate';
import {adminApi} from '@/lib/admin-api';
import {AccountApiError} from '@/lib/account-api';
let mockEvent:(event:string,session:any)=>void=()=>{};
const mockGetSession=jest.fn(),mockSignIn=jest.fn(),mockSignOut=jest.fn(),mockUnsubscribe=jest.fn();
jest.mock('@/lib/supabase',()=>({supabase:{auth:{getSession:(...args:any[])=>mockGetSession(...args),signInWithPassword:(...args:any[])=>mockSignIn(...args),signOut:(...args:any[])=>mockSignOut(...args),onAuthStateChange:(callback:any)=>{mockEvent=callback;return {data:{subscription:{unsubscribe:mockUnsubscribe}}};}},from:()=>{throw new Error('Private browser query');}}}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang:'ru'})}));
jest.mock('@/lib/admin-api',()=>({...jest.requireActual('@/lib/admin-api'),adminApi:jest.fn()}));
const api=adminApi as jest.Mock;
const session=(id='A',token='token-'+id)=>({access_token:token,user:{id,email:id.toLowerCase()+'@example.test'}});
const profile=(id='A',extra:any={})=>({id,role:'super_admin',district_id:null,updated_at:'v1',...extra});
function deferred(){let resolve:(value:any)=>void=()=>{},reject:(error:any)=>void=()=>{};const promise=new Promise<any>((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};}
let latest:any,mounts:number;
function Draft(){const [value,setValue]=useState(()=>{mounts++;return '';});const request=useAdminApi();return <><input aria-label="Draft" value={value} onChange={event=>setValue(event.target.value)}/><button onClick={()=>void request('/api/admin/jobs').catch(()=>{})}>Request</button></>;}
function Harness(){latest=useAuth();return <><output data-testid="identity">{latest.adminProfile?.id||'guest'}</output><output data-testid="error">{latest.error?'error':''}</output><AdminGate><Draft/></AdminGate></>;}
const view=()=>render(<AuthProvider><Harness/></AuthProvider>);
const event=async(next:any)=>act(async()=>mockEvent(next?'SIGNED_IN':'SIGNED_OUT',next));
async function login(id='A'){let result:any;await act(async()=>{result=await latest.signIn(id.toLowerCase()+'@example.test','password');});return result;}
beforeEach(()=>{jest.clearAllMocks();api.mockReset();mounts=0;mockGetSession.mockResolvedValue({data:{session:null},error:null});mockSignIn.mockImplementation(async({email}:any)=>({data:{session:session(email[0].toUpperCase())},error:null}));mockSignOut.mockImplementation(async()=>{mockEvent('SIGNED_OUT',null);return {error:null};});api.mockImplementation(async(token:string)=>({profile:profile(token.includes('B')?'B':'A')}));});
test('a guest never loads private profile data and an authenticated identity is confirmed by the server',async()=>{
 view();await waitFor(()=>expect(latest.loading).toBe(false));expect(api).not.toHaveBeenCalled();await login();expect(screen.getByTestId('identity')).toHaveTextContent('A');expect(api).toHaveBeenCalledWith('token-A','/api/admin/ensure-profile',{method:'POST'});
});
test('a delayed startup session cannot replace a later successful login',async()=>{
 const old=deferred();mockGetSession.mockReturnValueOnce(old.promise);view();await login('B');await act(async()=>old.resolve({data:{session:session('A')},error:null}));expect(screen.getByTestId('identity')).toHaveTextContent('B');expect(api.mock.calls.every(([token])=>token==='token-B')).toBe(true);
});
test('a late profile result cannot reopen the previous identity after an account change',async()=>{
 view();await waitFor(()=>expect(latest.loading).toBe(false));const old=deferred();api.mockReturnValueOnce(old.promise);await event(session('A'));await event(session('B'));expect(screen.getByTestId('identity')).toHaveTextContent('B');await act(async()=>old.resolve({profile:profile('A')}));expect(screen.getByTestId('identity')).toHaveTextContent('B');
});
test('an unrelated server profile or a disabled role never renders admin controls',async()=>{
 view();await waitFor(()=>expect(latest.loading).toBe(false));api.mockResolvedValueOnce({profile:profile('B')});expect((await login()).error).toBeInstanceOf(AccountApiError);expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();expect(mockSignOut).toHaveBeenCalledTimes(1);
 api.mockResolvedValueOnce({profile:profile('A',{disabled_at:'now'})});expect((await login()).error).toBeInstanceOf(AccountApiError);expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
});
test('refreshing a token preserves a draft, but a changed district discards the old scope',async()=>{
 view();await waitFor(()=>expect(latest.loading).toBe(false));await login();fireEvent.change(screen.getByLabelText('Draft'),{target:{value:'Unsaved description'}});
 await event(session('A','renewed-A'));expect(screen.getByLabelText('Draft')).toHaveValue('Unsaved description');expect(mounts).toBe(1);fireEvent.click(screen.getByText('Request'));expect(api).toHaveBeenLastCalledWith('renewed-A','/api/admin/jobs',{});
 api.mockResolvedValueOnce({profile:profile('A',{role:'hokimlik_assistant',district_id:100,updated_at:'v2'})});await event(session('A','renewed-A'));expect(screen.getByLabelText('Draft')).toHaveValue('');expect(mounts).toBe(2);
});
test('a transient permission outage shows retry without erasing a verified draft; a later denial removes access',async()=>{
 view();await waitFor(()=>expect(latest.loading).toBe(false));await login();fireEvent.change(screen.getByLabelText('Draft'),{target:{value:'Preserve'}});
 api.mockRejectedValueOnce(new AccountApiError(503));await event(session());expect(screen.getByLabelText('Draft')).toHaveValue('Preserve');expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось');
 mockGetSession.mockResolvedValueOnce({data:{session:session()},error:null});api.mockRejectedValueOnce(new AccountApiError(503));await act(async()=>latest.refresh());expect(screen.getByLabelText('Draft')).toHaveValue('Preserve');expect(mounts).toBe(1);
 api.mockRejectedValueOnce(new AccountApiError(403));await event(session());expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
});
test('duplicate logins use one credential request and their matching SDK event does not override bootstrap',async()=>{
 view();await waitFor(()=>expect(latest.loading).toBe(false));const pending=deferred();mockSignIn.mockReturnValueOnce(pending.promise);let first:any,duplicate:any;
 await act(async()=>{first=latest.signIn('a@example.test','password');duplicate=await latest.signIn('a@example.test','password');});expect(duplicate.error).toBeInstanceOf(Error);expect(mockSignIn).toHaveBeenCalledTimes(1);
 await event(session());expect(api).not.toHaveBeenCalled();await act(async()=>pending.resolve({data:{session:session()},error:null}));await act(async()=>await first);expect(api).toHaveBeenCalledTimes(1);expect(screen.getByTestId('identity')).toHaveTextContent('A');
});
test('logout waits for a pending SDK login, blocks its event, and never reattaches a late verified profile',async()=>{
 view();await waitFor(()=>expect(latest.loading).toBe(false));const pending=deferred();mockSignIn.mockReturnValueOnce(pending.promise);let entering:any,leaving:any;
 await act(async()=>{entering=latest.signIn('a@example.test','password');leaving=latest.signOut();});expect(mockSignOut).not.toHaveBeenCalled();await event(session());
 await act(async()=>{pending.resolve({data:{session:session()},error:null});await entering;await leaving;});expect(mockSignOut).toHaveBeenCalledTimes(1);expect(api).not.toHaveBeenCalled();expect(screen.getByTestId('identity')).toHaveTextContent('guest');
 await login();const check=deferred();api.mockReturnValueOnce(check.promise);await event(session('A','renewed-A'));await act(async()=>latest.signOut());await act(async()=>check.resolve({profile:profile()}));expect(screen.getByTestId('identity')).toHaveTextContent('guest');
});
test('failed logout reports a failure and keeps the confirmed identity instead of claiming success',async()=>{
 view();await waitFor(()=>expect(latest.loading).toBe(false));await login();mockSignOut.mockResolvedValueOnce({error:new Error('SDK unavailable')});let error:any;await act(async()=>{try{await latest.signOut();}catch(failure){error=failure;}});expect(error).toBeInstanceOf(Error);expect(screen.getByTestId('identity')).toHaveTextContent('A');
});

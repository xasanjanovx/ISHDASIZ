import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {AccountClosure} from '@/components/profile/account-closure';
import {SmsVerification} from '@/components/auth/sms-verification';
import {AccountApiError} from '@/lib/account-api';
const mockClose=jest.fn(),mockLogin=jest.fn(),mockDismiss=jest.fn(),mockStep=jest.fn(),mockPush=jest.fn();let mockLang='ru';
jest.mock('@/contexts/user-auth-context',()=>({useUserAuth:()=>({closeAccount:mockClose,login:mockLogin})}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang:mockLang})}));
jest.mock('@/contexts/auth-modal-context',()=>({useAuthModal:()=>({phoneNumber:'901234567',userRole:'seeker',closeModal:mockDismiss,setStep:mockStep,isNewUser:false,isPasswordReset:false})}));
jest.mock('next/navigation',()=>({useRouter:()=>({push:mockPush})}));
jest.mock('sonner',()=>({toast:{error:jest.fn(),success:jest.fn()}}));
const originalFetch=global.fetch;
beforeEach(()=>{jest.clearAllMocks();mockLang='ru';global.fetch=jest.fn();});
afterEach(()=>{cleanup();global.fetch=originalFetch;});
async function verify() {render(<SmsVerification/>);screen.getAllByRole('textbox').forEach((input,i)=>fireEvent.change(input,{target:{value:String(i+1)}}));fireEvent.click(screen.getByRole('button',{name:'Подтвердить'}));await screen.findByText('Восстановить аккаунт?');}
test('account closure requires confirmation; cancellation and opening the dialog do not call the API',()=>{
 render(<AccountClosure/>);fireEvent.click(screen.getByRole('button',{name:'Закрыть аккаунт'}));expect(screen.getByRole('alertdialog')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Оставить аккаунт открытым'}));expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();expect(mockClose).not.toHaveBeenCalled();
});
test('failed closure remains reviewable and can be retried without duplicate submissions',async()=>{
 let reject:any;mockClose.mockImplementationOnce(()=>new Promise((_r,j)=>{reject=j;})).mockResolvedValueOnce(undefined);
 render(<AccountClosure/>);fireEvent.click(screen.getByRole('button',{name:'Закрыть аккаунт'}));const confirm=screen.getByRole('button',{name:'Подтвердить закрытие'});fireEvent.click(confirm);fireEvent.click(confirm);expect(mockClose).toHaveBeenCalledTimes(1);
 await act(async()=>reject(new AccountApiError(503,'Закрытие пока недоступно / Yopish hozircha mavjud emas')));expect(screen.getByRole('alert')).toHaveTextContent('Закрытие пока недоступно');expect(screen.getByRole('alertdialog')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Подтвердить закрытие'}));await act(async()=>{});expect(mockClose).toHaveBeenCalledTimes(2);
});
test('a verified closed account is not signed in until restoration is explicitly confirmed',async()=>{
 (global.fetch as jest.Mock).mockResolvedValueOnce({ok:true,json:async()=>({success:true,needsRestoration:true})}).mockResolvedValueOnce({ok:true,json:async()=>({success:true,hasPassword:true,user:{id:'A',active_role:'job_seeker'}})});
 await verify();expect(mockLogin).not.toHaveBeenCalled();expect(mockPush).not.toHaveBeenCalled();expect(global.fetch).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Подтвердить восстановление'}));await act(async()=>{});expect(mockLogin).toHaveBeenCalledWith({id:'A',active_role:'job_seeker'});expect(mockPush).toHaveBeenCalledWith('/profile/job-seeker');
 expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('/api/auth/restore-account');expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toEqual({confirm:true,role:'job_seeker'});
});
test('declining restoration preserves closure and never creates a password or signs in',async()=>{
 (global.fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>({success:true,needsRestoration:true})});await verify();fireEvent.click(screen.getByRole('button',{name:'Оставить аккаунт закрытым'}));
 expect(global.fetch).toHaveBeenCalledTimes(1);expect(mockDismiss).toHaveBeenCalled();expect(mockLogin).not.toHaveBeenCalled();expect(mockStep).not.toHaveBeenCalled();
});
test('expired restore proof leaves confirmation on screen with a path to request another code',async()=>{
 (global.fetch as jest.Mock).mockResolvedValueOnce({ok:true,json:async()=>({needsRestoration:true})}).mockResolvedValueOnce({ok:false,json:async()=>({error:'Expired'})});
 await verify();fireEvent.click(screen.getByRole('button',{name:'Подтвердить восстановление'}));await act(async()=>{});expect(mockLogin).not.toHaveBeenCalled();expect(screen.getByText('Восстановить аккаунт?')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Получить новый код'}));expect(screen.getAllByRole('textbox')).toHaveLength(5);expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
});
test('closure confirmation explains restoration in Uzbek as well',()=>{
 mockLang='uz';render(<AccountClosure/>);fireEvent.click(screen.getByRole('button',{name:'Akkauntni yopish'}));expect(screen.getByRole('alertdialog')).toHaveTextContent('oldingi ko‘rinish sozlamalari');
});

import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {CompanyVerificationPage} from '@/components/profile/company-verification';
import {accountApi} from '@/lib/account-api';
let lang='ru',query='',user:any={id:'account-a'};
jest.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams(query)}));
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang})}));
jest.mock('@/contexts/user-auth-context',()=>({useUserAuth:()=>({user,isLoading:false})}));
jest.mock('@/contexts/auth-modal-context',()=>({useAuthModal:()=>({openModal:jest.fn()})}));
jest.mock('@/components/profile/profile-layout',()=>({ProfileLayout:({children}:any)=><div>{children}</div>}));
jest.mock('@/lib/account-api',()=>({accountApi:jest.fn(),accountErrorText:()=> 'Статус временно недоступен'}));
const api=accountApi as jest.Mock;
beforeEach(()=>{jest.clearAllMocks();lang='ru';query='';user={id:'account-a'};});
test('a success callback cannot confirm a company without a saved server result',async()=>{
 query='success=true';api.mockResolvedValue({verified:false,providers:{oneid:false,eri:false}});render(<CompanyVerificationPage/>);await screen.findByText('Компания пока не подтверждена');expect(screen.queryByText('Компания подтверждена')).not.toBeInTheDocument();expect(screen.getAllByRole('button',{name:'Пока недоступно'})).toHaveLength(2);expect(screen.queryByRole('link',{name:'Начать проверку'})).not.toBeInTheDocument();
});
test('configured providers expose ordinary start links; unavailable providers cannot start',async()=>{
 api.mockResolvedValue({verified:false,providers:{oneid:true,eri:false}});render(<CompanyVerificationPage/>);expect(await screen.findByRole('link',{name:'Начать проверку'})).toHaveAttribute('href','/api/auth/oneid');expect(screen.getByRole('button',{name:'Пока недоступно'})).toBeDisabled();expect(screen.queryByText('Скоро будет доступно')).not.toBeInTheDocument();
});
test('read failures remain distinct from an unverified company and support retry',async()=>{
 api.mockRejectedValueOnce(new Error()).mockResolvedValueOnce({verified:true,providers:{oneid:true,eri:true}});render(<CompanyVerificationPage/>);await screen.findByRole('alert');expect(screen.queryByText('Компания пока не подтверждена')).not.toBeInTheDocument();fireEvent.click(screen.getByText('Повторить загрузку'));await screen.findByText('Компания подтверждена');expect(screen.queryByRole('link',{name:'Начать проверку'})).not.toBeInTheDocument();
});
test('switching account aborts its old check and cannot transfer a late confirmation',async()=>{
 let finish:any;api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce({verified:false,providers:{}});const view=render(<CompanyVerificationPage/>);const signal=api.mock.calls[0][1].signal;user={id:'account-b'};view.rerender(<CompanyVerificationPage/>);expect(signal.aborted).toBe(true);await screen.findByText('Компания пока не подтверждена');await act(async()=>finish({verified:true,providers:{}}));expect(screen.queryByText('Компания подтверждена')).not.toBeInTheDocument();
});
test('language changes translate the saved result without restarting verification',async()=>{
 api.mockResolvedValue({verified:true,providers:{}});const view=render(<CompanyVerificationPage/>);await screen.findByText('Компания подтверждена');lang='uz';view.rerender(<CompanyVerificationPage/>);expect(screen.getByText('Kompaniya tasdiqlangan')).toBeInTheDocument();expect(api).toHaveBeenCalledTimes(1);
});
test('a guest sees sign-in instead of a false verification state and cannot call the status API',()=>{
 user=null;render(<CompanyVerificationPage/>);expect(screen.getByRole('button',{name:'Войти'})).toBeInTheDocument();expect(api).not.toHaveBeenCalled();
});

import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {JobOffers} from '@/components/messages/job-offers';
import {accountApi} from '@/lib/account-api';
let lang='ru';
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang})}));
jest.mock('@/lib/account-api',()=>({accountApi:jest.fn(),accountErrorText:()=> 'Загрузка не удалась'}));
const api=accountApi as jest.Mock,job=(id:string)=>({id,title_ru:'Вакансия '+id,title_uz:'Vakansiya '+id});
beforeEach(()=>{jest.clearAllMocks();lang='ru';});
test('failure is distinct from no vacancies, and retry loads only the protected endpoint',async()=>{
 api.mockRejectedValueOnce(new Error()).mockResolvedValueOnce({jobs:[job('one')],nextCursor:null});render(<JobOffers onSelect={jest.fn()}/>);await screen.findByRole('alert');expect(screen.queryByText('Нет доступных опубликованных вакансий.')).not.toBeInTheDocument();fireEvent.click(screen.getByText('Повторить загрузку'));await screen.findByText('Вакансия one');expect(api.mock.calls.every(([url])=>url==='/api/account/chat/offers')).toBe(true);
});
test('pagination preserves prior choices on failure and retries the same cursor',async()=>{
 api.mockResolvedValueOnce({jobs:[job('one')],nextCursor:'one'}).mockRejectedValueOnce(new Error()).mockResolvedValueOnce({jobs:[job('two')],nextCursor:null});const choose=jest.fn().mockResolvedValue(undefined);render(<JobOffers onSelect={choose}/>);await screen.findByText('Вакансия one');fireEvent.click(screen.getByText('Ещё вакансии'));await screen.findByRole('alert');expect(screen.getByText('Вакансия one')).toBeInTheDocument();fireEvent.click(screen.getByText('Повторить загрузку'));await screen.findByText('Вакансия two');expect(screen.getByText('Вакансия one')).toBeInTheDocument();expect(api.mock.calls.slice(1).map(([url])=>url)).toEqual(['/api/account/chat/offers?before=one','/api/account/chat/offers?before=one']);fireEvent.click(screen.getByText('Вакансия two'));expect(choose).toHaveBeenCalledWith(job('two'));
});
test('language changes relabel existing choices without losing them or refetching',async()=>{
 api.mockResolvedValue({jobs:[job('one')],nextCursor:null});const view=render(<JobOffers onSelect={jest.fn()}/>);await screen.findByText('Вакансия one');lang='uz';view.rerender(<JobOffers onSelect={jest.fn()}/>);expect(screen.getByText('Vakansiya one')).toBeInTheDocument();expect(api).toHaveBeenCalledTimes(1);
});
test('closing the dialog aborts its first read and ignores a late response',async()=>{
 let finish:any;api.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const view=render(<JobOffers onSelect={jest.fn()}/>);const signal=api.mock.calls[0][1].signal;view.unmount();expect(signal.aborted).toBe(true);await act(async()=>finish({jobs:[job('late')],nextCursor:null}));expect(screen.queryByText('Вакансия late')).not.toBeInTheDocument();
});

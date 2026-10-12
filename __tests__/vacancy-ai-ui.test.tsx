import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {VacancyAI} from '@/components/profile/vacancy-ai';
import {accountApi,AccountApiError} from '@/lib/account-api';
jest.mock('@/contexts/language-context',()=>({useLanguage:()=>({lang:'ru'})}));
jest.mock('@/lib/account-api',()=>({...jest.requireActual('@/lib/account-api'),accountApi:jest.fn()}));
const api=accountApi as jest.Mock,apply=jest.fn(),result={title_ru:'Оператор',description_ru:'Работа с клиентами',skills:['Excel']};
beforeEach(()=>{jest.clearAllMocks();api.mockReset();api.mockResolvedValue({result});});
async function open(){render(<VacancyAI onApply={apply}/>);fireEvent.click(screen.getByRole('button',{name:'AI: помочь составить вакансию'}));const dialog=await screen.findByRole('dialog');fireEvent.change(within(dialog).getByLabelText('Кого вы ищете и что предлагаете?'),{target:{value:'Ищем оператора с Excel'}});return dialog;}
test('opening and cancelling costs no request; generation must be explicitly applied',async()=>{
 const dialog=await open();expect(api).not.toHaveBeenCalled();fireEvent.click(within(dialog).getByRole('button',{name:'Подготовить черновик'}));const use=await within(dialog).findByRole('button',{name:'Использовать черновик в форме'});expect(apply).not.toHaveBeenCalled();expect(JSON.parse(api.mock.calls[0][1].body)).toMatchObject({action:'full_generate',lang:'ru'});
 fireEvent.click(use);expect(apply).toHaveBeenCalledWith(result);await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
test('quota failures preserve the prompt and a locked double click makes a single request',async()=>{
 const dialog=await open();let reject:(value:any)=>void=()=>{};api.mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail;}));const button=within(dialog).getByRole('button',{name:'Подготовить черновик'});fireEvent.click(button);fireEvent.click(button);expect(api).toHaveBeenCalledTimes(1);
 await act(async()=>reject(new AccountApiError(429,'Лимит: 3 запроса AI в час / Limit')));await within(dialog).findByRole('alert');expect(within(dialog).getByLabelText('Кого вы ищете и что предлагаете?')).toHaveValue('Ищем оператора с Excel');expect(apply).not.toHaveBeenCalled();fireEvent.click(within(dialog).getByRole('button',{name:'Закрыть'}));expect(api).toHaveBeenCalledTimes(1);
});

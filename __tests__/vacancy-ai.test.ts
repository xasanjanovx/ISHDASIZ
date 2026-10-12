/** @jest-environment node */
import {NextRequest} from 'next/server';
import {POST} from '@/app/api/ai/vacancy-helper/route';
import {requireAccount,AccountError} from '@/lib/auth/account';
import {vacancyEmployer} from '@/lib/account-vacancies';
import {callDeepSeekText} from '@/lib/ai/deepseek';
jest.mock('@/lib/auth/account',()=>({...jest.requireActual('@/lib/auth/account'),requireAccount:jest.fn()}));
jest.mock('@/lib/account-vacancies',()=>({vacancyEmployer:jest.fn()}));
jest.mock('@/lib/ai/deepseek',()=>({callDeepSeekText:jest.fn()}));
const rpc=jest.fn(),AI=callDeepSeekText as jest.Mock,account=requireAccount as jest.Mock,employer=vacancyEmployer as jest.Mock;
const request=(body:any,origin?:string)=>new NextRequest('http://localhost/api/ai/vacancy-helper',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
const full=(extra={})=>JSON.stringify({title_uz:'Operator',description_uz:'Ish tavsifi',salary_min:null,salary_max:null,skills:['Excel'],employment_type:'full_time',...extra});
const body={action:'full_generate',prompt:'Need an operator. Excel skills.',lang:'uz'};
beforeEach(()=>{jest.resetAllMocks();process.env.DEEPSEEK_API_KEY='synthetic-key';account.mockResolvedValue({client:{rpc},user:{id:'A',session_version:2}});employer.mockResolvedValue({company_name:'Company'});rpc.mockResolvedValue({data:2,error:null});AI.mockResolvedValue(full());});
test('only an authenticated employer can use AI and forbidden origins are rejected before authentication',async()=>{
 expect((await POST(request(body,'https://foreign.example'))).status).toBe(403);expect(account).not.toHaveBeenCalled();
 account.mockRejectedValueOnce(new AccountError(401,'Sign in'));expect((await POST(request(body))).status).toBe(401);
 employer.mockRejectedValueOnce(new AccountError(403,'Employer required'));expect((await POST(request(body))).status).toBe(403);expect(rpc).not.toHaveBeenCalled();expect(AI).not.toHaveBeenCalled();
});
test.each([{action:'unknown'}, {...body,prompt:''},{...body,prompt:42},{...body,prompt:'a'.repeat(8001)}])('invalid requests never reserve quota or call the provider: %j',async(input)=>{
 expect((await POST(request(input))).status).toBe(400);expect(rpc).not.toHaveBeenCalled();expect(AI).not.toHaveBeenCalled();
});
test('unconfigured provider, missing migration and exhausted quota produce honest errors without a paid call',async()=>{
 delete process.env.DEEPSEEK_API_KEY;expect((await POST(request(body))).status).toBe(503);expect(rpc).not.toHaveBeenCalled();process.env.DEEPSEEK_API_KEY='synthetic-key';
 rpc.mockResolvedValueOnce({error:{code:'42883'}});expect((await POST(request(body))).status).toBe(503);
 rpc.mockResolvedValueOnce({data:-1,error:null});const response=await POST(request(body));expect(response.status).toBe(429);expect((await response.json()).error).toMatch(/3/);expect(AI).not.toHaveBeenCalled();
});
test('full generation reserves the current account epoch, uses requested language and strips private/ownership fields',async()=>{
 AI.mockResolvedValue(full({user_id:'B',company_name:'Invented',contact_phone:'+998999999999',latitude:40,status:'active'}));
 const response=await POST(request({...body,lang:'ru'}));expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');const data=await response.json();
 expect(rpc).toHaveBeenCalledWith('ishdasiz_reserve_vacancy_ai',{p_user_id:'A',p_session_version:2});expect(AI.mock.calls[0][0]).toContain('Russian');expect(data.remaining).toBe(2);expect(data.result).toEqual(JSON.parse(full()));
});
test.each(['not json',full({salary_min:100,salary_max:10}),full({skills:[{}]}),full({employment_type:'malicious'}),full({title_uz:'',description_uz:''})])('invalid provider output is rejected, preserving the consumed attempt: %s',async(output)=>{
 AI.mockResolvedValue(output);expect((await POST(request(body))).status).toBe(503);expect(rpc).toHaveBeenCalledTimes(1);expect(AI).toHaveBeenCalledTimes(1);
});
test('salary failures never fabricate a fallback range, while valid estimates are returned',async()=>{
 AI.mockResolvedValueOnce('{"min":5,"max":1}');expect((await POST(request({action:'suggest_salary',title:'Operator'}))).status).toBe(503);
 AI.mockResolvedValueOnce('{"min":3000000,"max":5000000}');expect((await (await POST(request({action:'suggest_salary',title:'Operator'}))).json()).result).toEqual({min:3000000,max:5000000});
});
test('provider failure is a retryable error and never reports generation success',async()=>{
 AI.mockRejectedValueOnce(new Error('Synthetic provider outage'));const response=await POST(request(body));expect(response.status).toBe(503);expect((await response.json()).success).toBeUndefined();
});

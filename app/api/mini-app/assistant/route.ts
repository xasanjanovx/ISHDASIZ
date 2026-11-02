import {NextRequest} from 'next/server';
import {ZodError} from 'zod';
import {AccountError,accountFailure,accountResult,checkSameOrigin} from '@/lib/auth/account';
import {getAuthClient} from '@/lib/auth/server';
import {miniSuggest} from '@/lib/mini-app/ai';
export const maxDuration=35;
export async function POST(request:NextRequest){try{
 checkSameOrigin(request);const raw=await request.text();if(raw.length>12000)throw new AccountError(413,'Matn juda uzun');
 let body;try{body=JSON.parse(raw);}catch{throw new AccountError(400,'So‘rovni tekshiring');}
 const ip=(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'local').split(',')[0].trim().slice(0,100);
 const result=await miniSuggest(getAuthClient(),`draft:${ip}`,body);return accountResult({result});
}catch(e){return accountFailure(e instanceof ZodError?new AccountError(400,'Lavozim va matn uzunligini tekshiring'):e);}}

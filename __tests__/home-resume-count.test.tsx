/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import Home from '@/app/page';
import { getAuthClient } from '@/lib/auth/server';
const mockAnonTables:string[]=[];
jest.mock('@/components/home/hero-section',()=>({HeroSection:()=>null}));
jest.mock('@/components/home/categories-section',()=>({CategoriesSection:()=>null}));
jest.mock('@/components/home/latest-jobs-section',()=>({LatestJobsSection:()=>null}));
jest.mock('@/components/home/special-categories-section',()=>({SpecialCategoriesSection:()=>null}));
jest.mock('@/components/home/telegram-banner',()=>({TelegramBanner:()=>null}));
jest.mock('@/components/home/home-data-notice',()=>({HomeDataNotice:()=>null}));
jest.mock('@/lib/auth/server',()=>({getAuthClient:jest.fn()}));
jest.mock('@/lib/supabase',()=>({supabase:{rpc:()=>({abortSignal:async()=>({data:{total:5,categories:{},special:{students:0,disabled:0,women:0}},error:null})}),from:(table:string)=>{mockAnonTables.push(table);const q:any={select:()=>q,eq:()=>q,neq:()=>q,order:()=>q,limit:()=>q,or:()=>q,then:(resolve:any)=>Promise.resolve({data:[],error:null,count:5}).then(resolve)};return q;}}}));
let calls:any[],failure:boolean;
beforeEach(()=>{jest.clearAllMocks();mockAnonTables.length=0;calls=[];failure=false;const client=createClient('https://synthetic.invalid','synthetic',{global:{fetch:async(url:any,init:any)=>{calls.push({url:String(url),method:init.method});return new Response(failure?'Unavailable':null,{status:failure?503:200,headers:{'content-range':'0-0/7'}});}}});(getAuthClient as jest.Mock).mockReturnValue(client);});
test('home counts available CVs on the server without fetching private documents',async()=>{const page=await Home();expect(page.props.children[0].props.stats.totalResumes).toBe(7);expect(calls).toEqual([{url:'https://synthetic.invalid/rest/v1/resumes?select=id&ishdasiz_resume_available=eq.true',method:'HEAD'}]);expect(mockAnonTables).not.toContain('resumes');});
test('count failures stay unknown rather than becoming zero',async()=>{failure=true;const page=await Home();expect(page.props.children[0].props.stats.totalResumes).toBeNull();});
test('missing service configuration never falls back to anonymous resume reads',async()=>{(getAuthClient as jest.Mock).mockImplementation(()=>{throw new Error('Unavailable');});const page=await Home();expect(page.props.children[0].props.stats.totalResumes).toBeNull();expect(calls).toHaveLength(0);expect(mockAnonTables).not.toContain('resumes');});

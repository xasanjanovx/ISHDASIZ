/** @jest-environment node */
import {NextRequest} from 'next/server';
import {GET} from '@/app/api/account/verification/route';
import {requireAccount,AccountError} from '@/lib/auth/account';
import {isOneIdConfigured} from '@/lib/oneid';
import {isEriConfigured} from '@/lib/eri';
jest.mock('@/lib/auth/account',()=>({...jest.requireActual('@/lib/auth/account'),requireAccount:jest.fn()}));
jest.mock('@/lib/oneid',()=>({isOneIdConfigured:jest.fn()}));
jest.mock('@/lib/eri',()=>({isEriConfigured:jest.fn()}));
let row:any,error:any,queries:any[];
beforeEach(()=>{
 jest.clearAllMocks();row={is_verified:false};error=null;queries=[];(isOneIdConfigured as jest.Mock).mockReturnValue(true);(isEriConfigured as jest.Mock).mockReturnValue(false);
 (requireAccount as jest.Mock).mockResolvedValue({user:{id:'account-a'},client:{from:(table:string)=>{const q:any={select:(fields:string)=>{queries.push({table,fields});return q;},eq:(key:string,value:string)=>{queries.push({key,value});return q;},maybeSingle:async()=>({data:row,error})};return q;}}});
});
const request=()=>new NextRequest('http://localhost/api/account/verification?userId=account-b');
test('the status uses the verified account and returns configuration booleans without provider credentials',async()=>{
 row={is_verified:true,phone:'private'};const result=await GET(request());expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toBe('no-store');expect(await result.json()).toEqual({verified:true,providers:{oneid:true,eri:false}});expect(queries).toEqual([{table:'employer_profiles',fields:'is_verified'},{key:'user_id',value:'account-a'}]);
});
test('a missing employer or a database outage cannot become an unverified success',async()=>{
 row=null;expect((await GET(request())).status).toBe(403);row={is_verified:false};error={code:'08006',message:'private'};expect((await GET(request())).status).toBe(503);expect(isOneIdConfigured).not.toHaveBeenCalled();
});
test('signed-out or revoked accounts never read profile status or provider configuration',async()=>{
 (requireAccount as jest.Mock).mockRejectedValue(new AccountError(401,'Sign in'));expect((await GET(request())).status).toBe(401);expect(queries).toEqual([]);expect(isOneIdConfigured).not.toHaveBeenCalled();
});

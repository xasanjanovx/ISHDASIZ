import {NextRequest} from 'next/server';
import {accountFailure,accountResult} from '@/lib/auth/account';
import {getAuthClient} from '@/lib/auth/server';
import {jobCatalogQuery,readJobFilters} from '@/lib/job-catalog';
import {getIndexedRemoteJobIds,getRemoteJobIds,hasIndexedCatalog} from '@/lib/job-search-server';
export async function GET(request:NextRequest){try{
 const client=getAuthClient(),filters=readJobFilters(request.nextUrl.searchParams.toString());
 const needs=filters.region!=='all'||filters.district!=='all'||filters.work_mode==='remote'||filters.type==='remote';
 const indexed=needs?await hasIndexedCatalog():false,ids=needs?await(indexed?getIndexedRemoteJobIds():getRemoteJobIds()):undefined;
 const remoteIds=indexed&&ids&&ids.length>150?undefined:ids;
 const period=request.nextUrl.searchParams.get('period');
 const constrain=(q:any)=>period&&['month','shift','hour','service'].includes(period)?q.eq('mini_app_salary_period',period):q;
 const branches=filters.salary[0]>0||filters.salary[1]!==undefined?['min','max'] as const:[undefined];
 const [rows,totals]=await Promise.all([constrain(jobCatalogQuery(client,filters,{remoteIds,count:'none'})).abortSignal(AbortSignal.timeout(15000)),
  Promise.all(branches.map(salaryBranch=>constrain(jobCatalogQuery(client,filters,{remoteIds,count:'only',salaryBranch})).abortSignal(AbortSignal.timeout(15000))))]);
 if(rows.error||totals.some(t=>t.error||!Number.isSafeInteger(t.count)||t.count<0)||!Array.isArray(rows.data))throw Error('Catalog unavailable');
 const records=rows.data as any[];
 const meta=records.length?await client.from('mini_app_records').select('id,metadata').eq('kind','vacancy').in('id',records.map(r=>r.id)):{data:[]};
 const allowed=['salaryPeriod','salaryCurrency','salaryNegotiable','shiftHours','salaryScope','days','hours'];
 const data=records.map(row=>{const m=meta.data?.find(r=>r.id===row.id)?.metadata;return {...row,compensation:m?Object.fromEntries(allowed.filter(k=>k in m).map(k=>[k,m[k]])):null};});
 return accountResult({data,count:totals.reduce((n,t)=>n+t.count,0)});
}catch(e){return accountFailure(e);}}

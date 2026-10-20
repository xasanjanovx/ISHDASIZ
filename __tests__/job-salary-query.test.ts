/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { jobCatalogQuery, readJobFilters, encodeJobFilters } from '@/lib/job-catalog';
const pairs = [ [null,null], [0,0], [2000000,null], [null,2000000], [5000000,null], [null,5000000], [2000000,8000000], [5000000,10000000], [25000000,40000000], [10000000,2000000], [5000000,0] ];
const rows = pairs.map(([salary_min,salary_max],id) => ({ id, salary_min,salary_max,is_active:true,ishdasiz_job_available:true }));
// Evaluate the generated PostgREST comparisons, rather than restating the salary
// implementation, against unknown, one-sided, zero and reversed source offers.
function split(value: string) { let depth=0,start=0; const out:string[]=[]; for(let i=0;i<value.length;i++){ if(value[i]==='(')depth++; if(value[i]===')')depth--; if(value[i]===','&&depth===0){out.push(value.slice(start,i));start=i+1;} } return [...out,value.slice(start)]; }
function matches(input:string,row:any):boolean {
 if(input.startsWith('(')) return split(input.slice(1,-1)).some(part=>matches(part,row));
 const group=/^(and|or)\((.*)\)$/.exec(input);
 if(group){const values=split(group[2]).map(part=>matches(part,row));return group[1]==='and'?values.every(Boolean):values.some(Boolean);}
 const [,key,op,value]=/^(\w+)\.(gte|lte|gt|lt|eq|is)\.(.+)$/.exec(input)!;
 const actual=row[key];if(op==='is')return actual===null;
 if(op==='eq')return String(actual)===value;
 return actual!==null && ({gte:actual>=Number(value),lte:actual<=Number(value),gt:actual>Number(value),lt:actual<Number(value)} as any)[op];
}
const client = createClient('https://synthetic.invalid','synthetic',{global:{fetch:async(input:any)=>{
 const u=new URL(String(input)); const found=rows.filter(row=>[...u.searchParams].every(([key,value])=>['is_active','ishdasiz_job_available','salary_min','salary_max'].includes(key)?matches(key+'.'+value,row):key==='or'?matches(value,row):true));
 return new Response(JSON.stringify(u.searchParams.get('limit')==='0'?[]:found),{headers:{'content-type':'application/json','content-range':`0-0/${found.length}`}});
}}});
test.each([
 ['5000000-', [4,5,6,7,8,9,10]], ['0-5000000',[2,3,4,5,6,7,9,10]],
 ['5000000-10000000',[4,5,6,7,9,10]], ['25000000-40000000',[8]], ['0-0',[]],
])('salary %s returns the expected offers and disjoint counts without duplicates',async(range,expected)=>{
 const f=readJobFilters('salary='+range);
 const [cards,first,second]=await Promise.all([jobCatalogQuery(client,f,{count:'none'}),jobCatalogQuery(client,f,{count:'only',salaryBranch:'min'}),jobCatalogQuery(client,f,{count:'only',salaryBranch:'max'})]);
 expect(cards.data?.map((row:any)=>row.id)).toEqual(expected);expect(first.count!+second.count!).toBe(expected.length);
});
test('salary bounds have no implicit twenty-million ceiling and survive refresh/shared URLs',()=>{
 for(const range of ['5000000-','-5000000','25000000-40000000','0-20000000']) {
  const f=readJobFilters('salary='+range);expect(readJobFilters(encodeJobFilters(f)).salary).toEqual(f.salary);
 }
 expect(readJobFilters('salary=5000000-').salary).toEqual([5000000,undefined]);
 expect(readJobFilters('salary=9007199254740991-').salary).toEqual([0,undefined]);
});

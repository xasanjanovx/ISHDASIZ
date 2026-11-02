import {test} from 'node:test';
import assert from 'node:assert/strict';
import {salaryObservation,salaryAggregate,salaryKey} from '../lib/mini-app/salary';
import {miniMatch,matchingDistance} from '../lib/mini-app/matching';
import {miniFormSchema,miniNative,miniValidate} from '../lib/mini-app/contracts';
test('salary basis is explicit: never confuse month, hour, shift, foreign currency or service',()=>{
 const row={id:'x',title_uz:'Sotuvchi',salary_min:4000000,salary_max:6000000,company_name:'Org',work_mode:'onsite'};
 assert.equal(salaryObservation(row),null);
 assert.equal(salaryObservation({...row,description_uz:'Oylik 4–6 mln so‘m'})?.period,'month');
 assert.equal(salaryObservation({...row,description_uz:'Oylik 4 mln so‘m yoki 500 dollar'}),null);
 assert.equal(salaryObservation({...row,description_uz:'Oylik yoki soatbay to‘lov so‘m'}),null);
 assert.equal(salaryObservation(row,{salaryPeriod:'hour',salaryCurrency:'UZS'})?.period,'hour');
 assert.notEqual(salaryKey(row,null),salaryKey({...row,salary_max:7000000},null));
});
test('market reference uses independent companies and labels recommendation +10%',()=>{
 const rows=[4,4.5,5,5.5,6].map((v,i)=>({company:'Org'+i,min:v*1e6,max:v*1e6}));
 const result=salaryAggregate([...rows,...Array(12).fill(rows[0])]);assert.equal(result?.median,5000000);assert.equal(result?.recommended,5500000);assert.equal(result?.count,5);
 assert.equal(salaryAggregate(rows.slice(0,4)),null);
});
test('profession and work format are hard constraints; uncertainty stays separate; no fake distance',()=>{
 const job={title_uz:'Sotuvchi',work_mode:'onsite',experience:'1_3_years',region_id:1,district_id:2,salary_min:5e6,salary_max:6e6,latitude:41,longitude:69};
 const cv={title:'продавец',experience:'no_experience',region_id:1,district_id:2,expected_salary_min:7e6};
 assert.equal(miniMatch(job,cv,{},{}),null);assert.equal(miniMatch(job,{...cv,title:'Buxgalter'},{},{workMode:'Ish joyida'}),null);
 const partial=miniMatch(job,cv,{salaryPeriod:'month',salaryCurrency:'UZS'},{workMode:'Ish joyida',salaryPeriod:'month',salaryCurrency:'UZS'});
 assert.equal(partial?.exact,false);assert.equal(partial?.distanceKm,null);assert(partial?.issues.includes('Tajriba talabidan kam'));assert(partial?.issues.includes('Kutilgan to‘lov yuqoriroq'));
 assert.equal(matchingDistance(null,[41,69]),null);assert.equal(matchingDistance([41,69],[41,69]),0);
});
test('form adapter preserves compensation units privately and does not fabricate language proficiency',()=>{
 const f=miniFormSchema.parse({position:'Sotuvchi',company:'QA company',region:'Toshkent shahri',district:'Chilonzor',regionId:1,districtId:10,hr:'QA manager',phone:'+998901111111',description:'QA description',employment:'To‘liq kun',workMode:'Masofaviy',days:'5/2',hours:'09:00–18:00',salaryNegotiable:true,languages:'O‘zbek'});
 miniValidate('vacancy',f);const native=miniNative('vacancy',f);assert.equal((native as any).work_mode,'remote');assert.equal((native as any).languages[0].level,'unspecified');assert.equal((native as any).salary_min,null);
 assert.throws(()=>miniValidate('vacancy',{...f,hr:''}),/hr/);
 assert.throws(()=>miniValidate('vacancy',{...f,workMode:'Ish joyida'}),/tasdiqlang/);
});

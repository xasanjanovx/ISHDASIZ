// UI preview only. No environment, credentials, production account writes or AI calls.
// Run after `npm run build` and `npm start -- --port 3100`.
// All /api requests are synthetic or blocked; only GET page/assets are proxied.
const http=require('node:http'),{randomUUID}=require('node:crypto');
const ROOT='http://127.0.0.1:3100',ID='30000000-0000-4000-8000-000000000001';
const employer={company_name:'Демонстрационная компания',contact_phone:'+998000000000',contact_telegram:'',region_id:22,district_id:null,address:''};
const seeker=process.argv.includes('--seeker');let favorite=true,unavailableFavorite=true,applied=false,undoId=null;
const chatPreview=process.argv.includes('--chat-preview'),chatClosed=process.argv.includes('--chat-closed');let chatSendAttempts=0;const chatSaved=new Map();
const catalogResumePreview=process.argv.includes('--catalog-resume-preview'),guestPreview=process.argv.includes('--guest');
const publicCatalog=process.argv.includes('--public-catalog'),aiPreview=process.argv.includes('--ai-preview'),offersPreview=process.argv.includes('--offers-preview'),interviewsPreview=process.argv.includes('--interviews-preview'),attachedResumePreview=process.argv.includes('--attached-resume-preview');let aiCalls=0,interviewAttempts=0,resumeAttempts=0;
let employerDecision={status:'pending',responded_at:null,viewed_at:null,interview_date:null,interview_address:null,employer_message:null};
const portArgument=process.argv.indexOf('--port'),PORT=portArgument<0?3101:Number(process.argv[portArgument+1]),ORIGIN=`http://127.0.0.1:${PORT}`;
if(!Number.isInteger(PORT)||PORT<1024||PORT>65535)throw new Error('Invalid local fixture port');
let savedHistory=[{id:'history-demo',job_id:ID,at:new Date().toISOString()}],hiddenHistory=[];
let rows=[{id:ID,...employer,title_uz:'Mijozlar bilan ishlash operatori',title_ru:'Оператор по работе с клиентами',description_uz:'Mijozlarga maslahat bering va murojaatlar bilan ishlang.',description_ru:'Консультируйте клиентов и обрабатывайте обращения. Обучение и поддержка команды.',requirements_ru:'Уверенное общение, знание Excel.',salary_min:4000000,salary_max:6000000,employment_type:'full_time',work_mode:'onsite',payment_type:3,experience:'no_experience',education_level:'any',gender:'any',skills:['Excel','Общение с клиентами'],languages:[{language:'Русский',level:'B2'}],is_for_students:true,is_for_disabled:false,is_for_women:true,status:'active',is_active:true,views_count:128,applications_count:7,created_at:'2026-10-07T00:00:00.123456Z',updated_at:'2026-10-07T00:00:00.123456Z'}];
const json=(response,status,data)=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-ISHDASIZ-Fixture':'true'});response.end(JSON.stringify(data));};
http.createServer(async(request,response)=>{
 try {
  const url=new URL(request.url,ORIGIN),path=url.pathname;
  if(path.startsWith('/synthetic-supabase/')){
   if(!publicCatalog||request.method!=='GET')return json(response,403,{error:'Synthetic public reads only'});
   const table=path.split('/').at(-1),category='10000000-0000-4000-8000-000000000001';
   const regions=[{id:22,name_ru:'Ташкент',name_uz:'Toshkent shahri'},{id:12,name_ru:'Андижанская область',name_uz:'Andijon viloyati'},{id:9,name_ru:'Бухарская область',name_uz:'Buxoro viloyati'}];
   if(table==='regions')return json(response,200,regions);
   if(table==='categories')return json(response,200,[{id:category,name_ru:'Обслуживание клиентов',name_uz:'Mijozlarga xizmat',icon:'Briefcase'}]);
   if(table==='districts')return json(response,200,[{id:100,region_id:22,name_ru:'Юнусабадский район',name_uz:'Yunusobod tumani'}].filter(row=>!url.searchParams.has('region_id')||url.searchParams.get('region_id')==='eq.'+row.region_id));
   if(table!=='jobs')return json(response,403,{error:'Synthetic table unavailable'});
   let jobs=Array.from({length:27},(_,index)=>({...rows[0],id:'30000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),category_id:category,region_id:22,district_id:100,regions:regions[0],districts:{name_ru:'Юнусабадский район',name_uz:'Yunusobod tumani'},categories:{id:category,name_ru:'Обслуживание клиентов',name_uz:'Mijozlarga xizmat',icon:'Briefcase'}}));
   for(const key of ['category_id','region_id','district_id','employment_type','work_mode','payment_type','is_for_disabled','is_for_graduates'])if(url.searchParams.has(key))jobs=jobs.filter(row=>url.searchParams.get(key)==='eq.'+String(row[key]));
   const needle=/title_ru\.ilike\.%([^%]+)%/.exec(url.searchParams.get('or')||'')?.[1];
   if(needle)jobs=jobs.filter(row=>[row.title_ru,row.title_uz,row.description_ru,row.description_uz,row.company_name].some(text=>String(text).toLowerCase().includes(needle.toLowerCase())));
   const count=jobs.length,offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||12);
   jobs=jobs.slice(offset,offset+limit);response.setHeader('Content-Range',jobs.length?`${offset}-${offset+jobs.length-1}/${count}`:`*/${count}`);return json(response,200,jobs);
  }
  if(path.startsWith('/api/')){
   if(aiPreview&&path==='/api/chat'&&request.method==='POST'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
    if(++aiCalls===1)return json(response,503,{error:'Synthetic first-request failure for retry verification'});
    const ru=body.lang==='ru';return json(response,200,{response:ru?'Подобраны вакансии по вашему запросу. Можно уточнить график или желаемую зарплату.':'So‘rovingizga mos vakansiyalar topildi. Ish jadvali yoki kerakli maoshni aniqlashtirishingiz mumkin.',profile:{category:'Обслуживание клиентов',region_id:22},jobs:[{id:ID,title:ru?'Оператор по работе с клиентами':'Mijozlar bilan ishlash operatori',company:ru?'Демонстрационная компания':'Namuna kompaniya',salary:ru?'4–6 млн сум':'4–6 mln so‘m',location:ru?'Ташкент, Юнусабадский район':'Toshkent, Yunusobod tumani',reason_fit:ru?'Работа с клиентами и знание Excel соответствуют вашему запросу.':'Mijozlar bilan ishlash va Excel ko‘nikmalari so‘rovingizga mos.'}]});
   }
   if(guestPreview&&path==='/api/auth/session'&&request.method==='GET')return json(response,200,{user:null});
   if(path==='/api/auth/session'&&request.method==='GET')return json(response,200,{user:{id:seeker?'fixture-seeker':'fixture-employer',full_name:'Демонстрационный соискатель',phone:'+998000000000',active_role:seeker?'job_seeker':'employer',has_employer_profile:!seeker,has_job_seeker_profile:seeker,company_name:employer.company_name,is_verified:false},expiresAt:Date.now()+3600000});
   const card=()=>({...rows[0],regions:{name_ru:'Ташкент',name_uz:'Toshkent shahri'}});
   if(offersPreview&&path.startsWith('/api/account/offers')){
    const offerId='40000000-0000-4000-8000-000000000001',oldId='40000000-0000-4000-8000-000000000002';
    const item={id:offerId,created_at:'2026-10-10T04:00:00Z',seen_at:null,status:'sent',job_available:true,job:{...card(),regions:{name_ru:'Ташкент',name_uz:'Toshkent shahri'}}};
    const unavailable={...item,id:oldId,created_at:'2026-10-01T04:00:00Z',seen_at:'2026-10-02T04:00:00Z',job_available:false,job:null};
    if(path==='/api/account/offers'&&request.method==='GET')return json(response,200,{offers:[item,unavailable],nextCursor:null});
    if(path==='/api/account/offers/'+offerId&&request.method==='GET')return json(response,200,{offer:{...item,message:'Здравствуйте! Ваш опыт работы с клиентами подходит нашей команде. Будем рады обсудить условия на собеседовании.',resume:{id:'10000000-0000-4000-8000-000000000001',title:'Специалист по работе с клиентами'}}});
    if(path==='/api/account/offers/'+oldId&&request.method==='GET')return json(response,200,{offer:{...unavailable,message:'Спасибо за интерес к нашей компании. Эта вакансия уже закрыта.',resume:null}});
    if([offerId,oldId].some(id=>path==='/api/account/offers/'+id+'/seen')&&request.method==='POST')return json(response,200,{id:path.split('/').at(-2),seen_at:'2026-10-10T05:00:00Z'});
    return json(response,403,{error:'Synthetic invitation request unavailable'});
   }
   if(path==='/api/account/verification')return json(response,200,{verified:false,providers:{oneid:false,eri:false}});
   if(path==='/api/account/vacancies/stats'&&request.method==='GET')return json(response,200,{stats:{items:rows.length,active:rows.filter(row=>row.status==='active').length,views:rows.reduce((sum,row)=>sum+row.views_count,0),applications:rows.reduce((sum,row)=>sum+row.applications_count,0)},jobs:rows.map(row=>({id:row.id,title_ru:row.title_ru,title_uz:row.title_uz,created_at:row.created_at,available:row.status==='active',views:row.views_count,applications:row.applications_count})),nextCursor:null});
   if(path==='/api/account/notifications')return json(response,200,{messages:1,applications:1});
   if(path==='/api/account/chat/offers')return json(response,200,{jobs:rows.filter(row=>row.status==='active').map(row=>({id:row.id,title_ru:row.title_ru,title_uz:row.title_uz})),nextCursor:null});
   if(catalogResumePreview&&path==='/api/account/chat'&&request.method==='POST'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
    if(body.role!=='employer'||body.userId!=='fixture-seeker')return json(response,403,{error:'Synthetic partner unavailable'});
    return json(response,201,{id:'10000000-0000-4000-8000-000000000010'});
   }
   if(path==='/api/account/chat'&&request.method==='GET')return json(response,200,{conversations:[{id:'10000000-0000-4000-8000-000000000010',name:'Демонстрационный кандидат',lastMessage:'Здравствуйте! Готов обсудить условия работы.',lastMessageAt:'2026-10-09T07:00:00Z',unread:1}],nextOffset:null});
   if(path==='/api/account/chat/10000000-0000-4000-8000-000000000010'){
    const history=[{id:'10000000-0000-4000-8000-000000000011',sender_id:'fixture-seeker',content:'Здравствуйте! Готов обсудить условия работы.',created_at:'2026-10-09T07:00:00Z'},...chatSaved.values()];
    if(request.method==='GET'){const after=url.searchParams.get('after'),anchor=history.findIndex(row=>row.id===after);return json(response,200,{name:'Демонстрационный кандидат',can_send:!chatClosed,messages:after?history.slice(anchor+1):history,more:false});}
    if(request.method==='PATCH')return json(response,200,{success:true});
    if(chatPreview&&request.method==='POST'){
     const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
     if(chatClosed)return json(response,423,{error:'Synthetic closed partner'});
     if(body.role!=='employer'||typeof body.content!=='string'||!body.content.trim()||body.content.length>4000||!/^[-a-f0-9]{36}$/i.test(body.request_id||''))return json(response,400,{error:'Synthetic invalid message'});
     const old=chatSaved.get(body.request_id);if(old&&old.content!==body.content.trim())return json(response,409,{error:'Synthetic changed message request'});
     if(!old)chatSaved.set(body.request_id,{id:body.request_id,sender_id:'fixture-employer',content:body.content.trim(),created_at:new Date().toISOString()});
     if(++chatSendAttempts===1)return json(response,503,{error:'Synthetic saved response lost'});
     return json(response,201,{message:chatSaved.get(body.request_id)});
    }
    return json(response,403,{error:'Real message delivery disabled in fixture'});
   }
   if(catalogResumePreview&&path==='/api/resumes/10000000-0000-4000-8000-000000000012'&&request.method==='GET'){
    if(guestPreview)return json(response,401,{error:'Synthetic sign-in required'});
    if(++resumeAttempts===1)return json(response,503,{error:'Synthetic retry check'});
    return json(response,200,{resume:{user_id:'fixture-seeker',telegram:'synthetic_handle',created_at:'2026-10-10T04:00:00Z',id:'10000000-0000-4000-8000-000000000012',title:'Специалист по работе с клиентами',full_name:'Демонстрационный кандидат',birth_date:'2000-04-15',phone:'+998000000000',city:'Toshkent',about:'Консультирую клиентов и помогаю решать вопросы. Веду отчёты в Excel, работаю с входящими обращениями.',skills:['Excel','Обслуживание клиентов','Работа с обращениями'],experience:'3_years',experience_years:3,experience_details:[{company:'Демонстрационная компания',position:'Оператор по работе с клиентами',start_date:'2023-01',end_date:null,is_current:true,description:'Обрабатываю обращения, консультирую клиентов и готовлю ежедневные отчёты.'}],education_level:'higher',education:[{institution:'Демонстрационный университет',degree:'Бакалавр',field:'Менеджмент',start_year:'2019',end_year:'2023'}],languages:[{name:'uzbek',level:'native'},{name:'russian',level:'advanced'}],employment_type:'full_time',gender:'any',expected_salary_min:4000000,expected_salary_max:6000000,regions:{name_ru:'Самаркандская область',name_uz:'Samarqand viloyati'},districts:null}});
   }
   if(path==='/api/resumes'&&request.method==='GET')return json(response,200,{resumes:[{id:'10000000-0000-4000-8000-000000000012',title:'Специалист по работе с клиентами',full_name:'Демонстрационный кандидат',regions:{name_ru:'Андижанская область',name_uz:'Andijon viloyati'},skills:['Excel','Обслуживание клиентов'],expected_salary_min:4000000,expected_salary_max:6000000,experience:'no_experience',status:'active'}],nextCursor:null});
   const employerApplication=()=>({id:'10000000-0000-4000-8000-000000000013',job_id:ID,full_name:'Демонстрационный кандидат',phone:'+998000000000',created_at:'2026-10-09T07:00:00Z',...employerDecision,jobs:card(),resumes:attachedResumePreview?{id:'10000000-0000-4000-8000-000000000012',title:'Специалист по работе с клиентами',about:'Опыт консультаций и работы с обращениями.',skills:['Excel','Обслуживание клиентов'],experience:[]}:null});
   if(!seeker&&path==='/api/account/applications'&&request.method==='GET')return json(response,200,{applications:[employerApplication()],nextCursor:null,stats:{total:1,pending:employerDecision.status==='pending'?1:0,reviewed:employerDecision.status==='reviewed'?1:0,interview_set:employerDecision.status==='interview_set'?1:0,accepted:0,rejected:0,hired:0}});
   if(attachedResumePreview&&path==='/api/account/applications/10000000-0000-4000-8000-000000000013/resume'&&request.method==='GET'){
    if(++resumeAttempts===1)return json(response,503,{error:'Synthetic CV failure for retry verification'});
    return json(response,200,{resume:{id:'10000000-0000-4000-8000-000000000012',title:'Специалист по работе с клиентами',full_name:'Демонстрационный кандидат',birth_date:'2000-04-15',phone:'+998000000000',city:'Toshkent',about:'Консультирую клиентов и помогаю решать вопросы. Веду отчёты в Excel, работаю с входящими обращениями.',skills:['Excel','Обслуживание клиентов','Работа с обращениями'],experience:'3_years',experience_years:3,experience_details:[{company:'Демонстрационная компания',position:'Оператор по работе с клиентами',start_date:'2023-01',end_date:null,is_current:true,description:'Обрабатываю обращения, консультирую клиентов и готовлю ежедневные отчёты.'}],education_level:'higher',education:[{institution:'Демонстрационный университет',degree:'Бакалавр',field:'Менеджмент',start_year:'2019',end_year:'2023'}],languages:[{name:'uzbek',level:'native'},{name:'russian',level:'advanced'}],employment_type:'full_time',gender:'any',expected_salary_min:4000000,expected_salary_max:6000000,regions:{name_ru:'Ташкент',name_uz:'Toshkent'},districts:{name_ru:'Юнусабадский район',name_uz:'Yunusobod tumani'}}});
   }
   if(interviewsPreview&&path==='/api/account/applications/10000000-0000-4000-8000-000000000013'&&request.method==='PATCH'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
    if(body.action==='view'){employerDecision.viewed_at||='2026-10-10T05:00:00Z';if(employerDecision.status==='pending')employerDecision.status='reviewed';return json(response,200,{application:employerApplication()});}
    if(body.action!=='status')return json(response,400,{error:'Synthetic invalid action'});
    if(++interviewAttempts===1)return json(response,503,{error:'Synthetic failure for draft retry verification'});
    if(body.expected?.status!==employerDecision.status||body.expected?.responded_at!==employerDecision.responded_at)return json(response,409,{error:'Synthetic stale decision'});
    if(body.status==='interview_set'&&!body.details?.interview_date)return json(response,400,{error:'Synthetic interview requires date'});
    Object.assign(employerDecision,{status:body.status,responded_at:'2026-10-10T05:01:00Z',...body.details});return json(response,200,{application:employerApplication()});
   }
   if(path===`/api/jobs/${ID}`&&request.method==='GET')return json(response,200,{job:{...card(),raw_source_json:{skills_details:rows[0].skills.map(name=>({name})),languages:rows[0].languages.map(item=>({name:item.language,level:item.level}))},sections:{}},similar:[],similarError:false});
   if(path===`/api/jobs/${ID}/view`&&request.method==='POST')return json(response,200,{counted:true});
   if(seeker&&path===`/api/account/jobs/${ID}`&&request.method==='GET')return json(response,200,{favorite,applied});
   if(seeker&&path==='/api/account/applications/resumes'&&request.method==='GET')return json(response,200,{resumes:[{id:'10000000-0000-4000-8000-000000000001',title:'Демонстрационное резюме'}]});
   if(seeker&&path==='/api/account/favorites'&&request.method==='GET')return json(response,200,{items:[...(favorite?[{id:'favorite-demo',job_id:ID,at:rows[0].created_at,job:card()}]:[]),...(unavailableFavorite?[{id:'favorite-unavailable',job_id:'30000000-0000-4000-8000-000000000002',at:null,job:null}]:[])],nextCursor:null});
   if(seeker&&path==='/api/account/history'&&request.method==='GET')return json(response,200,{items:savedHistory.map(row=>({...row,job:card()})),nextCursor:null,supportsClear:true,undoId});
   if(seeker&&['/api/account/favorites','/api/account/history','/api/account/applications'].includes(path)&&request.method!=='GET'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
    if(path.endsWith('/favorites')&&request.method==='PUT'){if(body.job_id===ID)favorite=body.favorite;else unavailableFavorite=body.favorite;return json(response,200,{favorite:body.favorite});}
    if(path.endsWith('/applications')&&request.method==='POST'){if(!body.resume_id)return json(response,400,{error:'Резюме обязательно'});applied=true;return json(response,201,{application:{id:randomUUID(),status:'pending'}});}
    if(path.endsWith('/history')&&request.method==='POST'){savedHistory=[{id:'history-demo',job_id:ID,at:new Date().toISOString()},...savedHistory.filter(row=>row.job_id!==ID)];return json(response,200,{recorded:true});}
    if(path.endsWith('/history')&&request.method==='PATCH'){
     if(body.action==='clear'){undoId=randomUUID();hiddenHistory=savedHistory;savedHistory=[];}
     else if(body.action==='restore'&&body.undo_id===undoId){savedHistory=[...savedHistory,...hiddenHistory.filter(row=>!savedHistory.some(newRow=>newRow.job_id===row.job_id))];hiddenHistory=[];undoId=null;}
     else return json(response,409,{error:'История изменилась'});return json(response,200,{undoId});
    }
   }
   if(path==='/api/account/notifications'&&request.method==='GET')return json(response,200,{applications:7,messages:0});
   if(path==='/api/account/vacancies/prefill'&&request.method==='GET')return json(response,200,{employer});
   if(path==='/api/account/vacancies'&&request.method==='GET'){
    const state=url.searchParams.get('state')||'all',stats={all:rows.length,active:0,draft:0,filled:0,archived:0};for(const row of rows)stats[row.status]++;
    return json(response,200,{vacancies:rows.filter(row=>state==='all'||row.status===state),stats,nextCursor:null});
   }
   if(path.startsWith('/api/account/vacancies')){
    let body={};if(request.method!=='GET'){const chunks=[];for await(const chunk of request)chunks.push(chunk);body=JSON.parse(Buffer.concat(chunks).toString());}
    if(path==='/api/account/vacancies'&&request.method==='POST'){
     const row={...body,id:body.request_id||randomUUID(),company_name:employer.company_name,title_ru:body.title_ru||body.title_uz,title_uz:body.title_uz||body.title_ru,updated_at:new Date().toISOString(),is_active:body.status==='active',views_count:0,applications_count:0};rows.push(row);return json(response,201,{vacancy:row});
    }
    const row=rows.find(row=>row.id===path.split('/').at(-1));if(!row)return json(response,404,{error:'Демонстрационная вакансия не найдена / Namuna topilmadi'});
    if(request.method==='GET')return json(response,200,{vacancy:row});
    if(request.method==='PUT'){const status=row.status,is_active=row.is_active;Object.assign(row,body,{status,is_active});}
    else if(request.method==='PATCH'){row.status=({publish:'active',hide:'draft',filled:'filled',archive:'archived',restore:'draft'})[body.action]||row.status;row.is_active=row.status==='active';}
    else return json(response,405,{error:'Fixture method blocked'});
    row.updated_at=new Date().toISOString();return json(response,200,{vacancy:row});
   }
   return json(response,403,{error:'В демонстрации этот API отключён / Namuna rejimida API o‘chirilgan'});
  }
  if(request.method!=='GET')return json(response,403,{error:'Fixture only forwards GET pages and assets'});
  const forwarded={...request.headers,host:'127.0.0.1:3100','accept-encoding':'identity'};delete forwarded.cookie;delete forwarded.authorization;
  const upstream=http.request(ROOT+request.url,{method:'GET',headers:forwarded},incoming=>{
   const headers={...incoming.headers};delete headers['set-cookie'];if(headers.location)headers.location=headers.location.replace(ROOT,ORIGIN).replace('http://localhost:3100',ORIGIN);
   if(publicCatalog&&/javascript/.test(headers['content-type']||'')){
    if(headers['content-encoding']){incoming.resume();return json(response,502,{error:'Encoded fixture asset blocked'});}
    const chunks=[];incoming.on('data',chunk=>chunks.push(chunk));incoming.on('end',()=>{
     const source=Buffer.concat(chunks).toString('utf8').replace(/https:\/\/[a-z0-9-]+\.supabase\.co/gi,ORIGIN+'/synthetic-supabase');
     delete headers['content-length'];delete headers.etag;headers['cache-control']='no-store';response.writeHead(incoming.statusCode,headers);response.end(source);
    });incoming.on('error',()=>{if(!response.headersSent)json(response,502,{error:'Fixture asset unavailable'});else response.end();});return;
   }
   response.writeHead(incoming.statusCode,headers);incoming.pipe(response);
  });upstream.on('error',()=>json(response,503,{error:'Start the local site on port 3100'}));upstream.end();
 }catch{if(!response.headersSent)json(response,400,{error:'Invalid fixture request'});else response.end();}
}).listen(PORT,'127.0.0.1',()=>console.log('Synthetic UI preview ready: '+ORIGIN+'/profile/'+(seeker?'job-seeker/favorites':'employer/vacancies')));

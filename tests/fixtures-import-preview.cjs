// Synthetic visual preview only. No credentials, source requests or DB writes.
// Start the compiled site on 3100, then this file; open 3102/fixture-admin.
// Every API is intercepted. Only GET pages/assets are forwarded without cookies.
const http=require('node:http');
const ID='10000000-0000-4000-8000-000000000001',ROOT='http://127.0.0.1:3100';
const exp=Math.floor(Date.now()/1000)+86400;
const encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=encoded({alg:'none',typ:'JWT'})+'.'+encoded({sub:ID,exp,role:'authenticated',aud:'authenticated'})+'.fixture-only';
const user={id:ID,email:'demo@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const session={access_token:token,refresh_token:'fixture-only',expires_in:86400,expires_at:exp,token_type:'bearer',user};
let progress={id:ID,state:'running',phase:'details',started_at:new Date().toISOString(),completed_at:null,total:1205,listed:1205,processed:50,failed:0,verified:0,new_imported:40,updated:10,skipped_closed:0,next_page:14,verify_page:1,last_error:null,next_retry_at:null,busy:false};
const json=(response,status,value)=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-ISHDASIZ-Fixture':'true'});response.end(JSON.stringify(value));};
http.createServer(async(request,response)=>{try{
 const path=new URL(request.url,'http://127.0.0.1:3102').pathname;
 if(path==='/fixture-admin'&&request.method==='GET'){
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  return response.end('<!doctype html><html lang="ru"><title>Демонстрация импорта</title><body><p>Демонстрация: все данные вымышленные.</p><a href="/admin/import">Открыть импорт</a><script>localStorage.setItem("sb-awkjrolplhvrscuqqive-auth-token",'+JSON.stringify(JSON.stringify(session))+');localStorage.setItem("ishdasiz-language","ru");</script></body></html>');
 }
 if(path.startsWith('/api/')){
  if(path==='/api/stats')return json(response,200,{stats:{availableJobs:1205,regionCount:3,applications:264,views:18432,asOf:'2026-10-09T07:40:00Z',byRegion:[{id:22,name_ru:'Город Ташкент',name_uz:'Toshkent shahri',count:560},{id:12,name_ru:'Андижанская область',name_uz:'Andijon viloyati',count:405},{id:9,name_ru:'Бухарская область',name_uz:'Buxoro viloyati',count:240}],byCategory:[{id:'20000000-0000-4000-8000-000000000001',name_ru:'Продажи и обслуживание',name_uz:'Savdo va xizmat ko‘rsatish',count:650},{id:'20000000-0000-4000-8000-000000000002',name_ru:'Информационные технологии',name_uz:'Axborot texnologiyalari',count:355},{id:null,name_ru:null,name_uz:null,count:200}],byDistrict:[{id:100,name_ru:'Юнусабадский район',name_uz:'Yunusobod tumani',region_ru:'Город Ташкент',region_uz:'Toshkent shahri',count:560},{id:null,name_ru:null,name_uz:null,region_ru:null,region_uz:null,count:645}],byEmployment:[{type:'full_time',count:1000},{type:'part_time',count:150},{type:null,count:55}]}});
  if(path==='/api/auth/session')return json(response,200,{user:null});
  if(!request.headers.authorization?.endsWith('.fixture-only'))return json(response,401,{error:'Synthetic token required'});
  if(path==='/api/admin/session'&&request.method==='GET')return json(response,200,{profile:{id:ID,full_name:'Демонстрационный администратор',role:'super_admin',district_id:null,disabled_at:null,created_at:new Date().toISOString()}});
  if(path==='/api/admin/import'){
   if(request.method==='GET')return json(response,200,{progress});
   if(request.method==='POST'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
    if(body.action==='start')progress={...progress,state:'running',phase:'list',processed:0,verified:0,new_imported:0,updated:0,skipped_closed:0,completed_at:null};
    else if(body.action!=='continue'||body.run_id!==ID)return json(response,400,{error:'Invalid synthetic request'});
    if(progress.phase==='verify')progress={...progress,state:'completed',phase:'done',verified:1205,completed_at:new Date().toISOString()};
    else{const processed=Math.min(1205,progress.processed+250),created=Math.floor(processed*.8);progress={...progress,phase:processed===1205?'verify':'details',processed,new_imported:created,updated:processed-created-5,skipped_closed:5};}
    return json(response,progress.state==='running'?202:200,{success:progress.state==='completed',pending:progress.state==='running',progress});
   }
  }
  return json(response,403,{error:'API blocked in synthetic preview'});
 }
 if(request.method!=='GET')return json(response,403,{error:'Only GET pages and assets may be forwarded'});
 const headers={...request.headers,host:'127.0.0.1:3100','accept-encoding':'identity'};delete headers.cookie;delete headers.authorization;
 const upstream=http.request(ROOT+request.url,{method:'GET',headers},incoming=>{const clean={...incoming.headers};delete clean['set-cookie'];if(clean.location)clean.location=clean.location.replace(ROOT,'http://127.0.0.1:3102');response.writeHead(incoming.statusCode,clean);incoming.pipe(response);});
 upstream.on('error',()=>json(response,503,{error:'Start the local compiled site on port 3100'}));upstream.end();
 }catch{if(!response.headersSent)json(response,400,{error:'Invalid fixture request'});else response.end();}
}).listen(3102,'127.0.0.1',()=>console.log('Synthetic import preview: http://127.0.0.1:3102/fixture-admin'));

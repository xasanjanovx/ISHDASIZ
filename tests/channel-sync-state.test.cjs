const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');const read=n=>fs.readFileSync(path.join(__dirname,'../supabase/migrations/'+n),'utf8');
const visibility=read('20261010110000_channel_visibility.sql'),leases=read('20261010120000_channel_leases.sql'),deliveries=read('20261010130000_channel_deliveries.sql'),mainChannel=read('20261027090000_main_employer_channel.sql');
const A='00000000-0000-4000-8000-000000000001',S='00000000-0000-4000-8000-000000000002',B='00000000-0000-4000-8000-000000000003';
const J='20000000-0000-4000-8000-000000000001',R='10000000-0000-4000-8000-000000000001',L='30000000-0000-4000-8000-000000000001',N='30000000-0000-4000-8000-000000000002';let db;
const snapshot=async(type='resume',id=R)=>(await db.query('SELECT ishdasiz_channel_snapshot($1,$2) AS r',[type,id])).rows[0].r;
const seed=async(type='all',limit=200,after=null)=>(await db.query('SELECT ishdasiz_seed_channel_sync($1,$2,$3,$4) AS r',[type,limit,after?.type??null,after?.id??null])).rows[0].r;
const lease=async(token=L,action='acquire')=>(await db.query('SELECT ishdasiz_channel_lease($1,$2) AS r',[token,action])).rows[0].r;
const claim=async(token=L)=>(await db.query('SELECT ishdasiz_channel_claim($1) AS r',[token])).rows[0].r;
const finish=async(id,success=true,token=L)=>(await db.query('SELECT ishdasiz_channel_finish($1,$2,$3,$4) AS r',[token,id,success,'Synthetic failure'])).rows[0].r;
before(async()=>{db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
 CREATE TABLE users(id uuid PRIMARY KEY,password_hash text,phone text);CREATE TABLE otp_codes(phone text,verified boolean);
 CREATE TABLE job_seeker_profiles(id uuid PRIMARY KEY,user_id uuid);CREATE TABLE employer_profiles(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE regions(id integer PRIMARY KEY,slug text,name_uz text,name_ru text);CREATE TABLE districts(id integer PRIMARY KEY,region_id integer,name_uz text,name_ru text);
 CREATE TABLE jobs(id uuid PRIMARY KEY,employer_id uuid,user_id uuid,created_by uuid,status text,is_active boolean,source_status text,region_id integer,district_id integer,category_id uuid,title text,contact_phone text,views_count integer DEFAULT 0,updated_at timestamptz DEFAULT now(),last_seen_at timestamptz);
 CREATE TABLE resumes(id uuid PRIMARY KEY,user_id uuid,status text,is_public boolean,found_job boolean DEFAULT false,post_to_channel boolean,title text,full_name text,phone text,region_id integer,district_id integer,views_count integer DEFAULT 0,updated_at timestamptz DEFAULT now());
 CREATE TABLE telegram_sessions(id uuid PRIMARY KEY,user_id uuid,state text,data jsonb,phone text,otp_code text,otp_expires_at timestamptz);
 INSERT INTO users VALUES('${A}','secret','+998901234567'),('${S}','secret','+998901234568'),('${B}','secret','+998901234569');
 INSERT INTO regions VALUES(1,'andijon-viloyati','Andijon','Андижан'),(22,'toshkent-shahri','Toshkent','Ташкент');INSERT INTO districts VALUES(10,1,'District','Район'),(220,22,'Capital','Столица');`);
 await db.exec(read('20260217_channel_autopost_outbox.sql'));await db.exec(read('20261007090000_account_closure.sql'));await db.exec(read('20261009090000_public_job_availability.sql'));await db.exec(visibility);await db.exec(leases);await db.exec(deliveries);await db.exec('ALTER TABLE jobs ADD COLUMN source text');await db.exec(mainChannel);
});
beforeEach(async()=>{await db.exec(`RESET ROLE;TRUNCATE channel_delivery_intents,channel_delivery_receipts,sync_events,channel_posts,sync_worker_locks,jobs,resumes,employer_profiles,account_publication_snapshots;UPDATE users SET closed_at=null,session_version=0;
 INSERT INTO employer_profiles VALUES('${A}','${A}');INSERT INTO jobs(id,employer_id,status,is_active,region_id,district_id,title) VALUES('${J}','${A}','active',true,1,10,'Public vacancy');
 INSERT INTO resumes(id,user_id,status,is_public,post_to_channel,title,phone,region_id,district_id) VALUES('${R}','${S}','active',true,true,'Public CV','+998901111111',1,10);TRUNCATE sync_events;`);});
after(async()=>{await db?.close();});
test('local employer vacancies target @ishdasiz while imports and resumes retain regional routing',async()=>{
 const target=async(type,id)=>(await db.query('SELECT ishdasiz_channel_target(ishdasiz_channel_snapshot($1,$2)) AS target',[type,id])).rows[0].target;
 await db.exec("UPDATE jobs SET source='local'");
 assert.equal(await target('job',J),'@ishdasiz');assert.equal(await target('resume',R),'@ishdasiz_andijon');
 await db.exec("UPDATE jobs SET source='osonish'");assert.equal(await target('job',J),'@ishdasiz_andijon');
 await db.exec("UPDATE jobs SET source='local',status='archived'");assert.equal(await target('job',J),null);
});
test('channel resumes require explicit stored consent, active public status, no found-job marker and an open owner',async()=>{
 assert.equal((await snapshot()).available,true);
 for(const setting of ['post_to_channel=null','post_to_channel=false','is_public=false',"status='archived'","status='draft'",'status=null','found_job=true','user_id=null']){await db.query("UPDATE resumes SET user_id=$1,post_to_channel=true,is_public=true,status='active',found_job=false",[S]);await db.exec('UPDATE resumes SET '+setting);assert.deepEqual(await snapshot(),{available:false,entity:null,region_slug:null});}
 await db.query("UPDATE resumes SET user_id=$1,post_to_channel=true,is_public=true,status='active',found_job=false",[S]);await db.query('UPDATE users SET closed_at=now() WHERE id=$1',[S]);assert.equal((await snapshot()).available,false);
});
test('channel jobs use full publication/source/owner availability, including published/open legacy states',async()=>{
 for(const status of ['active','published','open',null]){await db.query('UPDATE jobs SET status=$1',[status]);assert.equal((await snapshot('job',J)).available,true);}
 for(const setting of ["source_status='removed_at_source'","status='filled'",'is_active=false']){await db.exec("UPDATE jobs SET source_status=null,status='active',is_active=true");await db.exec('UPDATE jobs SET '+setting);assert.equal((await snapshot('job',J)).available,false);}
});
test('canonical region wins over a mismatched district and an unknown region cannot fall back to an old channel',async()=>{
 await db.exec('UPDATE resumes SET region_id=22,district_id=10');let data=await snapshot();assert.equal(data.region_slug,'toshkent-shahri');assert.equal(data.entity.region_name,'Toshkent');assert.equal(data.entity.district_name,null);
 await db.exec('UPDATE resumes SET region_id=null');assert.equal((await snapshot()).region_slug,'andijon-viloyati');await db.exec('UPDATE resumes SET region_id=999');assert.equal((await snapshot()).region_slug,null);
});
test('resume snapshots never expose owner IDs, exact coordinates, raw metadata or future private columns',async()=>{
 await db.exec("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS latitude double precision,ADD COLUMN IF NOT EXISTS raw_source_json jsonb,ADD COLUMN IF NOT EXISTS private_note text;UPDATE resumes SET latitude=40.123456,raw_source_json='{\"secret\":\"private\"}',private_note='never publish';");const data=await snapshot();assert.equal(data.available,true);assert.equal(data.entity.phone,'+998901111111');for(const key of ['user_id','latitude','raw_source_json','private_note','views_count','updated_at'])assert.ok(!(key in data.entity));
});
test('resume consent, found-job, contacts and ownership changes enqueue fresh state; views/no-op updates do not',async()=>{
 await db.exec('UPDATE resumes SET views_count=views_count+1,updated_at=now()');assert.equal((await db.query('SELECT count(*)::int n FROM sync_events')).rows[0].n,0);
 for(const setting of ['found_job=true',"phone='+998902222222'",'post_to_channel=false',`user_id='${B}'`])await db.exec('UPDATE resumes SET '+setting);
 const rows=(await db.query('SELECT entity_type,action,payload FROM sync_events')).rows;assert.equal(rows.length,4);assert.ok(rows.every(r=>r.entity_type==='resume'&&r.action==='deactivate'&&JSON.stringify(r.payload)==='{}'));
});
test('source availability and content changes enqueue jobs while repeated service timestamps/views do not',async()=>{
 await db.exec('UPDATE jobs SET views_count=1,updated_at=now(),last_seen_at=now()');assert.equal((await db.query('SELECT count(*)::int n FROM sync_events')).rows[0].n,0);
 await db.exec("UPDATE jobs SET source_status='removed_at_source'");assert.equal((await db.query('SELECT action FROM sync_events')).rows[0].action,'deactivate');await db.exec('DELETE FROM jobs');assert.equal((await db.query("SELECT count(*)::int n FROM sync_events WHERE action='delete'")).rows[0].n,1);
});
test('account close/restore queues reconciliation even when legacy publication flags are unchanged',async()=>{
 await db.query('UPDATE users SET closed_at=now() WHERE id IN($1,$2)',[A,S]);assert.equal((await snapshot()).available,false);assert.equal((await snapshot('job',J)).available,false);assert.equal((await db.query("SELECT count(*)::int n FROM sync_events WHERE action='deactivate'")).rows[0].n,2);
 await db.query('UPDATE users SET closed_at=null WHERE id IN($1,$2)',[A,S]);assert.equal((await db.query("SELECT count(*)::int n FROM sync_events WHERE action='upsert'")).rows[0].n,2);
});
test('company transfers to a closed or missing owner queue the affected vacancies and stop public channel snapshots',async()=>{
 await db.query('UPDATE employer_profiles SET user_id=$1',[B]);assert.equal((await db.query('SELECT count(*)::int n FROM sync_events')).rows[0].n,1);await db.exec('TRUNCATE sync_events');await db.query('UPDATE users SET closed_at=now() WHERE id=$1',[B]);assert.equal((await snapshot('job',J)).available,false);assert.equal((await db.query('SELECT count(*)::int n FROM sync_events')).rows[0].n,1);await db.query('UPDATE users SET closed_at=null WHERE id=$1',[B]);await db.exec('TRUNCATE sync_events;DELETE FROM employer_profiles');assert.equal((await snapshot('job',J)).available,false);assert.equal((await db.query('SELECT count(*)::int n FROM sync_events')).rows[0].n,1);
});
test('seed includes old posts for deleted/hidden/opted-out entities and never manufactures opt-in',async()=>{
 await db.exec('UPDATE resumes SET post_to_channel=null');await db.exec('TRUNCATE sync_events');await db.query("INSERT INTO channel_posts(entity_type,entity_id,channel_username,message_id) VALUES('resume',$1,'@ishdasiz_andijon',10)",[R]);await db.exec('DELETE FROM resumes');await db.exec('TRUNCATE sync_events');const result=await seed();assert.equal(result.scanned,2);assert.equal(result.resumes,1);assert.equal(result.jobs,1);assert.equal((await seed()).jobs,0);assert.equal((await seed()).resumes,0);assert.equal((await snapshot()).available,false);
});
test('seed keyset pages all eligible records beyond REST limits and deduplicates pending work',async()=>{
 await db.exec(`INSERT INTO jobs(id,employer_id,status,is_active,region_id) SELECT ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${A}','active',true,1 FROM generate_series(2,1201)n;TRUNCATE sync_events;`);
 let after=null,scanned=0,inserted=0;for(;;){const page=await seed('all',200,after);scanned+=page.scanned;inserted+=page.jobs+page.resumes;if(!page.has_more)break;after={type:page.after_type,id:page.after_id};}assert.equal(scanned,1202);assert.equal(inserted,1202);assert.equal((await seed('all',5000)).jobs,0);
});
test('lease acquisition serializes workers and a busy caller cannot release the current lease',async()=>{
 const values=await Promise.all([lease(L),lease(N)]);assert.equal(values.filter(Boolean).length,1);const owner=values[0]?L:N,other=values[0]?N:L;assert.equal(await lease(other,'release'),false);assert.equal(await lease(owner,'renew'),true);assert.equal(await lease(other),false);
});
test('legacy channel cron cannot acquire or release the new lease while unrelated generic locks keep working',async()=>{
 assert.equal(await lease(),true);assert.equal((await db.query("SELECT acquire_worker_lock('telegram_channel_sync',60) AS r")).rows[0].r,false);await db.exec("SELECT release_worker_lock('telegram_channel_sync')");assert.equal(await lease(N),false);assert.equal(await lease(L,'renew'),true);
 assert.equal((await db.query("SELECT acquire_worker_lock('unrelated_worker',60) AS r")).rows[0].r,true);await db.exec("SELECT release_worker_lock('unrelated_worker')");
});
test('expired processing is reclaimed and a stale worker cannot renew, complete or unlock a replacement',async()=>{
 await seed('job');assert.equal(await lease(),true);const event=await claim();assert.equal(event.status,'processing');assert.equal(event.attempts,1);await db.exec("UPDATE sync_worker_locks SET locked_until=now()-interval '1 second'");assert.equal(await lease(N),true);assert.equal(await lease(L,'release'),false);assert.equal(await lease(L,'renew'),false);await assert.rejects(finish(event.id,true,L),e=>e.code==='40001');const next=await claim(N);assert.equal(next.id,event.id);assert.equal(next.attempts,2);assert.equal(await finish(next.id,true,N),true);
});
test('claims and completion use the exact lease; failed work gets durable backoff without a fake done status',async()=>{
 await seed('job');await lease();const event=await claim();assert.equal(event.lease_token,L);assert.equal(await finish(event.id,false),true);assert.equal(await finish(event.id,true),false);const row=(await db.query('SELECT status,next_retry_at>now() future,processed_at,last_error FROM sync_events')).rows[0];assert.equal(row.status,'failed');assert.equal(row.future,true);assert.equal(row.processed_at,null);assert.equal(row.last_error,'Synthetic failure');assert.equal(await claim(),null);
});
test('eight failed attempts stop automatic retries and preserve the failure record',async()=>{
 await seed('job');await db.exec('UPDATE sync_events SET attempts=7');await lease();const event=await claim();assert.equal(event.attempts,8);await finish(event.id,false);await db.exec('UPDATE sync_events SET next_retry_at=now()');assert.equal(await claim(),null);assert.equal((await db.query('SELECT status FROM sync_events')).rows[0].status,'failed');
});
test('browser roles lose old table, column and helper rights while service access remains',async()=>{
 await db.exec('GRANT ALL ON sync_events,channel_posts,sync_worker_locks TO PUBLIC,anon,authenticated;GRANT SELECT(id),UPDATE(status) ON channel_posts TO PUBLIC,anon,authenticated;');await db.exec(visibility);await db.exec(leases);
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(snapshot(),e=>e.code==='42501');await assert.rejects(seed(),e=>e.code==='42501');await assert.rejects(lease(),e=>e.code==='42501');await assert.rejects(db.query('SELECT id FROM channel_posts'),e=>e.code==='42501');await assert.rejects(db.query("SELECT acquire_worker_lock('telegram_channel_sync',60)"),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
 await db.exec('SET ROLE service_role');try{assert.equal((await snapshot()).available,true);assert.equal(await lease(),true);}finally{await db.exec('RESET ROLE');}
});
test('reapplying migrations preserves publication choices, receipts, queue history and one trigger per entity',async()=>{
 await db.query("INSERT INTO channel_posts(entity_type,entity_id,channel_username,message_id,status) VALUES('resume',$1,'@ishdasiz_andijon',10,'redacted')",[R]);await seed();const before=(await db.query('SELECT * FROM channel_posts')).rows;await db.exec(visibility);await db.exec(leases);assert.deepEqual((await db.query('SELECT * FROM channel_posts')).rows,before);assert.equal((await snapshot()).entity.post_to_channel,true);assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname IN('trg_sync_jobs_events','trg_sync_resumes_events')")).rows[0].n,2);
});

const H='a'.repeat(64),C='@ishdasiz_andijon';
const begin=async(e,token=L,channel=C,current=null,hash=H)=>(await db.query('SELECT ishdasiz_channel_send_begin($1,$2,$3,$4,$5) r',[token,e.id,channel,JSON.stringify(current??await snapshot(e.entity_type,e.entity_id)),hash])).rows[0].r;
const acknowledge=async(id,outcome='confirmed',message=11,token=L)=>(await db.query('SELECT ishdasiz_channel_send_result($1,$2,$3,$4) r',[token,id,outcome,message])).rows[0].r;
const updateReceipt=async(e,r,status='deleted',token=L,current=null)=>(await db.query('SELECT ishdasiz_channel_receipt_update($1,$2,$3,$4,$5,$6) r',[token,e.id,r.id,status,status==='active'?H:null,current?JSON.stringify(current):null])).rows[0].r;
const start=async()=>{await seed('resume');await lease();return claim();};
const resolve=async(id,message=null,notDelivered=true,version=null)=>{const row=(await db.query('SELECT updated_at::text FROM channel_delivery_intents WHERE id=$1',[id])).rows[0];return(await db.query('SELECT ishdasiz_channel_resolve($1,$2,$3,$4) r',[id,version??row.updated_at,message,notDelivered])).rows[0].r;};
test('a durable send reservation blocks a second send, including another region and replacement lease',async()=>{
 const e=await start(),id=await begin(e);await assert.rejects(begin(e),x=>x.code==='55000');
 await acknowledge(id,'uncertain',null);await db.exec("UPDATE sync_worker_locks SET locked_until=now()-interval '1 second'");await lease(N);const replacement=await claim(N);await assert.rejects(begin(replacement,N),x=>x.code==='55000');
 await db.exec('UPDATE resumes SET region_id=22,district_id=null');await assert.rejects(begin(replacement,N,'@ishdasiz_toshkent'),x=>x.code==='55000');assert.equal((await db.query('SELECT count(*)::int n FROM channel_delivery_intents')).rows[0].n,1);
});
test('only an explicitly rejected attempt allows the next durable send reservation',async()=>{
 const e=await start(),id=await begin(e);await acknowledge(id,'rejected',null);assert.notEqual(await begin(e),id);
});
test('stale snapshots, a foreign channel, a lost event, and invalid hashes cannot reserve a send',async()=>{
 const e=await start(),old=await snapshot();await db.exec("UPDATE resumes SET phone='+998902222222'");await assert.rejects(begin(e,L,C,old),x=>x.code==='40001');
 await assert.rejects(begin(e,L,'@foreign_channel'),x=>x.code==='40001');await assert.rejects(begin(e,L,C,null,'bad'),x=>x.code==='40001');await finish(e.id);await assert.rejects(begin(e),x=>x.code==='40001');
 assert.equal((await db.query('SELECT count(*)::int n FROM channel_delivery_intents')).rows[0].n,0);
});
test('a late Telegram acknowledgement survives an expired lease and queues cleanup without replacing the current projection',async()=>{
 const e=await start(),id=await begin(e);await db.exec("UPDATE sync_worker_locks SET locked_until=now()-interval '1 second'");await lease(N);
 const r=await acknowledge(id);assert.equal(r.message_id,11);assert.equal((await db.query('SELECT count(*)::int n FROM channel_posts')).rows[0].n,0);
 assert.equal((await db.query("SELECT count(*)::int n FROM sync_events WHERE status='pending'")).rows[0].n,1);await assert.rejects(updateReceipt(e,r,'deleted'),x=>x.code==='40001');
});
test('privacy changes after a send preserve the receipt for cleanup and never create an active projection',async()=>{
 const e=await start(),id=await begin(e);await db.query('UPDATE users SET closed_at=now() WHERE id=$1',[S]);const r=await acknowledge(id);assert.equal(r.status,'active');assert.equal((await db.query('SELECT count(*)::int n FROM channel_posts')).rows[0].n,0);assert.equal(await updateReceipt(e,r),true);assert.equal((await db.query('SELECT status FROM channel_delivery_receipts')).rows[0].status,'deleted');
});
test('confirmed receipts are idempotent, reject another token, and never resurrect removed posts',async()=>{
 const e=await start(),id=await begin(e),r=await acknowledge(id);assert.equal((await acknowledge(id)).id,r.id);await assert.rejects(acknowledge(id,'confirmed',11,N),x=>x.code==='40001');
 assert.equal(await updateReceipt(e,r),true);assert.equal((await acknowledge(id)).status,'deleted');assert.equal((await db.query('SELECT status FROM channel_posts')).rows[0].status,'deleted');assert.equal((await db.query('SELECT count(*)::int n FROM channel_delivery_receipts')).rows[0].n,1);
});
test('replacement legacy projection preserves both historical message IDs',async()=>{
 await db.query("INSERT INTO channel_posts(entity_type,entity_id,channel_username,message_id) VALUES('resume',$1,$2,10)",[R,C]);await db.exec('UPDATE channel_posts SET message_id=12');assert.deepEqual((await db.query('SELECT message_id FROM channel_delivery_receipts ORDER BY message_id')).rows.map(x=>x.message_id),[10,12]);const e=await start();await assert.rejects(begin(e),x=>x.code==='40001');
});
test('receipt updates require the claimed entity and current visibility for edits, with no stale lease writes',async()=>{
 const e=await start(),id=await begin(e),r=await acknowledge(id),old=await snapshot();await db.exec('UPDATE resumes SET post_to_channel=false');await assert.rejects(updateReceipt(e,r,'active',L,old),x=>x.code==='40001');assert.equal(await updateReceipt(e,{id:J}),false);assert.equal(await updateReceipt(e,r,'redacted'),true);assert.equal(await updateReceipt(e,r,'active',L,old),false);
});
test('a receipt in another entity cannot be overwritten by a conflicting Telegram message ID',async()=>{
 const e=await start(),id=await begin(e);await db.query("INSERT INTO channel_delivery_receipts(entity_type,entity_id,channel_username,message_id,status) VALUES('job',$1,$2,11,'active')",[J,C]);await assert.rejects(acknowledge(id),x=>x.code==='23505');assert.equal((await db.query('SELECT status FROM channel_delivery_intents')).rows[0].status,'sending');
});
test('operator resolution requires an old inactive request, a matching version, and explicit evidence',async()=>{
 const e=await start(),id=await begin(e);await acknowledge(id,'uncertain',null);await assert.rejects(resolve(id),x=>x.code==='55000');await lease(L,'release');await db.exec("UPDATE channel_delivery_intents SET created_at=now()-interval '10 minutes'");assert.equal(await resolve(id,null,true,'2000-01-01T00:00:00Z'),false);await assert.rejects(resolve(id,11,true),x=>x.code==='22023');assert.equal(await resolve(id),true);assert.equal(await resolve(id),false);assert.equal((await db.query('SELECT resolution FROM channel_delivery_intents')).rows[0].resolution,'Operator verified no post');
});
test('operator verified message IDs preserve receipts and enable reconciliation after a network timeout',async()=>{
 const e=await start(),id=await begin(e);await acknowledge(id,'uncertain',null);await lease(L,'release');await db.exec("UPDATE channel_delivery_intents SET created_at=now()-interval '10 minutes'");assert.equal(await resolve(id,12,false),true);assert.equal((await db.query('SELECT message_id FROM channel_delivery_receipts')).rows[0].message_id,12);assert.equal((await db.query('SELECT status FROM channel_delivery_intents')).rows[0].status,'confirmed');
});
test('a late real acknowledgement after manual resolution preserves both known IDs for duplicate cleanup',async()=>{
 const e=await start(),id=await begin(e);await lease(L,'release');await db.exec("UPDATE channel_delivery_intents SET created_at=now()-interval '10 minutes'");await resolve(id,12,false);await acknowledge(id,'confirmed',11);assert.deepEqual((await db.query('SELECT message_id FROM channel_delivery_receipts ORDER BY message_id')).rows.map(x=>x.message_id),[11,12]);
});
test('browser roles cannot access delivery state or resolve unknown sends',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(db.query('SELECT * FROM channel_delivery_intents'),e=>e.code==='42501');await assert.rejects(db.query('SELECT * FROM channel_delivery_receipts'),e=>e.code==='42501');await assert.rejects(db.query('SELECT ishdasiz_channel_resolve($1,now(),null,true)',[J]),e=>e.code==='42501');await assert.rejects(db.query('SELECT ishdasiz_channel_send_result($1,$2,$3,11)',[L,J,'confirmed']),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
});
test('reapplying the delivery migration preserves unresolved intents, removed receipts and one history trigger',async()=>{
 const e=await start(),id=await begin(e),r=await acknowledge(id);await updateReceipt(e,r);await db.exec(deliveries);assert.equal((await acknowledge(id)).status,'deleted');assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='trg_channel_receipt_history'")).rows[0].n,1);
});

test('invalid external IDs cannot release an unresolved send or create a receipt',async()=>{
 const e=await start(),id=await begin(e);for(const message of [0,-1,'9007199254740992'])await assert.rejects(acknowledge(id,'confirmed',message),x=>x.code==='22023');assert.equal((await db.query('SELECT status FROM channel_delivery_intents')).rows[0].status,'sending');assert.equal((await db.query('SELECT count(*)::int n FROM channel_delivery_receipts')).rows[0].n,0);
});
test('historical active posts in an old region must be cleaned before sending in a new one',async()=>{
 await db.query("INSERT INTO channel_delivery_receipts(entity_type,entity_id,channel_username,message_id,status) VALUES('resume',$1,$2,11,'active')",[R,C]);await db.exec('UPDATE resumes SET region_id=22,district_id=null;TRUNCATE sync_events');const e=await start();await assert.rejects(begin(e,L,'@ishdasiz_toshkent'),x=>x.code==='40001');
});
test('reconciliation seed includes orphan receipts and unresolved intents even after their source entity is deleted',async()=>{
 const e=await start(),id=await begin(e);await db.exec("UPDATE sync_worker_locks SET locked_until=now()-interval '1 second'");await acknowledge(id);await db.exec('DELETE FROM resumes;TRUNCATE sync_events');assert.equal((await seed('resume')).resumes,1);await db.exec("TRUNCATE sync_events,channel_delivery_receipts;UPDATE channel_delivery_intents SET status='uncertain'");assert.equal((await seed('resume')).resumes,1);
});
test('reapplying delivery access controls removes legacy column grants as well as table grants',async()=>{
 await db.exec('GRANT SELECT(id),UPDATE(status) ON channel_delivery_intents,channel_delivery_receipts TO PUBLIC,anon,authenticated');await db.exec(deliveries);
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(db.query('SELECT id FROM channel_delivery_intents'),x=>x.code==='42501');await assert.rejects(db.query('SELECT id FROM channel_delivery_receipts'),x=>x.code==='42501');}finally{await db.exec('RESET ROLE');}}
});

test('unresolved send health remains visible after eight queue attempts, and clears only after evidence',async()=>{
 const attention=async()=>(await db.query('SELECT ishdasiz_channel_delivery_attention() r')).rows[0].r;
 const e=await start(),id=await begin(e);await acknowledge(id,'uncertain',null);await db.exec("UPDATE sync_events SET attempts=8,status='failed'");assert.equal(await claim(),null);assert.equal(await attention(),1);await acknowledge(id);assert.equal(await attention(),0);
 await db.exec('SET ROLE anon');try{await assert.rejects(attention(),x=>x.code==='42501');}finally{await db.exec('RESET ROLE');}
});

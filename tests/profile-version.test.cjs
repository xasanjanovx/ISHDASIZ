const { test,before,after }=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261007093000_profile_updated_at.sql'),'utf8');
let db;
before(async()=>{db=await PGlite.create();await db.exec(`CREATE TABLE job_seeker_profiles(id integer PRIMARY KEY,full_name text,updated_at timestamptz);CREATE TABLE employer_profiles(id integer PRIMARY KEY,company_name text,is_verified boolean,updated_at timestamptz);
INSERT INTO job_seeker_profiles VALUES(1,'Existing name','2026-01-01');INSERT INTO employer_profiles VALUES(1,'Existing company',false,'2026-01-01');`);await db.exec(sql);});
after(async()=>{await db?.close();});
test('external profile updates change the version in both roles and stale edits cannot replace verified data',async()=>{
 const prior=(await db.query('SELECT updated_at::text AS version FROM employer_profiles')).rows[0].version;
 await db.exec("UPDATE employer_profiles SET is_verified=true,company_name='Verified company';UPDATE job_seeker_profiles SET full_name='Changed by bot'");
 assert.notEqual((await db.query('SELECT updated_at::text AS version FROM employer_profiles')).rows[0].version,prior);
 const stale=await db.query('UPDATE employer_profiles SET company_name=$1 WHERE id=1 AND updated_at=$2::timestamptz RETURNING id',['Old form',prior]);assert.equal(stale.rows.length,0);assert.equal((await db.query('SELECT company_name FROM employer_profiles')).rows[0].company_name,'Verified company');
 assert((await db.query('SELECT updated_at > $1::timestamptz AS changed FROM job_seeker_profiles',['2026-01-01'])).rows[0].changed);
});
test('reapplying the migration preserves profiles and keeps exactly two triggers',async()=>{
 await db.exec(sql);assert.equal((await db.query("SELECT count(*)::integer AS n FROM pg_trigger WHERE tgname='ishdasiz_profile_updated_at'")).rows[0].n,2);assert.equal((await db.query('SELECT full_name FROM job_seeker_profiles')).rows[0].full_name,'Changed by bot');assert.equal((await db.query('SELECT is_verified FROM employer_profiles')).rows[0].is_verified,true);
});

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261007092000_public_resume_search.sql'), 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db;
before(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE regions (id integer PRIMARY KEY,name_uz text,name_ru text);
    CREATE TABLE districts (id integer PRIMARY KEY,name_uz text,name_ru text);
    CREATE TABLE resumes (id uuid PRIMARY KEY,title text,full_name text,city text,region_id integer,district_id integer,
      experience text,experience_years integer,skills text[],expected_salary_min integer,expected_salary_max integer,created_at timestamptz,
      category_id uuid,education_level text,gender text,about text,phone text,birth_date date,user_id uuid,is_public boolean,status text);
    INSERT INTO regions VALUES (22,'Toshkent','Ташкент'); INSERT INTO districts VALUES (100,'Yunusobod','Юнусабад');
    INSERT INTO resumes (id,title,full_name,region_id,district_id,experience,education_level,gender,created_at,is_public,status,skills,expected_salary_min,expected_salary_max,phone,about)
      SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'Developer','Candidate',22,100,'3_years','higher','male','2026-10-07T00:00:00.123456Z',true,'active',ARRAY['React Native','C++,%(test)'],4000000,NULL,'PRIVATE','About'
      FROM generate_series(1,1205) n;
    UPDATE resumes SET is_public=false WHERE id='${id(1205)}'; UPDATE resumes SET status='draft' WHERE id='${id(1204)}'; UPDATE resumes SET status='archived' WHERE id='${id(1203)}';
    GRANT SELECT ON resumes,regions,districts TO service_role;`);
  await db.exec(migration);
});
after(async () => { await db?.close(); });
const search = (query = '', extra = {}) => {
  const params = { p_query: query, ...extra };
  return db.query(`SELECT card FROM ishdasiz_public_resume_search(${Object.keys(params).map((key, i) => `${key}=>$${i + 1}`).join(',')})`, Object.values(params));
};
test('SQL search finds skills across all records, returns only public active cards and omits private fields', async () => {
  const result = await search('react'); assert.equal(result.rows.length, 25); assert.equal(result.rows[0].card.id, id(1202));
  assert.equal(result.rows[0].card.regions.name_ru, 'Ташкент'); assert(!JSON.stringify(result.rows).includes('PRIVATE')); assert(!('phone' in result.rows[0].card)); assert(!('about' in result.rows[0].card));
});
test('SQL keyset paging keeps all 1202 equal-date rows without duplication', async () => {
  let before = {}, all = [];
  do {
    const result = await search('REACT', before); const page = result.rows.slice(0, 24).map(row => row.card); all.push(...page.map(row => row.id));
    if (result.rows.length <= 24) break; const last = page.at(-1); before = { p_before_created: last.created_at, p_before_id: last.id };
  } while (true);
  assert.equal(all.length, 1202); assert.equal(new Set(all).size, 1202); assert.equal(all.at(-1), id(1));
});
test('search characters are literal, salary ranges overlap, and location mismatches cannot bypass filters', async () => {
  assert.equal((await search('C++,%(test)')).rows.length, 25); assert.equal((await search('not available')).rows.length, 0);
  assert.equal((await search('react', { p_region: 9, p_district: 100 })).rows.length, 0);
  assert.equal((await search('react', { p_salary_min: 5000000, p_salary_max: 7000000, p_experience: ['3','3_years'] })).rows.length, 25);
  assert.equal((await search('react', { p_salary_max: 3000000 })).rows.length, 0);
});
test('only the server role can execute the function, and repeating the migration preserves data', async () => {
  for (const role of ['anon','authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(search('react'), /permission denied for function/);
    await db.exec('RESET ROLE');
  }
  await db.exec('SET ROLE service_role'); assert.equal((await search('react')).rows.length, 25); await db.exec('RESET ROLE');
  await db.exec(migration); assert.equal((await db.query('SELECT count(*)::integer AS total FROM resumes')).rows[0].total, 1205);
});
test('the same function supports legacy JSONB experience and JSONB skills without losing filters', async () => {
  await db.exec('ALTER TABLE resumes ALTER COLUMN experience TYPE jsonb USING to_jsonb(experience); ALTER TABLE resumes ALTER COLUMN skills TYPE jsonb USING to_jsonb(skills)');
  const result = await search('react', { p_experience: ['3','3_years'] }); assert.equal(result.rows.length, 25); assert.equal(result.rows[0].card.experience, '3_years');
  assert.deepEqual(result.rows[0].card.skills, ['React Native','C++,%(test)']);
  assert.equal((await search('react', { p_experience: ['no_experience'] })).rows.length, 0);
});

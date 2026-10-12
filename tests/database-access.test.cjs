const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261006090000_private_chat_and_identity.sql'), 'utf8');
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const CHAT = '10000000-0000-4000-8000-000000000001';
let db;

before(async () => {
    // Isolated PostgreSQL in memory. No .env, network, live users or Supabase connection.
    db = await PGlite.create();
    await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE ROLE service_role BYPASSRLS;
        GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
        CREATE TABLE users (id uuid PRIMARY KEY, password_hash text);
        CREATE TABLE otp_codes (id uuid PRIMARY KEY, code text);
        CREATE TABLE telegram_sessions (id uuid PRIMARY KEY);
        CREATE TABLE conversations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user1_id uuid REFERENCES users(id), user2_id uuid REFERENCES users(id),
            user1_role text, user2_role text,
            created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
            UNIQUE (user1_id, user2_id)
        );
        CREATE TABLE messages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
            sender_id uuid REFERENCES users(id), content text,
            is_read boolean DEFAULT false, created_at timestamptz DEFAULT now()
        );
        GRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC, anon, authenticated;
        GRANT SELECT (password_hash) ON users TO anon;
        GRANT SELECT (code) ON otp_codes TO authenticated;
        INSERT INTO users VALUES ('${A}', 'synthetic-test-hash'), ('${B}', 'synthetic-test-hash');
        INSERT INTO otp_codes VALUES ('${A}', '54321');
        INSERT INTO telegram_sessions VALUES ('${A}');
        INSERT INTO conversations (id,user1_id,user2_id,user1_role,user2_role,updated_at)
            VALUES ('${CHAT}','${A}','${B}','job_seeker','employer','2026-01-01T00:00:00Z');
        INSERT INTO messages (conversation_id,sender_id,content,created_at) VALUES ('${CHAT}','${B}','Existing history','2026-01-02T00:00:00Z');
    `);
    await db.exec(migration);
});

after(async () => { await db?.close(); });

async function asRole(role, callback) {
    await db.exec(`SET ROLE ${role}`);
    try { return await callback(); }
    finally { await db.exec('RESET ROLE'); }
}

test('migration blocks table and column access for browser roles, including legacy column grants', async () => {
    for (const role of ['anon', 'authenticated']) {
        await asRole(role, async () => {
            for (const query of ['SELECT password_hash FROM users', 'SELECT code FROM otp_codes',
                'SELECT * FROM telegram_sessions', 'SELECT * FROM conversations', 'SELECT * FROM messages',
                'SELECT * FROM conversation_preferences', `UPDATE users SET password_hash='forged'`,
                `INSERT INTO messages (conversation_id,sender_id,content) VALUES ('${CHAT}','${A}','forged')`,
                'DELETE FROM messages']) {
                await assert.rejects(db.query(query), error => error.code === '42501');
            }
        });
    }
});

test('all protected tables have RLS enabled and service_role can still read', async () => {
    const status = await db.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('users','otp_codes','telegram_sessions','conversations','messages','conversation_preferences')");
    assert.equal(status.rows.length, 6);
    assert.ok(status.rows.every(row => row.relrowsecurity));
    await asRole('service_role', async () => {
        const result = await db.query('SELECT count(*)::integer AS total FROM users');
        assert.equal(result.rows[0].total, 2);
    });
});

test('existing conversation and messages survive the migration', async () => {
    assert.equal((await db.query('SELECT content FROM messages')).rows[0].content, 'Existing history');
    assert.equal((await db.query('SELECT id FROM conversations')).rows[0].id, CHAT);
});

test('old conversation ordering is repaired from its latest message', async () => {
    const result = await db.query('SELECT updated_at FROM conversations WHERE id=$1', [CHAT]);
    assert.equal(new Date(result.rows[0].updated_at).toISOString(), '2026-01-02T00:00:00.000Z');
});

test('server message insert updates the conversation timestamp through the database trigger', async () => {
    await asRole('service_role', async () => {
        await db.query('INSERT INTO messages (conversation_id,sender_id,content,created_at) VALUES ($1,$2,$3,$4)',
            [CHAT, A, 'Server message', '2026-10-06T12:00:00Z']);
        const result = await db.query('SELECT updated_at FROM conversations WHERE id=$1', [CHAT]);
        assert.equal(new Date(result.rows[0].updated_at).toISOString(), '2026-10-06T12:00:00.000Z');
    });
});

test('role uniqueness allows the opposite profile and rejects duplicate conversations', async () => {
    await asRole('service_role', async () => {
        await db.query("INSERT INTO conversations (user1_id,user2_id,user1_role,user2_role) VALUES ($1,$2,'employer','job_seeker')", [A,B]);
        await assert.rejects(db.query("INSERT INTO conversations (user1_id,user2_id,user1_role,user2_role) VALUES ($1,$2,'employer','job_seeker')", [A,B]), error => error.code === '23505');
    });
});

test('archiving stores a preference without removing either user’s messages', async () => {
    const before = (await db.query('SELECT count(*)::integer AS total FROM messages')).rows[0].total;
    await asRole('service_role', async () => {
        await db.query('INSERT INTO conversation_preferences (user_id,conversation_id,hidden_at) VALUES ($1,$2,now()) ON CONFLICT (user_id,conversation_id) DO UPDATE SET hidden_at=EXCLUDED.hidden_at', [A,CHAT]);
        await db.query('UPDATE conversation_preferences SET hidden_at=NULL WHERE user_id=$1 AND conversation_id=$2', [A,CHAT]);
    });
    assert.equal((await db.query('SELECT count(*)::integer AS total FROM messages')).rows[0].total, before);
});

test('reapplying the migration preserves rows and permissions', async () => {
    await db.exec(migration);
    assert.equal((await db.query('SELECT count(*)::integer AS total FROM conversations')).rows[0].total, 2);
    await asRole('anon', async () => { await assert.rejects(db.query('SELECT password_hash FROM users'), error => error.code === '42501'); });
});

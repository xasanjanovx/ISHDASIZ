// Read-only and offline. Never print environment values or contact a service.
const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig, processEnv } = require('@next/env');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const logger = { info() {}, error() { throw new Error('Could not parse environment file'); } };

try {
  let env, sources;
  if (!args.length) {
    process.env.NODE_ENV = 'production';
    const result = loadEnvConfig(root, false, logger, true);
    env = result.combinedEnv;
    sources = result.loadedEnvFiles.map(file => file.path);
  } else if (args.length === 2 && args[0] === '--file') {
    const file = path.resolve(args[1]);
    const bytes = fs.readFileSync(file);
    if (bytes.includes(0)) throw new Error('Save the environment file as UTF-8');
    const entry = { path: file, contents: bytes.toString('utf8').replace(/^\uFEFF/, '') };
    processEnv([entry], root, logger, true);
    // An explicit file is checked on its own, without silently using another file.
    env = entry.env;
    sources = [file];
  } else {
    throw new Error('Usage: node scripts/check-release-env.cjs [--file <path>]');
  }

  const failures = [], warnings = [];
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'TELEGRAM_BOT_TOKEN', 'NEXT_PUBLIC_APP_URL', 'ESKIZ_EMAIL', 'ESKIZ_PASSWORD',
    'AUTH_SESSION_SECRET', 'CRON_SECRET', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_SETUP_SECRET',
  ];
  for (const key of required) {
    if (!env[key]?.trim()) failures.push(`${key}: missing`);
    else if (env[key] !== env[key].trim()) failures.push(`${key}: surrounding whitespace`);
  }
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_KEY;
  if (!serviceKey?.trim()) failures.push('SUPABASE_SERVICE_ROLE_KEY: missing');
  const secrets = ['AUTH_SESSION_SECRET', 'CRON_SECRET', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_SETUP_SECRET'];
  for (const key of secrets) {
    if (!env[key]) continue;
    if (env[key].length < 32 || /\s|[\x00-\x1f\x7f]/.test(env[key])) failures.push(`${key}: use at least 32 characters without whitespace`);
    if (secrets.some(other => other !== key && env[other] === env[key]) || env[key] === serviceKey || env[key] === env.TELEGRAM_BOT_TOKEN) failures.push(`${key}: must have an independent value`);
  }
  if (env.TELEGRAM_WEBHOOK_SECRET && !/^[A-Za-z0-9_-]{1,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET)) failures.push('TELEGRAM_WEBHOOK_SECRET: invalid Telegram secret_token format');
  if (env.TELEGRAM_BOT_TOKEN && !/^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN)) failures.push('TELEGRAM_BOT_TOKEN: invalid format');
  for (const [key, expected] of [
    ['NEXT_PUBLIC_SUPABASE_URL', 'https://awkjrolplhvrscuqqive.supabase.co'],
    ['NEXT_PUBLIC_APP_URL', 'https://ishdasiz.uz'],
  ]) {
    if (env[key] && env[key].replace(/\/$/, '') !== expected) failures.push(`${key}: does not match the verified production project`);
  }
  if (/^(?:1|true|yes)$/i.test(env.TELEGRAM_DRY_RUN || '')) failures.push('TELEGRAM_DRY_RUN: enabled in production');
  if (!env.ADMIN_IDS?.trim()) warnings.push('ADMIN_IDS: no Telegram administrators configured');
  if (!['DATABASE_URL', 'DIRECT_URL', 'PGPASSWORD', 'SUPABASE_DB_PASSWORD'].some(key => env[key]?.trim())) warnings.push('Database backup: no database connection password found; the backup command will prompt locally');
  console.log('Sources:', sources.join(', ') || 'process environment');
  for (const failure of failures) console.log('FAIL', failure);
  for (const warning of warnings) console.log('WARN', warning);
  console.log(failures.length ? `Environment is not ready: ${failures.length} issue(s).` : 'Local production environment checks passed. Vercel Production configuration and database release still require separate verification.');
  process.exitCode = failures.length ? 1 : 0;
} catch {
  // File errors and parser exceptions must never echo source contents.
  console.error('Environment check failed. Check the file path, UTF-8 encoding, and command arguments. No values were printed.');
  process.exitCode = 1;
}

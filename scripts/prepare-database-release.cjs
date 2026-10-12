// Offline only: checks explicit release membership and byte hashes, then
// optionally exports a clean migration folder. Never loads .env or connects.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const manifestPath = path.join(root, 'supabase/releases/2026-10-repair.json');

function validateRelease() {
  const bytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.format !== 1 || manifest.release !== '2026-10-repair' || !Array.isArray(manifest.migrations) || !manifest.migrations.length) throw new Error('Invalid release manifest');
  const seen = new Set(), versions = new Set(), migrations = [];
  for (const entry of manifest.migrations) {
    if (!/^\d{14}_[a-z_]+\.sql$/.test(entry.file) || seen.has(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Array.isArray(entry.requires)) throw new Error('Invalid migration entry');
    const version = entry.file.split('_')[0];
    if (versions.has(version) || entry.requires.some(file => !seen.has(file))) throw new Error(`Invalid version/dependency order: ${entry.file}`);
    const content = fs.readFileSync(path.join(root, 'supabase/migrations', entry.file));
    if (digest(content) !== entry.sha256) throw new Error(`Migration checksum changed: ${entry.file}`);
    migrations.push({ file: entry.file, content }); seen.add(entry.file); versions.add(version);
  }
  const prepared = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(file => /^202610.*\.sql$/.test(file));
  if (prepared.length !== seen.size || prepared.some(file => !seen.has(file))) throw new Error('Prepared migration is missing from the release manifest');
  return { manifest, bytes, migrations };
}

function exportRelease(release) {
  const audit = fs.readFileSync(path.join(root, 'supabase/releases/audit-2026-10.sql'));
  const readme = fs.readFileSync(path.join(root, 'supabase/releases/README.md'));
  const readiness = fs.readFileSync(path.join(root, 'docs/production-readiness-2026-10-10.md'));
  const operations = ['install', 'activate', 'pause'].map(action => {
    const name = `${action}-channel-schedule.sql`;
    return [path.join('operations', name), fs.readFileSync(path.join(root, 'supabase/operations', name))];
  });
  const backupMaterials = [
    ['database-backup.md', fs.readFileSync(path.join(root, 'docs/database-backup.md'))],
    ...['backup-application-database.ps1', 'test-database-backup.ps1'].map(name =>
      [path.join('backup-tools', name), fs.readFileSync(path.join(root, 'scripts', name))]),
  ];
  const directory = path.join(root, '.tmp', 'database-release', `${release.manifest.release}-${digest(Buffer.concat([release.bytes, audit, readme, readiness, ...operations.map(([, content]) => content), ...backupMaterials.map(([, content]) => content)])).slice(0, 12)}`);
  // Only write our known files under the workspace. Never move/delete old SQL.
  for (const folder of [path.join(root, '.tmp'), path.dirname(directory), directory, path.join(directory, 'migrations'), path.join(directory, 'operations'), path.join(directory, 'backup-tools')]) {
    if (fs.existsSync(folder) && fs.lstatSync(folder).isSymbolicLink()) throw new Error('Export directory cannot be a link');
    fs.mkdirSync(folder, { recursive: true });
  }
  const files = release.migrations.map(m => [path.join('migrations', m.file), m.content]);
  files.push(['manifest.json', release.bytes]);
  files.push(['audit.sql', audit]);
  files.push(['README.md', readme]);
  files.push(['production-readiness.md', readiness]);
  files.push(...operations);
  files.push(...backupMaterials);
  for (const [name, content] of files) {
    const target = path.join(directory, name);
    if (fs.existsSync(target) && (fs.lstatSync(target).isSymbolicLink() || !fs.readFileSync(target).equals(content))) throw new Error(`Refusing to overwrite a changed export: ${name}`);
  }
  for (const [name, content] of files) fs.writeFileSync(path.join(directory, name), content);
  return directory;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && !['--check', '--export'].includes(args[0]))) throw new Error('Use --check or --export');
    const release = validateRelease();
    console.log(`Verified ${release.migrations.length} ordered migrations and SHA-256 checksums.`);
    if (args[0] === '--export') console.log(`Offline export: ${exportRelease(release)}`);
    console.log('This offline command does not inspect live history or schema. No database changes were made.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validateRelease, exportRelease };

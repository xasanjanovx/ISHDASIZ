#Requires -Version 7.0
[CmdletBinding()]
param([string]$PgBin = (Join-Path $PSScriptRoot '../.tmp/postgres-client-17.11/pgsql/bin'))
$ErrorActionPreference = 'Stop'
$testDirectory = Join-Path $PSScriptRoot ('../.tmp/backup-fixture-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDirectory | Out-Null
$testDirectory = (Resolve-Path -LiteralPath $testDirectory).Path
$clusterDirectory = Join-Path $testDirectory 'cluster'
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$fixturePort = $listener.LocalEndpoint.Port
$listener.Stop()
$started = $false
$fixtureConnection = @('--host', '127.0.0.1', '--port', [string]$fixturePort, '--username', 'postgres', '--no-password', '-X', '-A', '-t', '--set', 'ON_ERROR_STOP=1')

function Invoke-FixtureTool {
    param([string]$Tool, [string[]]$ToolArguments)
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = Join-Path $PgBin ($Tool + '.exe')
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    # A postmaster can inherit pg_ctl's output handles even with a log file.
    # Never wait for EOF from a pipe inherited by the long-running server.
    $capture = $Tool -ne 'pg_ctl'
    $info.RedirectStandardOutput = $capture
    $info.RedirectStandardError = $capture
    foreach ($argument in $ToolArguments) { $info.ArgumentList.Add($argument) }
    foreach ($key in @($info.Environment.Keys)) { if ($key.StartsWith('PG', [System.StringComparison]::OrdinalIgnoreCase)) { $info.Environment.Remove($key) | Out-Null } }
    $info.Environment['PGSSLMODE'] = 'disable'
    $info.Environment['PGCONNECT_TIMEOUT'] = '5'
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        $process.Start() | Out-Null
        if ($capture) {
            $stdout = $process.StandardOutput.ReadToEndAsync()
            $stderr = $process.StandardError.ReadToEndAsync()
        }
        if (-not $process.WaitForExit(120000)) { $process.Kill($true); throw 'Local fixture command timed out' }
        $output = $(if ($capture) { $stdout.GetAwaiter().GetResult() } else { '' })
        $errorText = $(if ($capture) { $stderr.GetAwaiter().GetResult() } else { 'See fixture postgres.log' })
        if ($process.ExitCode -ne 0) { throw ('Local fixture command failed: ' + $Tool + ': ' + $errorText) }
        return $output.Trim()
    } finally { $process.Dispose() }
}
function Get-FixtureFingerprint {
    param([string]$Database)
    $query = @'
SELECT jsonb_build_object(
 'users',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.users t),
 'jobs',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.jobs t),
 'resumes',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.resumes t),
 'history',(SELECT jsonb_agg(to_jsonb(t) ORDER BY version) FROM supabase_migrations.schema_migrations t),
 'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.users'::regclass),
 'anon_select',has_table_privilege('anon','public.users','SELECT'),
 'policies',(SELECT jsonb_agg(jsonb_build_object('name',policyname,'roles',roles,'qual',qual) ORDER BY policyname) FROM pg_policies WHERE schemaname='public' AND tablename='users'),
 'function',public.backup_fixture_function(),
 'function_access',(SELECT jsonb_build_object('definer',prosecdef,'config',proconfig) FROM pg_proc WHERE oid='public.backup_fixture_function()'::regprocedure),
 'sequence',(SELECT last_value FROM public.jobs_id_seq)
);
'@
    return Invoke-FixtureTool 'psql' ($fixtureConnection + @('--dbname', $Database, '--command', $query))
}
try {
    Invoke-FixtureTool 'initdb' @('--pgdata', $clusterDirectory, '--username=postgres', '--auth=trust', '--encoding=UTF8', '--no-locale') | Out-Null
    Invoke-FixtureTool 'pg_ctl' @('start', '--pgdata', $clusterDirectory, '--log', (Join-Path $testDirectory 'postgres.log'), '--options', "-h 127.0.0.1 -p $fixturePort", '--wait') | Out-Null
    $started = $true
    Invoke-FixtureTool 'psql' ($fixtureConnection + @('--dbname', 'postgres', '--command', 'CREATE DATABASE ishdasiz_backup_fixture;')) | Out-Null
    Invoke-FixtureTool 'psql' ($fixtureConnection + @('--dbname', 'postgres', '--command', 'CREATE DATABASE ishdasiz_backup_restored;')) | Out-Null
    $seed = @'
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.users(id uuid PRIMARY KEY, name text, password_hash text);
INSERT INTO public.users VALUES ('00000000-0000-4000-8000-000000000001','Тестовый соискатель / Oʻzbekiston','synthetic-only');
CREATE TABLE public.jobs(id serial PRIMARY KEY, title text, user_id uuid REFERENCES public.users);
INSERT INTO public.jobs(title,user_id) SELECT 'Работа / Ish',id FROM public.users;
CREATE TABLE public.resumes(id uuid PRIMARY KEY, user_id uuid REFERENCES public.users, is_public boolean);
INSERT INTO public.resumes SELECT '10000000-0000-4000-8000-000000000001',id,NULL FROM public.users;
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, name text, statements text[]);
INSERT INTO supabase_migrations.schema_migrations VALUES ('20260409034235','synthetic_history',ARRAY['SELECT 1']);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY closed_browser_access ON public.users FOR SELECT TO anon USING (false);
GRANT SELECT ON public.users TO anon;
CREATE FUNCTION public.backup_fixture_function() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT ''synthetic-function''';
'@
    $seedFile = Join-Path $testDirectory 'seed.sql'
    [System.IO.File]::WriteAllText($seedFile, $seed)
    Invoke-FixtureTool 'psql' ($fixtureConnection + @('--dbname', 'ishdasiz_backup_fixture', '--file', $seedFile)) | Out-Null
    $fingerprint = Get-FixtureFingerprint 'ishdasiz_backup_fixture'
    $backupOutput = @(& (Join-Path $PSScriptRoot 'backup-application-database.ps1') -PgBin $PgBin -Fixture -FixturePort $fixturePort)
    $saved = @($backupOutput | Where-Object { $_ -like 'Application database backup saved: *' })
    if ($saved.Count -ne 1) { throw 'Backup helper did not report a complete archive' }
    $backupDirectory = $saved[0].Substring('Application database backup saved: '.Length)
    $manifest = Get-Content -LiteralPath (Join-Path $backupDirectory 'manifest.json') -Raw | ConvertFrom-Json
    $archive = Join-Path $backupDirectory 'application.dump'
    if ($manifest.projectReference -ne 'local-synthetic-fixture' -or -not $manifest.archiveFullyReadable -or $manifest.restorationVerified) { throw 'Incorrect backup proof scope' }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sha256) { throw 'Archive checksum mismatch' }
    $acl = Get-Acl -LiteralPath $backupDirectory
    if (-not $acl.AreAccessRulesProtected -or $acl.Access.Count -ne 1) { throw 'Backup folder is not restricted to its owner' }
    # The new disposable database has an empty default public schema. The
    # archive contains its original definition, so remove only that empty one.
    Invoke-FixtureTool 'psql' ($fixtureConnection + @('--dbname', 'ishdasiz_backup_restored', '--command', 'DROP SCHEMA public;')) | Out-Null
    Invoke-FixtureTool 'pg_restore' @('--host', '127.0.0.1', '--port', [string]$fixturePort, '--username', 'postgres', '--no-password', '--dbname', 'ishdasiz_backup_restored', '--single-transaction', '--exit-on-error', $archive) | Out-Null
    if ((Get-FixtureFingerprint 'ishdasiz_backup_restored') -cne $fingerprint) { throw 'Restored rows, Unicode, RLS, grants, function or sequence differ' }
    $bytes = [System.IO.File]::ReadAllBytes($archive)
    $corruptArchive = Join-Path $testDirectory 'truncated.dump'
    [System.IO.File]::WriteAllBytes($corruptArchive, $bytes[0..([int]($bytes.Length / 2))])
    $corruptRejected = $false
    try { Invoke-FixtureTool 'pg_restore' @('--file=NUL', $corruptArchive) | Out-Null } catch { $corruptRejected = $true }
    if (-not $corruptRejected) { throw 'Truncated archive was not rejected' }
    Invoke-FixtureTool 'psql' ($fixtureConnection + @('--dbname', 'ishdasiz_backup_fixture', '--command', 'ALTER TABLE resumes RENAME TO missing_resumes;')) | Out-Null
    $missingRejected = $false
    try { & (Join-Path $PSScriptRoot 'backup-application-database.ps1') -PgBin $PgBin -Fixture -FixturePort $fixturePort | Out-Null } catch { $missingRejected = $_.Exception.Message -like "*stage 'metadata'*" }
    if (-not $missingRejected) { throw 'Backup did not reject the wrong application schema' }
    $proof = @{fixtureOnly=$true; productionContacted=$false; restoredRowsAndAccess=$true; archiveCorruptionRejected=$true; missingSchemaRejected=$true; ownerOnlyAccess=$true; archiveSha256=$manifest.sha256}
    $proof | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testDirectory 'verification.json') -Encoding utf8NoBOM
    Write-Output "Local backup/restore checks passed. Proof: $testDirectory"
} finally {
    if ($started) { Invoke-FixtureTool 'pg_ctl' @('stop', '--pgdata', $clusterDirectory, '--mode=fast', '--wait') | Out-Null }
}

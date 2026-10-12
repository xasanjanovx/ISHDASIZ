#Requires -Version 7.0
[CmdletBinding()]
param(
    [string]$PgBin = (Join-Path $PSScriptRoot '../.tmp/postgres-client-17.11/pgsql/bin'),
    [ValidateRange(1024, 65535)][int]$FixturePort = 55439,
    [switch]$Fixture
)
$ErrorActionPreference = 'Stop'
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$backupRoot = Join-Path $workspace 'private-backups'
$connectionHost = 'aws-1-ap-south-1.pooler.supabase.com'
$connectionUser = 'postgres.awkjrolplhvrscuqqive'
$connectionPort = 5432
$connectionDatabase = 'postgres'
$projectReference = 'awkjrolplhvrscuqqive'
if ($Fixture) {
    $connectionHost = '127.0.0.1'
    $connectionUser = 'postgres'
    $connectionPort = $FixturePort
    $connectionDatabase = 'ishdasiz_backup_fixture'
    $projectReference = 'local-synthetic-fixture'
}
$toolPaths = @{}
foreach ($tool in @('pg_dump', 'pg_restore', 'psql')) {
    $toolPath = Join-Path $PgBin ($tool + '.exe')
    if (-not (Test-Path -LiteralPath $toolPath -PathType Leaf)) {
        throw "Missing PostgreSQL tool: $tool. See docs/database-backup.md."
    }
    $toolPaths[$tool] = [System.IO.Path]::GetFullPath($toolPath)
}

# Only new, task-owned directories are restricted. Existing files are untouched.
$backupDirectory = Join-Path $backupRoot ((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ') + '-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backupDirectory | Out-Null
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$security = [System.Security.AccessControl.DirectorySecurity]::new()
$security.SetOwner($identity)
$security.SetAccessRuleProtection($true, $false)
$security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new(
    $identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
Set-Acl -LiteralPath $backupDirectory -AclObject $security

$script:backupPassword = $null
$securePassword = $null
$passwordPointer = [IntPtr]::Zero
$stage = 'password'
function Invoke-BackupTool {
    param([string]$Tool, [string[]]$ToolArguments, [string]$LogName)
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $toolPaths[$Tool]
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in $ToolArguments) { $start.ArgumentList.Add($argument) }
    # Ignore inherited PG service/password/connection overrides.
    foreach ($key in @($start.Environment.Keys)) {
        if ($key.StartsWith('PG', [System.StringComparison]::OrdinalIgnoreCase)) { $start.Environment.Remove($key) | Out-Null }
    }
    $start.Environment['PGCONNECT_TIMEOUT'] = '15'
    $start.Environment['PGSSLMODE'] = $(if ($Fixture) { 'disable' } else { 'require' })
    $start.Environment['PGOPTIONS'] = '-c default_transaction_read_only=on -c statement_timeout=900000'
    $start.Environment['PGAPPNAME'] = 'ishdasiz-readonly-backup'
    if ($null -ne $script:backupPassword) { $start.Environment['PGPASSWORD'] = $script:backupPassword }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        if (-not $process.Start()) { throw 'Could not start PostgreSQL tool' }
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(1200000)) {
            $process.Kill($true)
            $process.WaitForExit()
            throw 'PostgreSQL tool exceeded backup deadline'
        }
        $output = $outputTask.GetAwaiter().GetResult()
        $errorText = $errorTask.GetAwaiter().GetResult()
        [System.IO.File]::WriteAllText((Join-Path $backupDirectory $LogName), $errorText)
        if ($process.ExitCode -ne 0) { throw "PostgreSQL tool failed; see protected $LogName" }
        return $output.Trim()
    } finally { $process.Dispose() }
}

try {
    if (-not $Fixture) {
        $securePassword = Read-Host 'Existing Supabase database password (hidden; not the API key)' -AsSecureString
        $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        $script:backupPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        if ([string]::IsNullOrEmpty($script:backupPassword)) { throw 'Database password is required' }
    }
    $connection = @('--host', $connectionHost, '--port', [string]$connectionPort,
        '--username', $connectionUser, '--dbname', $connectionDatabase, '--no-password')
    $stage = 'metadata'
    $metadataSql = "SELECT json_build_object('server_version',current_setting('server_version_num'),'database',current_database(),'role',current_user,'users',to_regclass('public.users') IS NOT NULL,'jobs',to_regclass('public.jobs') IS NOT NULL,'resumes',to_regclass('public.resumes') IS NOT NULL,'history',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL);"
    $metadata = (Invoke-BackupTool 'psql' ($connection + @('-X', '-A', '-t', '--set', 'ON_ERROR_STOP=1', '--command', $metadataSql)) 'metadata.stderr.log') | ConvertFrom-Json
    if ($metadata.database -ne $connectionDatabase -or $metadata.role -ne 'postgres' -or
        -not $metadata.users -or -not $metadata.jobs -or -not $metadata.resumes -or -not $metadata.history) {
        throw 'Expected application database relations are unavailable'
    }
    $dumpVersion = Invoke-BackupTool 'pg_dump' @('--version') 'version.stderr.log'
    if ($dumpVersion -notmatch 'PostgreSQL\) (\d+)\.' -or [int]$Matches[1] -lt [math]::Floor([int]$metadata.server_version / 10000)) {
        throw 'pg_dump must support the server major version'
    }
    $archive = Join-Path $backupDirectory 'application.dump'
    $stage = 'dump'
    Invoke-BackupTool 'pg_dump' ($connection + @('--format=custom', '--quote-all-identifiers',
        '--schema=public', '--schema=supabase_migrations', '--strict-names', '--lock-wait-timeout=10s', '--file', $archive)) 'dump.stderr.log' | Out-Null
    $script:backupPassword = $null
    $stage = 'archive-validation'
    $contents = Invoke-BackupTool 'pg_restore' @('--list', $archive) 'archive-list.stderr.log'
    foreach ($required in @('TABLE DATA public users', 'TABLE DATA public jobs', 'TABLE DATA public resumes', 'TABLE DATA supabase_migrations schema_migrations')) {
        if (-not $contents.Contains($required)) { throw 'Backup archive lacks a required relation' }
    }
    # Decode every archive entry to the Windows null device without connecting.
    Invoke-BackupTool 'pg_restore' @('--file=NUL', $archive) 'archive-read.stderr.log' | Out-Null
    $archiveFile = Get-Item -LiteralPath $archive
    $manifest = [ordered]@{
        format = 1; projectReference = $projectReference; createdUtc = [DateTime]::UtcNow.ToString('o')
        scope = @('public', 'supabase_migrations'); serverVersion = $metadata.server_version
        clientVersion = $dumpVersion; archive = 'application.dump'; bytes = $archiveFile.Length
        sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        archiveFullyReadable = $true; restorationVerified = $false
        excludes = @('auth schema', 'storage schema and object files', 'Vault encryption root key', 'global roles', 'hosting and Telegram settings')
    }
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $backupDirectory 'manifest.json') -Encoding utf8NoBOM
    Write-Output "Application database backup saved: $backupDirectory"
    Write-Output 'Archive decoded successfully. A separate restore test is still required.'
} catch {
    @{stage = $stage; complete = $false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupDirectory 'incomplete.json') -Encoding utf8NoBOM
    throw "Application backup incomplete at stage '$stage'. Files are preserved in: $backupDirectory"
} finally {
    $script:backupPassword = $null
    if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
    if ($null -ne $securePassword) { $securePassword.Dispose() }
}

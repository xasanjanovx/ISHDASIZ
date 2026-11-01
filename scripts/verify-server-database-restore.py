"""Restore a private archive into a new, network-isolated ISHDASIZ test DB.

The target must be a task-owned Supabase PostgreSQL 17 container, with cron
disabled and no network. Production or shared database names are rejected.
"""
import argparse
import hashlib
import json
import os
import pathlib
import re
import subprocess


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--backup-directory', type=pathlib.Path, required=True)
    parser.add_argument('--container', required=True)
    parser.add_argument('--resume-after-data', action='store_true',
                        help='Resume a recorded failure after a successful data restore')
    args = parser.parse_args()
    os.umask(0o077)
    require(args.container.startswith('ishdasiz-db-restore-'), 'isolated restore container name required')
    folder = args.backup_directory
    manifest = json.loads((folder / 'manifest.json').read_text())
    require(manifest['project'] == 'awkjrolplhvrscuqqive', 'expected source project required')
    metadata = json.loads(subprocess.check_output(['docker', 'inspect', args.container]))[0]
    require(metadata['HostConfig']['NetworkMode'] == 'none', 'target network must be disabled')
    require(not metadata['HostConfig']['PortBindings'], 'target must not publish ports')
    require(metadata['Config']['Labels'].get('com.ishdasiz.purpose') == 'database-restore', 'task-owned target required')
    archive = folder / manifest['archive']
    digest = hashlib.sha256()
    with archive.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    require(digest.hexdigest() == manifest['sha256'], 'archive checksum mismatch')
    base = ['docker', 'exec', '-i', args.container]
    phase = 'preflight'

    def sql(statement, database='postgres', name='restore.sql.stderr.log', output=False):
        with (folder / name).open('w') as log:
            result = subprocess.run(base + ['psql', '-X', '-q', '-A', '-t', '-U', 'supabase_admin',
                                           '-d', database, '-v', 'ON_ERROR_STOP=1'],
                                    input=statement, text=True, capture_output=False,
                                    stdout=subprocess.PIPE, stderr=log, timeout=120)
        if result.returncode:
            raise RuntimeError('SQL verification failed; inspect protected log')
        return result.stdout.strip() if output else None

    try:
        require(sql("SELECT current_setting('cron.launch_active_jobs')", output=True) == 'off', 'cron must be disabled')
        if args.resume_after_data:
            failure = json.loads((folder / 'restore-incomplete.json').read_text())
            require(failure['phase'] in ('vault-rekey', 'counts'), 'resume requires a recorded post-data failure')
        existing = json.loads(sql('SELECT json_agg(rolname) FROM pg_roles', output=True))
        roles = (folder / 'roles-no-passwords.sql').read_text()
        lines = []
        for line in roles.splitlines():
            match = re.match(r'^CREATE ROLE (?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*));$', line)
            if match and (match[1] or match[2]) in existing:
                continue
            lines.append(line)
        phase = 'roles'
        sql('BEGIN;\n' + '\n'.join(lines) + '\nCOMMIT;', name='restore-roles.stderr.log')
        exists = sql("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='restore_verify')", output=True)
        if exists == 'f':
            sql('CREATE DATABASE restore_verify WITH TEMPLATE template0 OWNER supabase_admin;')
        # pg_cron only permits its configured database. Change this isolated
        # instance, never a source/shared cluster, before loading the extension.
        configured = sql("SELECT current_setting('cron.database_name')", output=True)
        if configured != 'restore_verify':
            sql("ALTER SYSTEM SET cron.database_name='restore_verify';")
            subprocess.run(['docker', 'restart', '--time', '30', args.container],
                           stdout=subprocess.DEVNULL, check=True, timeout=45)
            import time
            for attempt in range(45):
                ready = subprocess.run(base + ['pg_isready', '-U', 'supabase_admin'],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if ready.returncode == 0:
                    break
                time.sleep(1)
            else:
                raise RuntimeError('isolated target did not restart')
        if not args.resume_after_data:
            empty = sql("SELECT count(*) FROM pg_tables WHERE schemaname NOT IN('pg_catalog','information_schema') AND schemaname NOT LIKE 'pg_toast%'", database='restore_verify', output=True)
            require(empty == '0', 'restore target already contains non-system tables')
            phase = 'restore'
            print(json.dumps({'phase': phase, 'container': args.container}), flush=True)
            with archive.open('rb') as stream, (folder / 'restore.stderr.log').open('w') as log:
                subprocess.run(base + ['pg_restore', '--exit-on-error', '--single-transaction',
                                       '--dbname=restore_verify', '--username=supabase_admin'],
                               stdin=stream, stdout=subprocess.DEVNULL, stderr=log,
                               check=True, timeout=1200)
        phase = 'vault-rekey'

        def literal(value):
            return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"

        secrets = json.loads((folder / 'vault-logical-secrets.json').read_text()) or []
        # Vault 0.3.1 update_secret first decrypts the old ciphertext, which
        # requires the platform's unavailable root key. Re-encrypt the separately
        # exported cleartext with the target's native primitive, preserving IDs
        # and metadata. This formula matches this pinned extension's create_secret.
        require(sql("SELECT extversion FROM pg_extension WHERE extname='supabase_vault'",
                    database='restore_verify', output=True) == '0.3.1', 'Vault 0.3.1 required for the verified rekey formula')
        for secret in secrets:
            sql("UPDATE vault.secrets s SET secret=encode(vault._crypto_aead_det_encrypt("
                "message:=convert_to(" + literal(secret['secret']) + ",'utf8'),"
                "additional:=convert_to(s.id::text,'utf8'),key_id:=0,"
                "context:='pgsodium'::bytea,nonce:=s.nonce),'base64') "
                "WHERE id=" + literal(secret['id']) + '::uuid;',
                database='restore_verify', name='vault-rekey.stderr.log')
        phase = 'counts'
        counts = json.loads(sql("""SELECT json_object_agg(schemaname||'.'||tablename,
         ((xpath('/row/n/text()',query_to_xml(format('SELECT count(*) AS n FROM %I.%I',schemaname,tablename),false,true,'')))[1]::text)::bigint)
         FROM pg_tables WHERE schemaname NOT IN('pg_catalog','information_schema') AND schemaname NOT LIKE 'pg_toast%'""",
                                database='restore_verify', name='restore-counts.stderr.log', output=True))
        data_tables = [schema.strip('"') + '.' + table.strip('"') for schema, table in re.findall(
            r'(?m)^\d+;\s+\d+\s+\d+\s+TABLE DATA (\S+) (\S+) ', (folder / 'archive-toc.list').read_text())]
        expected = manifest['table_counts']
        differences = {name: {'snapshot': expected.get(name), 'restored': counts.get(name)}
                       for name in data_tables if expected.get(name) != counts.get(name)}
        require(not differences, 'restored counts differ from the snapshot')
        require(set(name for name in expected if name.startswith(('public.', 'auth.'))) <= set(data_tables), 'all public/Auth tables must be covered')
        decrypted = json.loads(sql("SELECT coalesce(json_object_agg(id::text,decrypted_secret),'{}'::json) FROM vault.decrypted_secrets",
                                   database='restore_verify', name='vault-verify.stderr.log', output=True))
        require(all(decrypted.get(secret['id']) == secret['secret'] for secret in secrets), 'Vault cleartext verification failed')
        state = json.loads(sql("""SELECT json_build_object('server_version',current_setting('server_version'),
         'shared_buffers',current_setting('shared_buffers'),'work_mem',current_setting('work_mem'),
         'max_connections',current_setting('max_connections'),'cron_enabled',current_setting('cron.launch_active_jobs'),
         'database_bytes',pg_database_size(current_database()),
         'claim_index_valid',(SELECT indisvalid FROM pg_index WHERE indexrelid='public.ishdasiz_sync_claim_order_idx'::regclass))""",
                              database='restore_verify', output=True))
        report = {'restoration_verified': True, 'container': args.container,
                  'verified_data_tables': len(data_tables), 'count_differences': differences,
                  'excluded_extension_tables': sorted(set(expected) - set(data_tables)),
                  'vault_rekeyed': len(secrets), 'settings': state,
                  'network': 'none', 'production': False, 'archive_sha256': manifest['sha256']}
        (folder / 'restore-verification.json').write_text(json.dumps(report, indent=2))
        manifest['restoration_verified'] = True
        manifest['restore_report'] = 'restore-verification.json'
        (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        failure_file = folder / 'restore-incomplete.json'
        if failure_file.exists():
            recovered = json.loads(failure_file.read_text())
            recovered['recovered'] = True
            (folder / 'restore-recovered.json').write_text(json.dumps(recovered, indent=2))
            failure_file.unlink()
        for private_file in folder.iterdir():
            if private_file.is_file():
                private_file.chmod(0o600)
        print(json.dumps(report), flush=True)
    except Exception as exc:
        (folder / 'restore-incomplete.json').write_text(json.dumps({'phase': phase, 'error_type': type(exc).__name__}))
        print(json.dumps({'phase': 'restore_incomplete', 'failed_stage': phase, 'error_type': type(exc).__name__}), flush=True)
        raise SystemExit(1) from None


if __name__ == '__main__':
    main()

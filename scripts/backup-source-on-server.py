"""Consistent private PostgreSQL backup using an existing Docker client image.

Run on the Linux deployment host. Source credentials are JSON in a root-only
file, never command-line arguments. No source schema or data is modified.
"""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import secrets
import subprocess
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--credential-file', type=pathlib.Path, required=True)
    parser.add_argument('--output-root', type=pathlib.Path, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    credentials = json.loads(args.credential_file.read_text())
    if args.credential_file.stat().st_mode & 0o077:
        raise RuntimeError('source credential file must be owner-only')
    valid_endpoint = (credentials['host'] == 'db.awkjrolplhvrscuqqive.supabase.co' and credentials['user'] == 'postgres') or (
        credentials['host'] == 'aws-1-ap-south-1.pooler.supabase.com' and credentials['user'] == 'postgres.awkjrolplhvrscuqqive')
    if not valid_endpoint or credentials['database'] != 'postgres' or credentials['port'] != 5432:
        raise RuntimeError('expected ISHDASIZ direct/session endpoint required')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output = args.output_root / (stamp + '-' + secrets.token_hex(4))
    output.mkdir(mode=0o700, parents=True, exist_ok=False)
    image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', 'postgres:17-alpine']))[0]['Id']
    environment = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    environment.update(PGHOST=credentials['host'], PGPORT=str(credentials['port']),
                       PGUSER=credentials['user'], PGDATABASE=credentials['database'],
                       PGPASSWORD=credentials['password'], PGSSLMODE='require',
                       PGCONNECT_TIMEOUT='15', PGAPPNAME='ishdasiz-consistent-backup',
                       PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=900000 -c idle_in_transaction_session_timeout=900000')
    common = ['docker', 'run', '--rm', '-i', '--memory', '256m', '--cpus', '0.5',
              '--pids-limit', '64', '--log-driver', 'local', '--log-opt', 'max-size=1m',
              '--log-opt', 'max-file=2', '-v', str(output) + ':/backup']
    for key in environment:
        if key.startswith('PG'):
            common += ['-e', key]
    common += [image]
    holder = None
    phase = 'snapshot'
    try:
        stderr = (output / 'snapshot.stderr.log').open('w')
        holder = subprocess.Popen(common + ['psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'],
                                  env=environment, stdin=subprocess.PIPE,
                                  stdout=subprocess.DEVNULL, stderr=stderr, text=True)
        script = r"""BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT pg_export_snapshot() \g /backup/snapshot.txt
SELECT json_build_object('server_version',current_setting('server_version'),
 'database',current_database(),'role',current_user,'started_at',transaction_timestamp(),
 'tables',(SELECT json_object_agg(schemaname||'.'||tablename,
  ((xpath('/row/n/text()',query_to_xml(format('SELECT count(*) AS n FROM %I.%I',schemaname,tablename),false,true,'')))[1]::text)::bigint)
 FROM pg_tables WHERE schemaname NOT IN('pg_catalog','information_schema') AND schemaname NOT LIKE 'pg_toast%'),
 'extensions',(SELECT json_agg(json_build_object('name',extname,'version',extversion)) FROM pg_extension),
 'vault_secret_count',(SELECT count(*) FROM vault.secrets),
 'storage_object_count',(SELECT count(*) FROM storage.objects)) \g /backup/source-inventory.json
SELECT json_agg(json_build_object('id',id,'name',name,'description',description,'secret',decrypted_secret)) FROM vault.decrypted_secrets \g /backup/vault-logical-secrets.json
SELECT 'ready' \g /backup/snapshot-ready.txt
"""
        holder.stdin.write(script)
        holder.stdin.flush()
        deadline = time.monotonic() + 120
        while not (output / 'snapshot-ready.txt').exists():
            if holder.poll() is not None:
                raise RuntimeError('snapshot connection failed; see protected log')
            if time.monotonic() >= deadline:
                raise RuntimeError('snapshot metadata deadline exceeded')
            time.sleep(0.25)
        snapshot = (output / 'snapshot.txt').read_text().strip()
        if not snapshot or not all(character in '0123456789ABCDEFabcdef-' for character in snapshot):
            raise RuntimeError('invalid exported snapshot identifier')
        inventory = json.loads((output / 'source-inventory.json').read_text())
        if not all(name in inventory['tables'] for name in ('public.jobs', 'public.users', 'auth.users')):
            raise RuntimeError('expected application/Auth tables required')
        print(json.dumps({'phase': 'dump', 'directory': str(output), 'tables': len(inventory['tables'])}), flush=True)

        def run(tool_args, log_name, stdout=subprocess.DEVNULL):
            with (output / log_name).open('w') as log:
                subprocess.run(common + tool_args, env=environment, stdout=stdout,
                               stderr=log, check=True, timeout=1200)

        phase = 'dump'
        run(['pg_dump', '--no-password', '--format=custom', '--compress=6',
             '--quote-all-identifiers', '--lock-wait-timeout=10s', '--snapshot=' + snapshot,
             '--file=/backup/database.dump'], 'dump.stderr.log')
        holder.stdin.write('ROLLBACK;\n\\q\n')
        holder.stdin.close()
        holder.wait(timeout=30)
        if holder.returncode != 0:
            raise RuntimeError('snapshot holder did not exit cleanly')
        stderr.close()
        phase = 'roles'
        run(['pg_dumpall', '--roles-only', '--no-role-passwords', '--no-password',
             '--file=/backup/roles-no-passwords.sql'], 'roles.stderr.log')
        phase = 'archive-validation'
        with (output / 'archive-toc.list').open('w') as listing:
            run(['pg_restore', '--list', '/backup/database.dump'], 'list.stderr.log', listing)
        run(['pg_restore', '--file=/dev/null', '/backup/database.dump'], 'decode.stderr.log')
        digest = hashlib.sha256()
        with (output / 'database.dump').open('rb') as archive:
            for chunk in iter(lambda: archive.read(1024 * 1024), b''):
                digest.update(chunk)
        manifest = {'project': 'awkjrolplhvrscuqqive', 'created_utc': stamp,
                    'archive': 'database.dump', 'bytes': (output / 'database.dump').stat().st_size,
                    'sha256': digest.hexdigest(), 'consistent_snapshot': True,
                    'archive_fully_readable': True, 'restoration_verified': False,
                    'table_counts': inventory['tables'], 'client_image_id': image,
                    'scope': 'all dumpable database schemas, extension configuration data and Auth',
                    'separate_files': ['roles-no-passwords.sql', 'vault-logical-secrets.json'],
                    'excludes': ['global role passwords', 'platform settings', 'Storage object bytes', 'platform log history']}
        (output / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        for private_file in output.iterdir():
            if private_file.is_file():
                private_file.chmod(0o600)
        print(json.dumps({'phase': 'backup_complete', 'directory': str(output),
                          'bytes': manifest['bytes'], 'sha256': manifest['sha256'],
                          'tables': len(manifest['table_counts']),
                          'restoration_verified': False}), flush=True)
    except Exception as exc:
        (output / 'incomplete.json').write_text(json.dumps({'phase': phase, 'complete': False, 'error_type': type(exc).__name__}))
        print(json.dumps({'phase': 'backup_incomplete', 'failed_stage': phase,
                          'directory': str(output), 'error_type': type(exc).__name__}), flush=True)
        raise SystemExit(1) from None
    finally:
        if holder is not None and holder.poll() is None:
            holder.stdin.close()
            try:
                holder.wait(timeout=15)
            except subprocess.TimeoutExpired:
                holder.terminate()
                holder.wait(timeout=15)


if __name__ == '__main__':
    main()

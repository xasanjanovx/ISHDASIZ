"""Activate the private backend on the verified restore's dedicated volumes.

This release-specific operator runs on the deployment host, never against the
cloud database. Public DNS/TLS, Vercel and bot transport are separate cutover steps.
"""
import json,os,pathlib,subprocess,sys
if not sys.platform.startswith('linux') or os.geteuid()!=0:
    raise SystemExit('Run as root on the verified Linux deployment host')
os.umask(0o077)
folder=pathlib.Path('/opt/ishdasiz-server/backend-20261101')
state=pathlib.Path('/opt/ishdasiz-server/state')
container='ishdasiz-db-restore-20261101'
metadata=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
if metadata['HostConfig']['NetworkMode']!='none' or metadata['Config']['Labels'].get('com.ishdasiz.purpose')!='database-restore':
    raise SystemExit('expected private verified source clone required')
base=['docker','exec','-i',container,'psql','-X','-q','-A','-t','-U','supabase_admin','-d','restore_verify','-v','ON_ERROR_STOP=1']
def sql(text,name):
    with (state/name).open('w') as log:
        r=subprocess.run(base,input=text,text=True,stdout=subprocess.PIPE,stderr=log,timeout=90)
    if r.returncode:raise SystemExit('private SQL setup failed: '+name)
    return r.stdout.strip()
literal=lambda value:"'"+value.replace("'","''")+"'"
progress=state/'backend-schema-ready-20261101.json'
if not progress.exists():
    if metadata['State']['Status']!='running':
        raise SystemExit('Initial schema setup needs the running private restore container')
    for filename in ['20261027090000_main_employer_channel.sql','20261030120000_mini_app_integration.sql','20261101123718_self_hosted_public_api_boundary.sql']:
        version=filename.split('_',1)[0]
        if sql('SELECT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='+literal(version)+')','backend-history-check.log')=='t':continue
        original=(folder/'migrations'/filename).read_text(encoding='utf-8-sig')
        head,tail=original.rsplit('COMMIT;',1)
        if tail.strip():raise SystemExit('unexpected migration trailing content')
        name=filename[len(version)+1:-4]
        recorded=head+'\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('+literal(version)+','+literal(name)+',ARRAY['+literal(original)+']);\nCOMMIT;\n'
        sql(recorded,'backend-migration-'+version+'.log')
        print(json.dumps({'phase':'private_migration_applied','version':version}),flush=True)
    keys=json.loads(pathlib.Path('/etc/ishdasiz-server/backend-keys.json').read_text())
    sql('ALTER ROLE authenticator WITH LOGIN PASSWORD '+literal(keys['authenticator_password'])+';\nALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '+literal(keys['auth_password'])+';','backend-roles.log')
    progress.write_text(json.dumps({'schema_and_role_setup_complete':True,'data_volume':'ishdasiz-db-restore-20261101-data'}))
else:
    saved=json.loads(progress.read_text())
    if saved.get('data_volume')!='ishdasiz-db-restore-20261101-data' or not saved.get('schema_and_role_setup_complete'):
        raise SystemExit('Unexpected backend progress record')
config=['docker','compose','--env-file','/etc/ishdasiz-server/backend.config.env','-f',str(folder/'deploy'/'compose.data.yaml')]
model=json.loads(subprocess.check_output(config+['config','--format','json']))
if model['name']!='ishdasiz-data' or model['volumes']['db-data']['name']!='ishdasiz-db-restore-20261101-data' or model['volumes']['db-config']['name']!='ishdasiz-db-restore-20261101-config':
    raise SystemExit('Compose must use only the verified dedicated volumes')
if not model['networks']['backend'].get('internal') or any(model['services'][name].get('ports') for name in ('db','rest','auth')):
    raise SystemExit('Database and provider services must remain private')
if any(port.get('host_ip')!='127.0.0.1' for port in model['services']['gateway']['ports']):
    raise SystemExit('Gateway must bind only to loopback')
with (state/'backend-compose-check.log').open('w') as log:
    subprocess.run(config+['config','--quiet'],stdout=log,stderr=log,check=True,timeout=30)
# Never allow two PostgreSQL processes to open this data volume.
consumers=subprocess.check_output(['docker','ps','--filter','volume=ishdasiz-db-restore-20261101-data','--format','{{.Names}}'],text=True).split()
if len(consumers)>1 or any(name not in (container,'ishdasiz-data-db-1') for name in consumers):
    raise SystemExit('Unexpected running consumer of the database volume')
subprocess.run(['docker','stop','--time','45',container],stdout=subprocess.DEVNULL,check=True,timeout=60)
print(json.dumps({'phase':'starting_private_backend'}),flush=True)
with (state/'backend-compose-start.log').open('w') as log:
    result=subprocess.run(config+['up','-d','--wait','--wait-timeout','100'],stdout=log,stderr=log,timeout=150)
if result.returncode:
    print(json.dumps({'phase':'backend_start_failed','exit_code':result.returncode}),flush=True)
    raise SystemExit(1)
print(json.dumps({'phase':'private_backend_started','bind':'127.0.0.1:3150'}),flush=True)

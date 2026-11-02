"""Restore the final fenced-source archive while retaining the previous clone.

Plan is read-only. Execute is confined to the unpublished, dedicated ISHDASIZ
containers and volumes; the previous database is renamed, never deleted.
"""
import argparse,datetime,json,os,pathlib,subprocess,sys

def main():
    if not sys.platform.startswith('linux') or os.geteuid()!=0:raise SystemExit('Linux deployment host/root required')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup-directory',type=pathlib.Path)
    parser.add_argument('--execute',action='store_true')
    args=parser.parse_args();os.umask(0o077)
    root=pathlib.Path('/opt/ishdasiz-server');state=root/'state'
    current='ishdasiz-data-db-1';isolated='ishdasiz-db-restore-20261101'
    def require(value,message):
        if not value:raise RuntimeError(message)
    def sql(text,database='restore_verify',container=current):
        with (state/'final-restore-sql-20261102.log').open('w') as log:
            result=subprocess.run(['docker','exec','-i',container,'psql','-XqAt','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'],input=text,text=True,stdout=subprocess.PIPE,stderr=log,timeout=120)
        require(result.returncode==0,'Destination SQL operation failed; inspect protected log')
        return result.stdout.strip()
    require(not json.loads((state/'private-backend-state-20261101.json').read_text()).get('public_cutover'),'Destination already promoted')
    consumers=subprocess.check_output(['docker','ps','--filter','volume=ishdasiz-db-restore-20261101-data','--format','{{.Names}}'],text=True).split()
    require(consumers==[current],'Only the dedicated API database may own the target volume')
    counts=json.loads(sql("SELECT json_build_object('users',(SELECT count(*) FROM public.users),'jobs',(SELECT count(*) FROM public.jobs),'resumes',(SELECT count(*) FROM public.resumes),'records',(SELECT count(*) FROM public.mini_app_records),'orders',(SELECT count(*) FROM public.mini_app_channel_orders));"))
    require(counts=={'users':684,'jobs':52361,'resumes':131,'records':0,'orders':0},'Destination has unexpected new business data; reconcile before refresh')
    require(sql("SELECT NOT EXISTS(SELECT 1 FROM pg_database WHERE datname='before_cutover_20261102');",database='postgres')=='t','Previous snapshot database name is already in use')
    print(json.dumps({'phase':'refresh_preflight_passed','previous_clone':counts,'previous_database_will_be_retained':True}),flush=True)
    if not args.execute:return
    require(args.backup_directory is not None,'Final backup directory required')
    folder=args.backup_directory.resolve()
    require(folder.parent==(root/'private-backups').resolve(),'Backup must be an immediate protected backup directory')
    manifest=json.loads((folder/'manifest.json').read_text())
    require(manifest['project']=='awkjrolplhvrscuqqive' and manifest.get('archive_fully_readable') and manifest.get('consistent_snapshot'),'Verified source archive required')
    created=datetime.datetime.strptime(manifest['created_utc'],'%Y%m%dT%H%M%SZ').replace(tzinfo=datetime.timezone.utc)
    require(0<=(datetime.datetime.now(datetime.timezone.utc)-created).total_seconds()<3600,'Fresh final archive required')
    require(manifest['table_counts'].get('ishdasiz_cutover.state')==1,'Source fence must be included in the final snapshot')
    paused=json.loads((state/'source-cutover-20261102.json').read_text())
    require(paused['phase']=='source_paused','Source must remain fenced')
    inventory=json.loads((folder/'source-inventory.json').read_text())
    snapshot_started=datetime.datetime.fromisoformat(inventory['started_at'])
    require(datetime.datetime.fromisoformat(paused['fenced_at'])<=snapshot_started,'Archive snapshot predates the source fence')
    for name in ['verify-server-database-restore.py','activate-private-backend.py','remove-target-cutover-fence.sql']:
        require((state/name).is_file(),'Missing verified destination operator: '+name)
    compose=['docker','compose','--env-file','/etc/ishdasiz-server/backend.config.env','-f',str(root/'backend-20261101/deploy/compose.data.yaml')]
    report={'phase':'stopping_private_consumers','backup_directory':str(folder),'public_cutover':False}
    progress=state/'final-refresh-20261102.json'
    def record():progress.write_text(json.dumps(report,indent=2));progress.chmod(0o600)
    record()
    with (state/'final-refresh-services-20261102.log').open('w') as log:
        subprocess.run(['docker','stop','--time','60','ishdasiz-web-1'],stdout=log,stderr=log,check=True)
        subprocess.run(compose+['stop','gateway','auth','rest'],stdout=log,stderr=log,check=True)
        sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='restore_verify' AND pid<>pg_backend_pid();",database='postgres')
        sql('ALTER DATABASE restore_verify RENAME TO before_cutover_20261102;',database='postgres')
        subprocess.run(compose+['stop','db'],stdout=log,stderr=log,check=True)
        require(not subprocess.check_output(['docker','ps','--filter','volume=ishdasiz-db-restore-20261101-data','--format','{{.Names}}'],text=True).strip(),'Data volume still has a running consumer')
        subprocess.run(['docker','start',isolated],stdout=log,stderr=log,check=True)
    report['phase']='isolated_restore';record()
    import time
    for _ in range(45):
        if subprocess.run(['docker','exec',isolated,'pg_isready','-U','supabase_admin'],capture_output=True).returncode==0:break
        time.sleep(1)
    else:raise RuntimeError('Isolated database not ready')
    with (state/'final-refresh-restore-20261102.log').open('w') as log:
        subprocess.run(['python3',str(state/'verify-server-database-restore.py'),'--backup-directory',str(folder),'--container',isolated],stdout=log,stderr=log,check=True,timeout=1500)
    restored=json.loads((folder/manifest.get('restore_report','restore-verification.json')).read_text())
    require(restored.get('restoration_verified'),'Restore verification missing')
    sql((state/'remove-target-cutover-fence.sql').read_text(),container=isolated)
    marker=state/'backend-schema-ready-20261101.json'
    saved=state/'backend-schema-before-final-refresh-20261102.json'
    require(not saved.exists(),'Schema rollback record already exists')
    marker.replace(saved)
    report['phase']='activating_refreshed_backend';record()
    with (state/'final-refresh-activation-20261102.log').open('w') as log:
        subprocess.run(['python3',str(state/'activate-private-backend.py')],stdout=log,stderr=log,check=True,timeout=240)
    report['phase']='verified_fresh_backend_started';report['source_counts']=manifest['table_counts'];record()
    print(json.dumps({'phase':report['phase'],'previous_database':'before_cutover_20261102','archive_sha256':manifest['sha256'],'public_cutover':False}),flush=True)

if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps({'refresh_failed':True,'error_type':type(error).__name__,'details':'Protected final-refresh logs contain the stage; source must remain fenced until recovery or explicit rollback'}))
        raise SystemExit(1) from None

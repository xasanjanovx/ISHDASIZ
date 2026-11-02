"""Pause/resume only the verified ISHDASIZ source and Telegram delivery.

Requires the installed, disabled source fence and protected production webhook
configuration. Never drops Telegram updates or changes source application rows.
"""
import argparse,datetime,json,os,pathlib,subprocess,sys,urllib.request

def main():
    if not sys.platform.startswith('linux') or os.geteuid()!=0:
        raise SystemExit('Run on the verified deployment host as root')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['inspect','pause','resume'])
    action=parser.parse_args().action
    os.umask(0o077)
    state=pathlib.Path('/opt/ishdasiz-server/state')
    journal=state/'source-cutover-20261102.json'
    credentials=json.loads(pathlib.Path('/etc/ishdasiz-server/source-database.json').read_text())
    if credentials['host']!='aws-1-ap-south-1.pooler.supabase.com' or credentials['user']!='postgres.awkjrolplhvrscuqqive':
        raise SystemExit('Verified source endpoint required')
    environment=dict(os.environ)
    environment.update(PGHOST=credentials['host'],PGPORT=str(credentials['port']),PGUSER=credentials['user'],
      PGDATABASE=credentials['database'],PGPASSWORD=credentials['password'],PGSSLMODE='require',PGCONNECT_TIMEOUT='15')
    command=['docker','run','--rm','-i','--memory','256m','--cpus','0.5','--pids-limit','64',
      '--log-driver','local','--log-opt','max-size=1m','--log-opt','max-file=2']
    for name in ['PGHOST','PGPORT','PGUSER','PGDATABASE','PGPASSWORD','PGSSLMODE','PGCONNECT_TIMEOUT']:
        command+=['-e',name]
    command+=['postgres:17-alpine','psql','-XqAt','-v','ON_ERROR_STOP=1']
    def sql(text):
        with (state/'source-cutover-sql-20261102.log').open('w') as log:
            result=subprocess.run(command,input=text,text=True,env=environment,stdout=subprocess.PIPE,stderr=log,timeout=75)
        if result.returncode:raise RuntimeError('Source SQL operation failed; inspect protected log')
        return result.stdout.strip()
    runtime=dict(line.split('=',1) for line in pathlib.Path('/etc/ishdasiz-server/runtime.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
    token=runtime['TELEGRAM_BOT_TOKEN']
    def telegram(method,params=None):
        request=urllib.request.Request('https://api.telegram.org/bot'+token+'/'+method,
          data=json.dumps(params or {}).encode(),headers={'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(request,timeout=25) as response:data=json.load(response)
        except Exception:raise RuntimeError('Telegram setup request failed: '+method) from None
        if data.get('ok') is not True:raise RuntimeError('Telegram setup was not confirmed: '+method)
        return data['result']
    if telegram('getMe').get('username','').lower()!='ishdasizbot':raise SystemExit('Expected @IshdasizBot')
    legacy=json.loads(subprocess.check_output(['docker','inspect','codex-ishdasiz-bot']))[0]
    if legacy['State']['Running'] or legacy['HostConfig']['RestartPolicy']['Name']!='no':
        raise SystemExit('Legacy polling must remain stopped without automatic restart')
    source=json.loads(sql("SELECT json_build_object('fenced',(SELECT enabled FROM ishdasiz_cutover.state WHERE singleton),'cron',(SELECT json_agg(json_build_object('id',jobid,'name',jobname,'active',active)) FROM cron.job),'guarded_tables',(SELECT count(*) FROM pg_trigger WHERE tgname='aaa_ishdasiz_cutover_write_fence'));"))
    webhook=telegram('getWebhookInfo')
    if action=='inspect':
        print(json.dumps({'source':source,'webhook_url':webhook.get('url'),'pending_updates':webhook.get('pending_update_count'),'polling_stopped':True}));return
    def record(data):journal.write_text(json.dumps(data,indent=2));journal.chmod(0o600)
    def resume(saved):
        target=json.loads((state/'private-backend-state-20261101.json').read_text())
        if target.get('public_cutover'):raise RuntimeError('Target has been promoted; reconcile new writes before any rollback')
        statements=['BEGIN;','UPDATE ishdasiz_cutover.state SET enabled=false WHERE singleton;']
        for job in saved['source']['cron'] or []:
            if job['name']!='ishdasiz-osonish-refresh':raise RuntimeError('Unexpected source cron job')
            statements.append('SELECT cron.alter_job(job_id:='+str(int(job['id']))+',active:='+('true' if job['active'] else 'false')+');')
        statements.append('COMMIT;')
        failures=[]
        try:sql('\n'.join(statements))
        except Exception:failures.append('source_sql')
        params={'url':saved['webhook']['url'],'secret_token':saved['webhook_secret'],'drop_pending_updates':False}
        for name in ['allowed_updates','max_connections']:
            if name in saved['webhook']:params[name]=saved['webhook'][name]
        try:telegram('setWebhook',params)
        except Exception:failures.append('webhook')
        saved['phase']='rollback_needs_attention' if failures else 'source_resumed'
        saved['rollback_failures']=failures;record(saved)
        if failures:raise RuntimeError('Source rollback needs attention; check protected journal')
    if action=='resume':
        resume(json.loads(journal.read_text()));print(json.dumps({'phase':'source_resumed','pending_updates_preserved':True}));return
    if source['fenced'] or source['guarded_tables']!=73 or webhook.get('url')!='https://ishdasiz.uz/api/telegram/webhook':
        raise SystemExit('Source is not in the verified pre-cutover state')
    if len(source['cron'] or [])!=1 or source['cron'][0]['name']!='ishdasiz-osonish-refresh':
        raise SystemExit('Unexpected source scheduler state')
    if json.loads((state/'private-backend-state-20261101.json').read_text()).get('public_cutover'):
        raise SystemExit('Target already promoted')
    old=json.loads(pathlib.Path('/etc/ishdasiz-server/production-webhook-before-cutover.json').read_text())
    if not old.get('TELEGRAM_WEBHOOK_SECRET') or '[SENSITIVE]' in old['TELEGRAM_WEBHOOK_SECRET']:
        raise SystemExit('Original production webhook secret required for rollback')
    saved={'phase':'prepared','source':source,'webhook':webhook,'webhook_secret':old['TELEGRAM_WEBHOOK_SECRET'],
      'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    record(saved)
    try:
        telegram('deleteWebhook',{'drop_pending_updates':False})
        saved['phase']='telegram_paused';record(saved)
        sql("""BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='45s';
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_trigger g JOIN pg_class c ON c.oid=g.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE g.tgname='aaa_ishdasiz_cutover_write_fence' ORDER BY n.nspname,c.relname
 LOOP EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',t.nspname,t.relname); END LOOP;
END $$;
UPDATE ishdasiz_cutover.state SET enabled=true WHERE singleton;
SELECT cron.alter_job(job_id:=jobid,active:=false) FROM cron.job WHERE jobname='ishdasiz-osonish-refresh';
COMMIT;""")
        saved['phase']='source_paused';saved['fenced_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();record(saved)
        print(json.dumps({'phase':'source_paused','fenced_at':saved['fenced_at'],'pending_updates_preserved':True,'source_cron_paused':True}))
    except Exception:
        resume(saved)
        raise

if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps({'operation_failed':True,'error_type':type(error).__name__,'details':'See protected operation logs; no credentials printed'}))
        raise SystemExit(1) from None

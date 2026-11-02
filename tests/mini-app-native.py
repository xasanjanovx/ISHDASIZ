"""Pre-cutover PostgreSQL smoke test with synthetic rows and full rollback.

Run manually on the private deployment host, not against cloud/production.
No channel request, AI request, Auth login or external message is performed.
"""
import json,os,pathlib,secrets,subprocess,sys,uuid
if not sys.platform.startswith('linux') or os.geteuid()!=0:
    raise SystemExit('Run as root on the verified private Linux deployment host')
os.umask(0o077)
state=pathlib.Path('/opt/ishdasiz-server/state')
if json.loads((state/'private-backend-state-20261101.json').read_text()).get('public_cutover'):
    raise SystemExit('only the pre-cutover server clone may be tested')
container=json.loads(subprocess.check_output(['docker','inspect','ishdasiz-data-db-1']))[0]
if container['Config']['Labels'].get('com.docker.compose.project')!='ishdasiz-data' or container['HostConfig']['PortBindings']:
    raise SystemExit('the dedicated unpublished database container is required')
cmd=['docker','exec','-i','ishdasiz-data-db-1','psql','-X','-q','-A','-t','-U','supabase_admin','-d','restore_verify','-v','ON_ERROR_STOP=1']
def execute(sql,log_name):
    with (state/log_name).open('w') as log:
        r=subprocess.run(cmd,input=sql,text=True,stdout=subprocess.PIPE,stderr=log,timeout=90)
    if r.returncode:raise SystemExit('native save verification failed; protected log: '+log_name)
    return r.stdout.strip().splitlines()
count_sql="SELECT json_build_object('users',(SELECT count(*) FROM public.users),'jobs',(SELECT count(*) FROM public.jobs),'resumes',(SELECT count(*) FROM public.resumes),'events',(SELECT count(*) FROM public.sync_events),'records',(SELECT count(*) FROM public.mini_app_records),'orders',(SELECT count(*) FROM public.mini_app_channel_orders));"
before=json.loads(execute(count_sql,'native-save-before.log')[-1])
phone='+99899'+''.join(str(secrets.randbelow(10)) for _ in range(7))
uid,jid,rid=[str(uuid.uuid4()) for _ in range(3)]
literal=lambda value:"'"+str(value).replace("'","''")+"'"
job={"title_uz":"Operator QA","title_ru":"Operator QA","description_uz":"Native schema verification","description_ru":"","company_name":"Migration QA","contact_phone":phone}
resume={"title":"Operator QA","full_name":"Migration QA","phone":phone,"birth_date":"1995-01-01"}
metadata={"position":"Operator QA","salaryPeriod":"month"}
job_json=literal(json.dumps(job))+'::jsonb'
resume_json=literal(json.dumps(resume))+'::jsonb'
meta_json=literal(json.dumps(metadata))+'::jsonb'
script=f"""BEGIN;
INSERT INTO public.users(id,phone,role,password_hash,is_verified) VALUES('{uid}',{literal(phone)},'job_seeker','synthetic-no-login',true);
INSERT INTO public.employer_profiles(id,user_id,company_name) VALUES('{uid}','{uid}','Migration QA');
INSERT INTO public.job_seeker_profiles(id,user_id,full_name) VALUES('{uid}','{uid}','Migration QA');
SET LOCAL ROLE service_role;
SELECT public.ishdasiz_mini_app_save('{uid}',0,'{jid}','vacancy',{job_json},{meta_json});
SELECT public.ishdasiz_mini_app_save('{uid}',0,'{jid}','vacancy',{job_json},{meta_json});
SELECT public.ishdasiz_mini_app_save('{uid}',0,'{rid}','resume',{resume_json},{meta_json});
SELECT json_build_object('vacancy_saved_once',(SELECT count(*)=1 FROM public.jobs WHERE id='{jid}'),
'resume_saved',(SELECT count(*)=1 FROM public.resumes WHERE id='{rid}'),
'one_account_for_both',(SELECT count(*)=2 FROM public.mini_app_records WHERE user_id='{uid}'),
'resume_not_for_channel',(SELECT post_to_channel=false FROM public.resumes WHERE id='{rid}'),
'vacancy_channel_not_requested',(SELECT mini_app_channel_requested=false FROM public.jobs WHERE id='{jid}'),
'no_channel_order',(SELECT count(*)=0 FROM public.mini_app_channel_orders WHERE user_id='{uid}'),
'candidate_access_locked',NOT public.ishdasiz_mini_app_candidate_access('{uid}',0,'{jid}'),
'channel_target_absent',public.ishdasiz_channel_target(public.ishdasiz_channel_snapshot('job','{jid}')) IS NULL);
ROLLBACK;
{count_sql}
"""
lines=execute(script,'native-mini-save.log')
checks,after=json.loads(lines[-2]),json.loads(lines[-1])
if not all(checks.values()) or before!=after:raise SystemExit('native save or full rollback invariant failed')
report={'checks':checks,'all_synthetic_changes_rolled_back':before==after,'no_channel_publication':True,'data_counts':after}
(state/'mini-app-native-save-20261101.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))

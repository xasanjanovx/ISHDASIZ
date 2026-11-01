"""Prepare root-only secrets for this verified, isolated ISHDASIZ rollout.

Requires the restored database/admin record and verified image manifest.
Does not start services, publish ports or change public application settings.
"""
import base64,hashlib,hmac,json,os,pathlib,secrets,sys,time
if not sys.platform.startswith('linux') or os.geteuid()!=0:
    raise SystemExit('Run as root on the verified Linux deployment host')
os.umask(0o077)
state=pathlib.Path('/opt/ishdasiz-server/state')
deployment=pathlib.Path('/opt/ishdasiz-server/backend-20261101')
deployment.mkdir(mode=0o700,exist_ok=True)
(deployment/'deploy').mkdir(mode=0o700,exist_ok=True)
(deployment/'migrations').mkdir(mode=0o700,exist_ok=True)
credential=pathlib.Path('/etc/ishdasiz-server/backend-keys.json')
if not credential.exists():
    secret=secrets.token_hex(48)
    def jwt(role):
        encode=lambda obj:base64.urlsafe_b64encode(json.dumps(obj,separators=(',',':')).encode()).decode().rstrip('=')
        now=int(time.time())
        raw=encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'iss':'https://api.ishdasiz.uz/auth/v1','aud':'authenticated','role':role,'iat':now,'exp':now+5*365*24*3600})
        return raw+'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),raw.encode(),hashlib.sha256).digest()).decode().rstrip('=')
    values={'jwt_secret':secret,'anon_key':jwt('anon'),'service_key':jwt('service_role'),
            'authenticator_password':secrets.token_urlsafe(36),'auth_password':secrets.token_urlsafe(36)}
    with os.fdopen(os.open(credential,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w') as stream:json.dump(values,stream)
values=json.loads(credential.read_text())
if credential.stat().st_mode&0o077:
    raise SystemExit('Backend key file must be owner-only')
admin=json.loads(pathlib.Path('/etc/ishdasiz-server/restore-database-20261101.json').read_text())
configs={
 'backend-db.env':{'POSTGRES_PASSWORD':admin['password'],'POSTGRES_DB':'postgres','PGDATABASE':'restore_verify'},
 'backend-rest.env':{'PGRST_DB_URI':'postgres://authenticator:'+values['authenticator_password']+'@db:5432/restore_verify','PGRST_JWT_SECRET':values['jwt_secret']},
 'backend-auth.env':{'GOTRUE_DB_DATABASE_URL':'postgres://supabase_auth_admin:'+values['auth_password']+'@db:5432/restore_verify','GOTRUE_JWT_SECRET':values['jwt_secret']},
 'backend-application.env':{'NEXT_PUBLIC_SUPABASE_URL':'https://api.ishdasiz.uz','NEXT_PUBLIC_SUPABASE_ANON_KEY':values['anon_key'],'SUPABASE_SERVICE_ROLE_KEY':values['service_key']},
}
for filename,entries in configs.items():
    path=pathlib.Path('/etc/ishdasiz-server')/filename
    path.write_text(''.join(k+'='+v+'\n' for k,v in entries.items()))
    path.chmod(0o600)
mapping=pathlib.Path('/etc/ishdasiz-server/backend-api-keys.conf')
mapping.write_text('map $http_apikey $ishdasiz_api_role {\n default "";\n "'+values['anon_key']+'" anon;\n "'+values['service_key']+'" service;\n}\n')
mapping.chmod(0o600)
images={row['tag']:row['digest'] for row in json.loads((state/'backend-images-20261101.json').read_text())}
public={
 'POSTGRES_IMAGE':images['supabase/postgres:17.6.1.136'],
 'POSTGREST_IMAGE':images['postgrest/postgrest:v14.18'],'AUTH_IMAGE':images['supabase/gotrue:v2.197.0'],
 'GATEWAY_IMAGE':images['nginx:stable-alpine'],'DB_DATA_VOLUME':'ishdasiz-db-restore-20261101-data',
 'DB_CONFIG_VOLUME':'ishdasiz-db-restore-20261101-config','BACKEND_BIND_PORT':'3150',
 'BACKEND_DB_ENV':'/etc/ishdasiz-server/backend-db.env','BACKEND_REST_ENV':'/etc/ishdasiz-server/backend-rest.env',
 'BACKEND_AUTH_ENV':'/etc/ishdasiz-server/backend-auth.env','BACKEND_KEY_MAP':str(mapping),
}
config=pathlib.Path('/etc/ishdasiz-server/backend.config.env')
config.write_text(''.join(k+'='+v+'\n' for k,v in public.items()))
config.chmod(0o600)
print(json.dumps({'status':'backend_private_config_prepared','deployment':str(deployment),'credential_files_mode':'0600','images_pinned':len(images)}))

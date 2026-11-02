"""Continue the existing leased import via the server's loopback API."""
import json,os,pathlib,sys,urllib.request,urllib.error

credential=pathlib.Path(os.environ['CREDENTIALS_DIRECTORY'])/'cron-secret'
secret=credential.read_text().strip()
if not secret:raise SystemExit('Import continuation credential unavailable')
request=urllib.request.Request('http://127.0.0.1:3130/api/cron/continue-osonish',
    headers={'Authorization':'Bearer '+secret})
try:
    with urllib.request.urlopen(request,timeout=270) as response:
        body=json.load(response);status=response.status
except urllib.error.HTTPError as error:
    print(json.dumps({'worker':'import_continuation','http_status':error.code}));raise SystemExit(1) from None
except Exception:
    print(json.dumps({'worker':'import_continuation','request_failed':True}));raise SystemExit(1) from None
summary={key:body[key] for key in ['success','pending','running','continued','processed'] if isinstance(body.get(key),(bool,int))}
if isinstance(body.get('progress'),dict) and body['progress'].get('state') in ['running','completed','failed']:
    summary['state']=body['progress']['state']
print(json.dumps({'worker':'import_continuation','http_status':status,**summary}))
sys.exit(0 if 200<=status<300 else 1)

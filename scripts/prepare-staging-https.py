"""Provision this server's verified API/bot HTTPS routes.

Uses the existing Certbot account/timer and graceful Nginx reloads. Never changes
the site's DNS, Vercel settings, application data connection or Telegram webhook.
"""
import argparse,json,os,pathlib,socket,subprocess,sys
if not sys.platform.startswith('linux') or os.geteuid()!=0:
    raise SystemExit('Run as root on the verified Linux deployment host')
os.umask(0o077)
base=pathlib.Path('/opt/ishdasiz-server/backend-20261101')
state=pathlib.Path('/opt/ishdasiz-server/state')
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--permanent',action='store_true',help='Use the api/bot.ishdasiz.uz pair after its DNS is configured')
args=parser.parse_args()
route_name='ishdasiz-public-20261102' if args.permanent else 'ishdasiz-staging-20261101'
hosts=['api.ishdasiz.uz','bot.ishdasiz.uz'] if args.permanent else ['api.167-235-249-200.sslip.io','bot.167-235-249-200.sslip.io']
for host in hosts:
    addresses={row[4][0] for row in socket.getaddrinfo(host,443,socket.AF_INET)}
    if addresses!={'167.235.249.200'}:raise SystemExit('API/bot host does not resolve to this server')
with (state/'nginx-before-https.log').open('w') as log:
    subprocess.run(['nginx','-t'],stdout=log,stderr=log,check=True)
available=pathlib.Path('/etc/nginx/sites-available/ishdasiz-acme-20261101.conf')
enabled=pathlib.Path('/etc/nginx/sites-enabled/ishdasiz-acme-20261101.conf')
acme_new_file=not available.exists()
acme_new_link=not (enabled.exists() or enabled.is_symlink())
if available.is_symlink():raise SystemExit('challenge configuration must be a regular project file')
if enabled.is_symlink() and enabled.resolve()!=available:
    raise SystemExit('unexpected existing challenge link')
if available.exists() and available.read_text()!=(base/'deploy'/'nginx.acme.conf').read_text():
    raise SystemExit('unexpected existing ISHDASIZ challenge configuration')
webroot=pathlib.Path('/var/www/ishdasiz-acme')
webroot.mkdir(mode=0o755,parents=True,exist_ok=True)
webroot.chmod(0o755)
available.write_text((base/'deploy'/'nginx.acme.conf').read_text())
available.chmod(0o644)
if not enabled.exists():enabled.symlink_to(available)
with (state/'nginx-acme-check.log').open('w') as log:
    checked=subprocess.run(['nginx','-t'],stdout=log,stderr=log)
if checked.returncode:
    if acme_new_link and enabled.is_symlink():enabled.unlink()
    if acme_new_file and available.is_file():available.unlink()
    raise SystemExit('challenge configuration failed validation; new files rolled back')
subprocess.run(['systemctl','reload','nginx'],check=True)
hook=state/'reload-nginx-after-certificate.sh'
hook.write_text('#!/bin/sh\nset -eu\n/usr/sbin/nginx -t\n/usr/bin/systemctl reload nginx\n')
hook.chmod(0o700)
help_text=subprocess.check_output(['certbot','--help','all'],text=True)
if '--no-directory-hooks' not in help_text:raise SystemExit('certbot must support scoped hook execution')
name=route_name
command=['certbot','certonly','--webroot','--webroot-path',str(webroot),'--cert-name',name,
 '--non-interactive','--agree-tos','--register-unsafely-without-email','--no-directory-hooks',
 '--keep-until-expiring','--deploy-hook',str(hook)]
for host in hosts:command+=['-d',host]
print(json.dumps({'phase':'ensuring_certificate','hosts':hosts}),flush=True)
with (state/(route_name+'-certificate.log')).open('w') as log:
    result=subprocess.run(command,stdout=log,stderr=log,timeout=180)
if result.returncode:
    print(json.dumps({'phase':'certificate_failed','exit_code':result.returncode}),flush=True)
    raise SystemExit(1)
render=(base/'deploy'/'nginx.public-https.template.conf').read_text().replace('__API_HOST__',hosts[0]).replace('__BOT_HOST__',hosts[1]).replace('__CERT_NAME__',name)
target=pathlib.Path('/etc/nginx/sites-available')/(route_name+'.conf')
tls_new_file=not target.exists()
if target.is_symlink():raise SystemExit('staging HTTPS configuration must be a regular project file')
if target.exists() and target.read_text()!=render:
    raise SystemExit('unexpected existing staging HTTPS configuration')
target.write_text(render)
target.chmod(0o644)
link=pathlib.Path('/etc/nginx/sites-enabled')/(route_name+'.conf')
tls_new_link=not (link.exists() or link.is_symlink())
if link.is_symlink() and link.resolve()!=target:
    raise SystemExit('unexpected existing staging HTTPS link')
if not link.exists():link.symlink_to(target)
with (state/'nginx-https-check.log').open('w') as log:
    checked=subprocess.run(['nginx','-t'],stdout=log,stderr=log)
if checked.returncode:
    if tls_new_link and link.is_symlink():link.unlink()
    if tls_new_file and target.is_file():target.unlink()
    raise SystemExit('HTTPS configuration failed validation; new files rolled back')
subprocess.run(['systemctl','reload','nginx'],check=True)
print(json.dumps({'phase':'https_ready','api':'https://'+hosts[0],
 'bot':'https://'+hosts[1],'public_data_cutover':False}),flush=True)

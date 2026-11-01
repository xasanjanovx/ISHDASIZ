"""Read-only private-backend smoke checks; never prints API credentials or rows."""
import json
import pathlib
import subprocess
import urllib.error
import urllib.request


def main():
    keys = json.loads(pathlib.Path('/etc/ishdasiz-server/backend-keys.json').read_text())
    base = 'http://127.0.0.1:3150'
    checks = []

    def call(name, path, expected, *, key=None, token=None, origin=None, method='GET', extra=None):
        headers = dict(extra or {})
        if key:
            headers['apikey'] = key
        if token:
            headers['Authorization'] = 'Bearer ' + token
        if origin:
            headers['Origin'] = origin
        request = urllib.request.Request(base + path, method=method, headers=headers)
        try:
            response = urllib.request.urlopen(request, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        body = response.read()
        passed = response.status in expected
        checks.append({'check': name, 'status': response.status, 'passed': passed})
        if not passed:
            raise RuntimeError('unexpected HTTP status: ' + name)
        return body, response.headers

    anon, service = keys['anon_key'], keys['service_key']
    call('gateway_health', '/health', [200])
    call('missing_api_key', '/rest/v1/regions?select=id&limit=1', [401])
    call('invalid_api_key', '/rest/v1/regions?select=id&limit=1', [401], key='invalid')
    rows, _ = call('public_reference', '/rest/v1/regions?select=id&limit=1', [200], key=anon)
    if len(json.loads(rows)) != 1:
        raise RuntimeError('real reference rows unavailable')
    call('public_jobs', '/rest/v1/jobs?select=id&limit=1', [200], key=anon)
    call('private_resumes_blocked', '/rest/v1/resumes?select=phone&limit=1', [403], key=anon)
    call('private_users_blocked', '/rest/v1/users?select=password_hash&limit=1', [403], key=anon)
    call('private_rpc_blocked', '/rest/v1/rpc/ishdasiz_mini_app_budget', [403], key=anon, method='POST')
    call('public_mutation_blocked', '/rest/v1/jobs', [403], key=anon, method='POST')
    forged = service.rsplit('.', 1)[0] + '.' + 'A' * 43
    call('forged_jwt_rejected', '/rest/v1/jobs?select=id&limit=1', [401], key=anon, token=forged)
    call('allowed_origin', '/rest/v1/regions?select=id&limit=1', [200], key=anon, origin='https://ishdasiz.uz')
    call('www_origin', '/rest/v1/regions?select=id&limit=1', [200], key=anon, origin='https://www.ishdasiz.uz')
    call('foreign_origin', '/rest/v1/regions?select=id&limit=1', [403], key=anon, origin='https://foreign.invalid')
    _, cors = call('browser_preflight', '/rest/v1/regions', [204], origin='https://ishdasiz.uz', method='OPTIONS',
                   extra={'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'apikey,accept-profile'})
    if cors.get('Access-Control-Allow-Origin') != 'https://ishdasiz.uz' or 'accept-profile' not in cors.get('Access-Control-Allow-Headers', ''):
        raise RuntimeError('browser SDK CORS headers missing')
    call('service_resume_read', '/rest/v1/resumes?select=id&limit=1', [200], key=service)
    call('mini_app_storage', '/rest/v1/mini_app_records?select=id&limit=1', [200], key=service)
    counts, _ = call('public_home_counts', '/rest/v1/rpc/ishdasiz_public_home_counts', [200], key=anon)
    if not isinstance(json.loads(counts).get('total'), int):
        raise RuntimeError('home summary unavailable')
    call('auth_health', '/auth/v1/health', [200], key=anon)
    call('anon_cannot_admin_auth', '/auth/v1/admin/users?page=1&per_page=1', [401, 403], key=anon)
    users, _ = call('service_auth_admin_read', '/auth/v1/admin/users?page=1&per_page=1', [200], key=service)
    if len(json.loads(users).get('users', [])) != 1:
        raise RuntimeError('restored Auth user unavailable')
    names = ['ishdasiz-data-db-1', 'ishdasiz-data-rest-1', 'ishdasiz-data-auth-1', 'ishdasiz-data-gateway-1']
    stats = subprocess.check_output(['docker', 'stats', '--no-stream', '--format', '{{.Name}}: {{.MemUsage}}; CPU {{.CPUPerc}}', *names], text=True).splitlines()
    report = {'checks_passed': len(checks), 'checks': checks, 'container_samples': stats,
              'scope': 'loopback backend only; no emails, SMS, publications, paid requests or business mutations',
              'public_cutover': False}
    path = pathlib.Path('/opt/ishdasiz-server/state/private-backend-verification-20261101.json')
    path.write_text(json.dumps(report, indent=2))
    path.chmod(0o600)
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()

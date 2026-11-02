# Private backend preparation — 1 November 2026

The restored-data baseline is now running behind a dedicated local API gateway at **127.0.0.1:3150**. The website still uses Supabase cloud and remains hosted on Vercel. No production data URL, Telegram webhook, source scheduler or DNS record was switched.

## Services and resource bounds

deploy/compose.data.yaml contains only the services used by the inspected application: PostgreSQL, PostgREST, GoTrue Auth and Nginx. No Studio, analytics/log-ingestion stack, Realtime server or Storage server was installed. The current code uses direct browser reads for public vacancies/references and the site's account APIs for private data and mutations. Actual Storage objects were absent from the source snapshot.

| Container | RAM cap | CPU cap | Provider pool |
| --- | ---: | ---: | ---: |
| ishdasiz-data-db-1 | 512 MiB | 0.75 | max_connections=30 |
| ishdasiz-data-rest-1 | 128 MiB | 0.25 | 4, plus its listener |
| ishdasiz-data-auth-1 | 192 MiB | 0.25 | max 3, idle 2 |
| ishdasiz-data-gateway-1 | 64 MiB | 0.25 | fixed upstreams |

The four memory caps total 896 MiB; they are ceilings, not reserved memory. The sample after startup and read-only HTTP checks totaled about 95 MiB. The earlier warm restored-database sample after ANALYZE was about 188 MiB for PostgreSQL alone. Neither sample is a concurrent production load/capacity guarantee. The separate Node web/bot staging process and other server applications are outside these four caps.

Auth explicitly retains up to two idle connections; an unset idle limit in this provider version can cause repeated connection creation. Both provider pools fit within the 30-connection database ceiling. A later idle sample had two authenticator connections and one verification/admin connection. PostgreSQL retains the 128 MiB shared cache, 1 MiB work_mem and enabled autovacuum from deploy/postgres-memory.conf. cron.launch_active_jobs remains off.

All four containers use Docker local logs with 10m × 5 files and compression, approximately 200 MB of configured message files across this stack plus metadata. Nginx request logs omit query strings, IPs and credentials. These bounds do not cover unrelated server projects, the OS journal, proxy errors or SQL/WAL storage. Supabase's historical log-ingestion counter was not copied.

The database, REST and Auth have only the internal Docker network and no published ports. The gateway also has a frontend bridge so Docker can publish its strictly loopback-bound port. Container roots for REST/Auth/gateway are read-only with small /tmp tmpfs mounts and restricted capabilities. The existing host Nginx continues to serve other projects.

Images are pinned by digest from the official Supabase Docker definition and verified pulls. Public image metadata is in /opt/ishdasiz-server/state/backend-images-20261101.json. Deployment files are under /opt/ishdasiz-server/backend-20261101/deploy; Compose paths/digests are in /etc/ishdasiz-server/backend.config.env.

## Applied only to the server copy

The following migrations are recorded atomically with their SQL in the target's migration history:

- 20261027090000_main_employer_channel
- 20261030120000_mini_app_integration
- 20261101123718_self_hosted_public_api_boundary

The cloud source has not received these changes in this phase. Both already-applied performance fixes were preserved. The target now has the Mini App storage and channel-order tables; they contain zero records/orders, so no free publication allowance or AI budget was consumed.

The new public API boundary removes direct anon/authenticated access to account, resume, contact, export-view, mutation and private RPC objects. It also removes column-only grants, so embedded joins cannot bypass the table boundary. Browser clients retain read access to public jobs, categories, regions and districts, their visibility helpers and the two public count RPCs. Direct job reads use one explicit public-availability policy; owned drafts/private actions go through the site's verified account APIs instead of browser SQL.

Before revoking PUBLIC grants, the migration preserves the service role's existing effective table/column/sequence/function permissions. It does not grant an already-private helper to service_role. A native comparison with the unchanged cloud source found identical effective service access on **136 existing routines, 56 tables/views and six sequences**. In particular, direct execution of enqueue_job_sync_event stays denied. No business or reconciliation row was deleted.

The final target counts still match the archive: 52,361 jobs, 131 resumes, 684 application users, 480,928 reconciliation events and one Auth user. The separately re-encrypted Vault secret also decrypts correctly after replacing the original verification container with this backend.

The old ishdasiz-db-restore-20261101 container is stopped and retained. It shares the dedicated data/config volumes with the current db container; **never start both against those volumes**. The operator checks running consumers before startup and refuses other volumes, multiple consumers, publicly published provider ports or a gateway bound beyond loopback.

## Private configuration

scripts/prepare-private-backend.py creates/reuses strong target-only JWT/API keys and provider database passwords. Values are stored under /etc/ishdasiz-server in root-only 0600 files:

- backend-keys.json and backend-api-keys.conf
- backend-db.env, backend-rest.env, backend-auth.env
- backend-application.env (the three database URL/key values for later application configuration)

The service-role key and signing secret are never browser variables, build arguments or console output. Rerunning preparation/activation was verified to preserve the keys and return all checks to green. Provider database-role passwords changed only in the server clone; customer/admin-account password hashes were not reset. The source application's environment file was not rewritten.

Keep the old production AUTH_SESSION_SECRET when switching the site's service-role key. If production currently signs phone-session cookies using its service-role fallback, preserve that old signing value in AUTH_SESSION_SECRET before changing the database key. Verify the actual Vercel configuration rather than assuming the local env is identical. Supabase Auth tokens use the target signing key, so admin users will need to sign in again.

Auth's native signup is disabled because the application's customers register through its own verified phone/account APIs. Existing Auth/admin-account reads are tested. SMTP/email delivery and external OAuth are not configured/tested for this target; Auth's internal-only network currently has no external egress. Configure the required provider/controlled egress and test any email/OAuth flows before enabling them. Phone SMS delivery remains the separate site-side Eskiz integration.

## Verification

Ten affected PGlite tests pass across Mini App storage/permissions and the new public boundary. They cover private rows/views, column-only grants, joins, anonymous mutations, service capability preservation, private lease helpers, idempotent reapplication, atomic account saves, vacancy-scoped actual delivery proof and the free reservation rule.

scripts/check-private-backend.py passed **20 real read-only HTTP checks**: API health/key validation, public jobs/references, private rows/RPCs/mutations denied, invalid JWT signatures rejected, apex/www CORS and preflight, service-only resume/storage reads, count RPC, Auth health, denied anonymous Auth administration and access to the restored Auth user. No SMS, email, Telegram publication, paid request or business mutation was performed.

tests/mini-app-native.py also exercised real vacancy/resume saves on the restored PostgreSQL schema inside one rolled-back transaction. Eight invariants passed: idempotent vacancy creation, resume creation, both records under one account, resume channel disabled, no vacancy channel request/order, locked candidate access and no channel target. All synthetic rows and queue events rolled back; the original counts and empty Mini App records/orders were verified afterward. This exposed the real schema's required bilingual text columns, which are now also enforced in the focused SQL test fixture. Before public promotion, update the deployment state to public_cutover=true so this pre-cutover test refuses to run.

Private evidence files:

```text
/opt/ishdasiz-server/state/private-backend-verification-20261101.json
/opt/ishdasiz-server/state/private-backend-state-20261101.json
/opt/ishdasiz-server/state/backend-schema-ready-20261101.json
```

Operator sequence after the dedicated restore/image records and deployment assets exist:

```sh
python3 scripts/prepare-private-backend.py
python3 scripts/activate-private-backend.py
python3 scripts/check-private-backend.py
```

These are Linux/root, release-specific operators for this already verified server. They preserve the old stopped container, avoid a second PostgreSQL process on the same volume, and record a resumable setup phase. They do not perform a public cutover.

## Next public steps

Temporary HTTPS verification routes are now live on the same server:

```text
https://api.167-235-249-200.sslip.io/health
https://bot.167-235-249-200.sslip.io/api/health
```

The dedicated Nginx vhosts expose the API gateway and only the bot's health/webhook paths. The bot root returns 404. Six external HTTPS checks passed with normal certificate verification: both health endpoints, rejected API access without a key, rejected unsigned webhook, hidden bot root and the unchanged primary site's HTTP 200 response. No private API credential was sent to the temporary hostname during these external checks. No Telegram transport was switched; the existing Node staging process still has dry-run publication mode.

The certificate is valid through 30 January 2027, Certbot's existing renewal timer is active, and a project deploy hook checks Nginx configuration before a graceful reload. No new ACME package/service was installed. scripts/prepare-staging-https.py and the Nginx templates reproduce only these scoped routes, with DNS-to-server checks and rollback of newly created files if configuration validation fails. Existing project vhosts were not rewritten. The temporary addresses are verification endpoints; backend-application.env still names the intended api.ishdasiz.uz endpoint.

Vercel account access and permanent API/bot routing were verified on 2 November; see docs/server-cutover-2026-11-02.md. Source writers continue, so use a coordinated fresh export before promotion rather than this earlier snapshot. Keep source rollback, preserve pending bot updates, and switch bot transport only after its server runtime and webhook secret have been checked. Source schedulers and channel publication remain unchanged/off on the target.

References: [PostgREST configuration](https://docs.postgrest.org/en/v14/references/configuration.html), [official Auth configuration](https://github.com/supabase/supabase/blob/master/docker/CONFIG.md), [Auth idle-pool issue](https://github.com/supabase/auth/issues/2831), [Certbot webroot](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot), [technical-host DNS service](https://sslip.io/).

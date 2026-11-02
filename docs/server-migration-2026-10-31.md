# ISHDASIZ server migration — prepared 31 October, SSH verified 1 November 2026

Target supplied by the owner: Hetzner CCX13, 167.235.249.200, 2 vCPU / 8 GB RAM / 80 GB disk. Keep ishdasiz.uz. The owner authorized server deployment and inspection of what data belongs to this project.

## Current access and deployment state

- The owner added the prepared deployment public key via Termius on 1 November. Root SSH access from the workstation is now verified. The matching private key stays in the protected local private/server-access-20261031 directory and is excluded from Git and deployment artifacts.
- DNS currently returns A records 216.198.79.1 and 64.29.17.65, with nameservers ns1.vercel-dns.com and ns2.vercel-dns.com. No DNS record was changed.
- Plugin discovery found Vercel available but not installed/connected in this session. Do not claim access or move DNS until actual access is confirmed. Vercel remains the current site host.
- Supabase API and SQL access work through the connector. On 1 November at 11:40 UTC the owner saved PostgreSQL settings in ISHDASIZ NEW/.env under DATABASE and SUPABASE_DATA_PASSWORD. These aliases were found and the supplied password successfully connected to the expected project's session pooler as postgres on PostgreSQL 17.6. A private migration credential file is stored outside source at /etc/ishdasiz-server/source-database.json with mode 0600. Independent REST pages were not used as a migration backup.
- The owner subsequently chose to keep the functioning website and its domain on Vercel. The intended public migration is the database/required API services and bot backend to this server. The loopback web release below remains isolated staging; moving the website's domain is not required. A separate TLS API endpoint and coordinated Vercel configuration will be needed for the new data backend.
- SSH and a host audit were performed on 1 November. An isolated application staging container is now installed on 127.0.0.1:3130, connected to the existing cloud database for read verification. No database export, DNS change or bot webhook switch has been performed. The conflicting obsolete polling container was stopped with its image and files retained; details below.

### Existing server and bot audit — 1 November

The host is Ubuntu 26.04, Docker 29.1.3, Compose 2.40.3. Nginx already serves other domains on ports 80/443. Other running projects include Raqib, CheksizAI, Self and several bots. Host PostgreSQL 18 and a separate project PostgreSQL 17 container are already running; neither belongs to the new isolated ISHDASIZ database.

Observed capacity: about 21 GB free on the 75 GiB filesystem, 4.1 GiB available RAM and 1.26 GiB occupied swap. These are current observations, not unallocated capacity reserved for this migration. Port 3100 is already used by Raqib; ISHDASIZ preparation now uses 3130. Docker reported 18.13 GB reclaimable build cache and 19.17 GB reclaimable images, but these overlap shared storage and must not be added together as guaranteed savings. No global Docker cleanup was run.

The old codex-ishdasiz-bot container uses the expected Supabase database and @IshdasizBot token. Telegram reports an active webhook at https://ishdasiz.uz/api/telegram/webhook, with zero pending updates at inspection; the website confirms its webhook is configured. The last 300 polling log lines all contained conflict errors and its unlimited json-file log was about 109.5 MB. After rechecking the webhook and repeated conflicts, the obsolete polling container was set to restart=no and stopped. This prevents its conflict loop from resuming after reboot. No webhook or token was changed. Its original image/container remain available; prior restart metadata was saved in /opt/ishdasiz-server/state/poller-before-disable-20261101.json. Deliberately restoring polling would first require coordinating the active webhook.

The legacy Compose definition was also changed only for the ishdasiz-bot service: restart=no, an explicit legacy-ishdasiz-polling profile, and bounded local logging. This prevents a later ordinary Compose up from accidentally re-enabling the conflict. The self-bot definition was compared before/after and remained identical. The original Compose file is backed up with mode 0600 under /opt/ishdasiz-server/state/legacy-compose-before-20261101.yml; the edited Compose validates successfully.

### Isolated application staging — 1 November

Docker Buildx 0.30.1 was installed from the existing Ubuntu repository as one new package, with no package upgrades or service restarts. Linux builds run in a task-specific builder capped at one CPU and 3 GiB memory, with the Node build heap capped at 1536 MiB. Other applications retained their running/healthy state during the observed build.

Application runtime secrets are filtered from the owner's local env and the old bot configuration, checked against the expected bot/database, and stored outside source in /etc/ishdasiz-server/runtime.env with mode 0600. Compose uses raw env-file format to preserve literal credential characters. The application receives no SSH credentials. Staging has TELEGRAM_DRY_RUN=1, new private setup/worker secrets, and no active scheduler or public Nginx route.

The verified application release is **5afe528**, image sha256:b03da4fd550ef059114d4309f25d4f5f05c0ae2b0f93aa9468aff29b249df509. It is installed under /opt/ishdasiz-server/releases/5afe528, with /opt/ishdasiz-server/current pointing to it. The Linux standalone image is 112,419,249 bytes and runs as node, exposed only on 127.0.0.1:3130. Docker health is healthy and configured log rotation is local, 10m, five files, compressed. Root filesystem checks found no .env, .git, tests, docs, private directory or private backups in the runtime root.

Read-only staging checks returned HTTP 200 for health, the Mini App HTML and JavaScript, public bootstrap and home overview. Bootstrap returned 14 regions, 209 districts and 130 available resumes. Unauthenticated account records, candidates and import continuation returned 401. No test sent SMS, Telegram messages, a publication or a charge.

The first real proxy check exposed two deployment issues: absolute Mini App redirects used the container hostname, and the origin guard rejected the configured public HTTPS origin behind TLS termination. Entry redirects now preserve the browser origin and launch parameters; the origin guard allows the explicit configured application origin while rejecting foreign origins and ignoring spoofed forwarded headers. The regression and account/API suites pass **114 tests**. The final live safe POST without account cookies returned 401 for the configured domain and 403 for a foreign origin. Both entry URLs followed redirects to HTTP 200 while retaining their query parameters; JavaScript and home overview also returned 200.

After verification, the task-specific BuildKit builder and its cache were removed and the four task-generated upload tar files were deleted. Loaded runtime images and released source directories remain available for rollback; no shared Docker cleanup was run. At the final snapshot the new web container used about 83 MiB and 0.01% CPU, with about 20 GB disk and 3.8 GiB RAM available on the host. These are brief idle samples, not a load-capacity guarantee. Other inspected web containers remained healthy and Self remained running. The actual Self bot points to a different Supabase URL, supporting separation of its unrelated data family without deleting the source.

The source database still has no mini_app_records or mini_app_channel_orders and neither missing feature migration is recorded. Bootstrap correctly returns storageReady=false. Filling local drafts and reading public data do not establish authenticated save/publication readiness. Preserve this fail-closed behavior; obtain a consistent backup, restore/test the target, and install the missing feature prerequisites before claiming full rollout.

## Data inventory

### Consistent backup and restored-data verification — 1 November

A full dumpable-database archive is now created and restored successfully in an isolated PostgreSQL 17 container. All 99 exported data-table counts, including every public/Auth table, match the shared snapshot; the Vault secret was re-encrypted with the target key and verified. The private archive exists on both the server and workstation with matching SHA-256. The restored database uses the proposed 128 MiB shared cache and a 512 MiB container budget; a brief sample after ANALYZE used about 188 MiB. This is not a complete production backend or a concurrency load test.

The initial verification container had no network or published ports and cron disabled. It is now stopped; the same dedicated volumes serve a verified private PostgreSQL/REST/Auth/gateway stack on 127.0.0.1:3150, with cron still disabled. Mini App prerequisites and the public API access boundary were applied only to this server copy. Twenty real HTTP checks and service-capability comparisons pass. The site still reads cloud data and the local web staging release is unchanged. Target public TLS/API routing, Vercel configuration and the final fresh write-window export remain pending; no public data switch or worker activation occurred. Vercel discovery reports the plugin available but not installed for this session. Detailed evidence and operators: [database restore report](database-restore-2026-11-01.md), [private backend report](private-backend-2026-11-01.md).

Read-only catalog inventory found about 711.3 MB in the live database, including indexes and storage overhead. Row estimates below are estimates, not an export manifest or exact reconciliation counts.

| Data | Observed size | Treatment |
| --- | ---: | --- |
| jobs | 332.9 MB | Preserve records, imported/manual changes and visibility |
| source_import_items | 170.7 MB | Live/recent/failed import state; preserve until archived by the existing safe retention protocol |
| sync_events | 128.5 MB | Pending channel reconciliation; not disposable logs and not evidence of delivery |
| job_import_state | 39.1 MB | Preserve source baselines, manual overrides and import fencing |
| telegram_sessions | 11.7 MB | Preserve during cutover or explicitly invalidate/re-authenticate; contains private session data |
| osonish_professions | 4.6 MB | Required profession lookup |
| users, resumes, profiles, applications, favorites, offers and chats | Small | Required business/account data |
| auth schema | Users exist | Preserve identities; test administrative login after restore |
| channel receipts/intents, source runs/checkpoints, migration history | Small | Required correctness/history; never infer delivery from pending events |
| bot_users, bot_habits, bot_habit_logs, bot_goals, bot_finance_entries, bot_calorie_logs, bot_daily_checkins, bot_reminders, bot_weekly_report_runs | Under 1 MB together | Appear to belong to another project. Preserve in full protected backup; do not populate the new ISHDASIZ application database until ownership/dependencies are confirmed |
| categories_backup | 49 KB | Backup candidate; preserve in archive, omit from active target only after dependency verification |
| import_logs, ai_abuse_logs, admin audit/history | Small | Operational/accountability data; use an explicit retention policy, not bulk deletion |

The bot_* foreign keys observed stay within that family. No public stored-function source or searched application code referenced the queried bot_* tables or categories_backup. This is evidence for separation, not proof that another external application never uses them. Existing data is not deleted or modified on the source.

No Storage objects were present in the source at inspection. Recheck before final export. An empty table or currently unused service is not sufficient evidence to remove a schema that database functions or authentication rely on. Active extensions include pg_cron, pg_net, Vault, pg_trgm, pgcrypto and pg_stat_statements.

## What the 8.77 GB log counter means

Supabase Logs Ingest is bytes processed over the billing period across its services, separate from PostgreSQL table size. It is not a required 8.77 GB file in the database export. Do not copy platform log history, Docker logs or WAL files as application data. Retain a small separate incident report where useful.

Current PostgreSQL verbosity was already modest: log_statement=ddl, duration and connection logs off, minimum messages warning, pgAudit log=none. Reducing ordinary application console messages alone cannot remove Supabase gateway logs. There was no evidence to disable diagnostic errors globally.

The supplied Compose uses Docker local logging with max-size=10m, max-file=5 and compression, about 50 MB of configured message files per web container plus metadata. This is not a 50 MB global cap: reverse proxy, database, OS journal and other containers need their own limits. Inspect the existing server before choosing those settings. SQL data, audit tables, queues and WAL require separate retention/maintenance.

## Prepared application deployment

- next.config.js enables standalone output. The Docker build installs locked dependencies and compiles on Linux; only traced runtime files, static files and public assets enter the final image. Do not copy Windows node_modules or an existing Windows .next build to Linux.
- Legacy route modules create admin clients during build-time route collection. The Docker build supplies an explicitly fake service key rather than a real private credential. Home-page pre-rendering can report unavailable privileged aggregates with that key; start with the real protected runtime env and verify the regenerated home page before DNS cutover. A successful compile alone is not application readiness.
- .dockerignore excludes env files, SSH keys, local backups, .git, test screenshots, caches, design sources and other local artifacts. Private values are runtime inputs and never Docker build arguments. Public Supabase URL/key must be built for the target database; changing only runtime env will not change browser bundles.
- deploy/compose.yaml runs as the image's non-root node user and binds only to 127.0.0.1:3130 by default. It does not seize ports 80/443, alter existing Docker daemon settings, install a reverse proxy or enable any scheduler. Audit resource availability and existing routing first.
- GET /api/health is process liveness without a database call or secret/version disclosure. Validate database/auth/Mini App readiness separately.
- The site already includes a protected Telegram webhook at /api/telegram/webhook. A polling bot and webhook must not be enabled for the same token simultaneously. Inspect the currently running bot before choosing the cutover. CRON_SECRET and TELEGRAM_WEBHOOK_SECRET are absent from the accessible local env; obtain existing production values or generate/coordinate replacements after confirming live topology.

Example after protected runtime configuration, database readiness and image validation:

```sh
docker compose --env-file /etc/ishdasiz-server/build.env -f deploy/compose.yaml build
docker compose --env-file /etc/ishdasiz-server/build.env -f deploy/compose.yaml up -d --wait
curl --fail http://127.0.0.1:3130/api/health
```

These are operator instructions for the selected release; an isolated staging build/up has now been executed, while public cutover remains pending. The build env uses deploy/config.example.env as a names-only template. It points at a root-owned runtime env outside the repository. Application secrets and server login credentials must be separate; never forward SERVER_ssh or SSH_PASSWORD to the application.

Local verification: TypeScript and targeted ESLint passed. The production webpack build completed with standalone output, including a second build with the fake build-time service key. That second build logged the expected unavailable privileged home aggregate; no private build credential is required. The compiled standalone server started locally: health returned HTTP 200 with no-store; unauthenticated webhook and import continuation requests returned 401 without sending messages or running imports. Compose YAML parsed successfully and loopback binding, required runtime env and bounded log settings were checked. Docker is unavailable in the Windows environment; Linux image builds, static assets and Compose execution were subsequently checked on the server as described above.

## Migration and cutover sequence

1. Obtain SSH access and inspect with scripts/audit-server.sh. Record existing projects, mounts, reverse proxy, timers and bot mode. Preserve them.
2. Initial protected full backup and isolated restoration verification are complete on PostgreSQL 17. Preserve both verified copies. Follow the Supabase platform-to-self-hosted restore procedure for the final target; preserve auth users, grants, functions, triggers and history, and regenerate service/API secrets deliberately. The verified snapshot is not a substitute for a fresh final export while source writes continue.
3. Separate unrelated tables only on the tested target with dependency checks and archived recovery copies. Preserve active import leases/queues; do not classify pending channel events as logs. Account for both already-applied performance migrations, 20261031030803 and 20261101101158, when installing earlier missing Mini App prerequisites. See docs/database-optimization-2026-11-01.md for queue verification and the proposed low-memory profile.
4. Configure target API/Auth, private database networking, proxy TLS, resource budgets and bounded logs. Copy only required application runtime artifacts. Set up protected backups outside this single server.
5. Validate the Vercel website against the isolated target, Mini App drafts, authenticated saves, moderation, lookup, matching and bot handling before any public data switch. Paid checkout still requires the separate real Click integration; no paid success is simulated.
6. Coordinate the final source write window and consistent export/restore. Keep the website/domain on Vercel and preserve the source database for rollback. Switch the Vercel database/API configuration only after target TLS, auth callbacks and browser-origin checks pass; browser-visible public configuration requires a rebuilt Vercel release. Switch the bot transport once, without dropping pending updates.
7. Transfer daily import/reference schedules and the five-minute continuation with the same lease protocol; disable the source schedulers before target activation. Preserve disabled channel publication until the new publication rules and worker are verified.
8. Verify production reads/writes, restoration checks, metrics and log rotation. Only then consider retiring old hosting; no automatic source deletion or paid service cancellation.

References: [platform-to-self-hosted restore](https://supabase.com/docs/guides/self-hosting/restore-from-platform), [Docker local log rotation](https://docs.docker.com/engine/logging/drivers/local/), [Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

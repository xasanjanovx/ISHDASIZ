# ISHDASIZ server migration preparation — 31 October 2026

Target supplied by the owner: Hetzner CCX13, 167.235.249.200, 2 vCPU / 8 GB RAM / 80 GB disk. Keep ishdasiz.uz. The owner authorized server deployment and inspection of what data belongs to this project.

## Current access and deployment state

- SERVER_ssh in the specified local .env is an **OpenSSH public key**, not a private key, host/login or password. No matching private key has been found in the current user's .ssh directory. A private-key path or SSH login credentials in a local protected file are required; values must not be posted in chat.
- DNS currently returns A records 216.198.79.1 and 64.29.17.65, with nameservers ns1.vercel-dns.com and ns2.vercel-dns.com. No DNS record was changed.
- Plugin discovery found Vercel available but not installed/connected in this session. Do not claim access or move DNS until actual access is confirmed. Vercel remains the current site host.
- Supabase API and SQL access work through the connector. The accessible application env files still have API keys but no DATABASE_URL or database password. A consistent database export needs session/direct PostgreSQL access; a collection of independent REST pages is not a migration backup.
- No SSH connection, remote installation, live cleanup, database export, bot webhook switch or server deployment has been performed in this preparation.

## Data inventory

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
- deploy/compose.yaml runs as the image's non-root node user and binds only to 127.0.0.1:3100 by default. It does not seize ports 80/443, alter existing Docker daemon settings, install a reverse proxy or enable any scheduler. Audit resource availability and existing routing first.
- GET /api/health is process liveness without a database call or secret/version disclosure. Validate database/auth/Mini App readiness separately.
- The site already includes a protected Telegram webhook at /api/telegram/webhook. A polling bot and webhook must not be enabled for the same token simultaneously. Inspect the currently running bot before choosing the cutover. CRON_SECRET and TELEGRAM_WEBHOOK_SECRET are absent from the accessible local env; obtain existing production values or generate/coordinate replacements after confirming live topology.

Example after protected runtime configuration, database readiness and image validation:

```sh
docker compose --env-file /etc/ishdasiz/build.env -f deploy/compose.yaml build
docker compose --env-file /etc/ishdasiz/build.env -f deploy/compose.yaml up -d --wait
curl --fail http://127.0.0.1:3100/api/health
```

These are operator instructions, not an executed rollout. The build env uses deploy/config.example.env as a names-only template. It points at a root-owned runtime env outside the repository. Application secrets and server login credentials must be separate; never forward SERVER_ssh or SSH_PASSWORD to the application.

Local verification: TypeScript and targeted ESLint passed. The production webpack build completed with standalone output, including a second build with the fake build-time service key. That second build logged the expected unavailable privileged home aggregate; no private build credential is required. The compiled standalone server started locally: health returned HTTP 200 with no-store; unauthenticated webhook and import continuation requests returned 401 without sending messages or running imports. This checked server routes, not the complete Linux runtime or static asset copy. Compose YAML parsed successfully and loopback binding, required runtime env and bounded log settings were checked. Docker is not installed in the current Windows environment, so a Linux image build and Docker Compose execution are still required on an accessible server.

## Migration and cutover sequence

1. Obtain SSH access and inspect with scripts/audit-server.sh. Record existing projects, mounts, reverse proxy, timers and bot mode. Preserve them.
2. Create a protected, consistent full database backup and verify restoration in a separate target. Follow the Supabase platform-to-self-hosted restore procedure; preserve auth users, grants, functions, triggers and history. Use compatible PostgreSQL 17 images and regenerate target service/API secrets deliberately.
3. Separate unrelated tables only on the tested target with dependency checks and archived recovery copies. Preserve active import leases/queues; do not classify pending channel events as logs. Account for the already-applied 20261031030803 import performance fix when installing earlier missing Mini App prerequisites.
4. Configure target API/Auth, private database networking, proxy TLS, resource budgets and bounded logs. Copy only required application runtime artifacts. Set up protected backups outside this single server.
5. Validate website, Mini App drafts, authenticated saves, moderation, lookup, matching and bot handling on the new server before DNS. Paid checkout still requires the separate real Click integration; no paid success is simulated.
6. Coordinate the final source write window and consistent export/restore. Keep Vercel and the source database for rollback. Re-point domain only after HTTPS and target checks. Switch the bot transport once, without dropping pending updates.
7. Transfer daily import/reference schedules and the five-minute continuation with the same lease protocol; disable the source schedulers before target activation. Preserve disabled channel publication until the new publication rules and worker are verified.
8. Verify production reads/writes, restoration checks, metrics and log rotation. Only then consider retiring old hosting; no automatic source deletion or paid service cancellation.

References: [platform-to-self-hosted restore](https://supabase.com/docs/guides/self-hosting/restore-from-platform), [Docker local log rotation](https://docs.docker.com/engine/logging/drivers/local/), [Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

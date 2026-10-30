# Supabase availability and load — 30 October 2026

The owner reported an unavailable database and subsequently clarified that the dashboard shows 97% CPU. This is an owner-reported value; the resource metrics endpoint has not independently returned a sample. The workload responsible for the CPU load has not been identified, and the production instance is not reported as recovered.

## Observed

- The specified `ISHDASIZ NEW/.env` and `.env.local` contain Supabase URL, anon/service-role API keys and application credentials. Neither contains a database connection URL, a database password or a Supabase Management token. Values were not printed or copied into this report.
- The main project and isolated development checkout point to the same Supabase project.
- DNS resolution took about 9 ms, TCP connection about 101 ms, and TLS negotiation about 123 ms. General Supabase status was reachable. Authenticated and anonymous one-row REST reads timed out at 12–18 seconds. The official metrics endpoint also timed out. This isolates the observed delay to after connection establishment, but cannot distinguish CPU, IO, connection saturation or another project-side fault.
- No production SQL, restart, query cancellation, schema change, tariff change, import pause or deletion was performed. Existing user edits in the main checkout were preserved. Further database probes were kept bounded; no load test was run.

## Prepared application improvements

- The Mini App no longer preloads the job catalog while the user is completing a form or viewing home. Search loads on demand.
- Map point pages use a count-free query with one look-ahead row. One separate public aggregate supplies the total instead of recounting the whole table for each page. Existing exact-count callers remain compatible.
- Public map totals and Mini App public bootstrap data reuse a 30-second Next.js data cache. Concurrent cold callers share one in-flight read. Account records, candidates, contact data, sessions and permissions are not cached.
- The map query explicitly filters `is_active=true` to make the existing partial-index predicate available to the planner. All point reads still check canonical availability on each request.
- Public bootstrap requests have an eight-second deadline. Failed reads are not replaced with invented zero counts.

These changes reduce avoidable application work; they have not been deployed and do not by themselves prove that the reported infrastructure incident is resolved.

## Access needed for the next step

Supabase integration is now installed and available. The configured URL was matched to project `awkjrolplhvrscuqqive` (`bolt-native-database-61888304`, ap-south-1); the separate `SELF` project was not modified. The control plane reports `ACTIVE_HEALTHY`, which does not establish SQL/API availability. Performance/security advisory reads timed out. A metadata-only `pg_stat_activity` query with a three-second statement deadline could not establish its SQL connection (`Connection terminated due to connection timeout`). Do not repeat the earlier request to install the integration.

For 16:47:47–17:47:47 UTC (21:47:47–22:47:47 Asia/Tashkent), remote logs were readable. They show:

- 72 HTTP 504 responses on `/rest/v1/telegram_sessions`, average origin time about 130.7 seconds, plus two 525 responses.
- HTTP 504 responses on jobs, users, regions and categories, alongside a few successful small reference reads.
- PostgreSQL SQLSTATE 57014 during ordinary reads, PARSE, BIND and even SET. Monitoring (`postgres_exporter`), dashboard and management queries also time out. Six FATAL messages say `canceling authentication due to timeout`.
- No out-of-memory or exhausted-connection-slot message was identified by the bounded classification query. Their absence in that window does not rule out memory/IO or another resource issue.

The available integration has pause/restore tools but no restart operation. Pause/restore was not used as a substitute for restarting an active production project. The owner was asked to use **Restart project** in this project's General settings and report when it completes. No restart, paid upgrade, query cancellation or writable SQL was performed. Restart may provide only temporary recovery and is not a diagnosis of the original load.

Once SQL becomes reachable, read active queries, blockers, normalized statement statistics, memory/IO and schedule metadata before changing anything. Apply no Mini App migration while the incident is unresolved. The Management API's documented restart operation is `POST /v1/projects/{ref}/restart`; an API-key-only environment does not authorize that endpoint.

`scripts/diagnose-database-health.sql` is a metadata-only, read-only, five-second diagnostic prepared for that connection. It does not expose SQL text or cron commands and makes no changes. Follow the evidence: fix the demonstrated query/index/retry issue, or pause a demonstrated runaway task, rather than guessing from an upgrade banner. Any paid compute change needs the actual size and price agreed with the owner first.

References: [Supabase high CPU](https://supabase.com/kb/troubleshooting/high-cpu-usage), [disk IO](https://supabase.com/kb/troubleshooting/exhaust-disk-io), [Metrics API](https://supabase.com/docs/guides/observability/metrics).

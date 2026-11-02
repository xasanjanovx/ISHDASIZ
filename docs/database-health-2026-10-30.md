# Supabase availability and load — 30 October 2026

The owner reported an unavailable database and subsequently clarified that the dashboard shows 97% CPU. The 30 October observations below describe the outage. SQL, REST and metrics became reachable on 31 October; the measured recovery and a narrowly scoped production import fix are recorded in the follow-up section. The original 97% peak has not been independently reproduced or conclusively attributed.

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

## 31 October: connectivity recovered; import summary fix applied

The supplied dashboard screenshot shows two Nano projects and organization Free usage: database 723/500 MB and log ingestion 8.77/1 GB. Only ISHDASIZ project `awkjrolplhvrscuqqive` was accessed for SQL changes; the separate SELF project was not modified. Database quota is an organization/billing-period metric, not current disk fullness or CPU utilization. Official documentation distinguishes the 500 MB quota from the Free project's physical disk threshold and notes that reducing live data does not immediately lower the period average.

### Measurements before the fix

- SQL answered at 02:59:43 UTC (07:59:43 Tashkent). PostgreSQL reported a start time of 23:00:34 UTC on 30 October; this agent did not initiate that restart. Read-only mode was off, max connections 60, shared buffers 224 MB.
- At 03:00:29–03:03:36 UTC (187 seconds), deltas of `node_cpu_seconds_total` across both visible CPUs were 71.98% idle, 21.28% IO wait and about 6.74% execution/other non-idle modes. This is a short host-level interval, not proof about the earlier reported peak or long-term Nano capacity.
- Usable memory was about 406.5 MiB. Available memory rose from about 116 to 185 MiB between samples; swap occupied about 416–441 MiB. Occupied swap alone does not establish active swapping.
- Bounded one-row REST probes returned HTTP 200: public jobs about 267–326 ms, service jobs about 679–804 ms, regions about 265–352 ms. No lock backlog or long active client query was present in the initial activity snapshot.
- Live database size was 707,464,339 bytes (about 707 MB / 674.7 MiB). Largest total relations: jobs 332.6 MB, import items 170.7 MB, sync events 125.1 MB, import state 39.2 MB.
- Reset/stale activity counters initially estimated zero live import items. An actual count found **299,412** items. Catalog estimates were about 296,210 items; no table was assumed empty or truncated.
- Sync events contained **417,857 pending events**, including 376,130 job upserts for 15,467 distinct jobs. Pending work was not deleted, marked delivered or published. Import items included 216,371 rows from completed runs, 68,892 failed and 14,149 running; almost all were still inside the existing retention period.
- The active five-minute import schedule was preserved. The most time-consuming normalized application RPC was `ishdasiz_osonish_refresh_batch`: 1,679 calls, about 496 seconds cumulative execution and 295.4 ms mean in the initial statement snapshot. These cumulative values include IO and do not establish a direct CPU percentage.

### Applied change

`20261031030803_osonish_deferred_batch_progress.sql` is installed in production history at 03:08:03 UTC. The file was initially generated with Supabase CLI 2.122.0 and then aligned to the version generated by the connected migration API. Exact hashes of the three live function bodies were checked before replacement.

Previously each refreshed item produced two full queue summaries whose intermediate results the batch discarded: ten summaries for five items. Private mutation helpers now perform the identical guarded work and the batch computes **one final exact summary**. The existing single-item RPCs still return their exact summary, and their service-role access and signatures remain compatible. No business data, queued events, lease rules, retention, schedules or channel publication choices were changed. No paid upgrade or new Mini App feature migration was applied.

Validation: all **74** source-import and scheduler database tests passed (67 import tests), including five-item completion, one-summary instrumentation, late-item transaction rollback, stale leases, source verification, closed owners, local overrides, retention and private helper grants. Live postflight confirmed both helpers return void and are inaccessible to anon and service_role directly; the three public RPCs retain service-role-only execution. Security Advisor findings were unchanged before/after; existing unrelated RLS/view warnings require a separate access-model audit rather than a blind permissions rewrite.

The next ordinary scheduled continuation resumed the existing details-phase run with a live lease. Between 03:08:14 and 03:10:47 UTC, statement counters increased by 38 batch calls and 4,202.4 ms: about **110.6 ms/call**, compared with the earlier cumulative mean of 295.4 ms. This is a small observational sample with different job payloads, not a controlled throughput benchmark. Host counter deltas at 03:08:16–03:10:44 UTC (148 seconds) were **93.91% idle, 4.33% IO wait and 1.76% execution/other**. Final one-row REST reads remained HTTP 200 (regions 329 ms, service jobs 527 ms, public jobs 322 ms). These checks demonstrate current response and real importer progress; they do not prove the earlier outage cannot recur.

A bounded log aggregation at 03:08:05–03:11:00 UTC returned 88 REST HTTP 200 and four HTTP 204 responses, with no REST error status or PostgreSQL ERROR/FATAL/PANIC entry in that queried window. This is subject to log ingestion delay and covers only the selected interval.

The original function definitions are preserved in `supabase/operations/rollback-osonish-deferred-progress.sql` for an intentional rollback only. Do not replay historical importer migrations after this follow-up: they would restore the repeated summary work.

The storage overage and redundant pending reconciliation backlog remain unresolved. Full compaction would not make live rows disappear; deleting pending work without checking canonical reconciliation, delivery intents and worker concurrency would be unsafe. No blanket cleanup or index removal was performed.

References: [database size, vacuum and Free quota](https://supabase.com/docs/guides/platform/database-size), [inspection and statement statistics](https://supabase.com/docs/guides/observability/inspect), [existing RLS-disabled advisory](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public), [duplicate-index advisory](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index).

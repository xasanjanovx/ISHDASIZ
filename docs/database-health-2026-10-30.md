# Supabase availability and load — 30 October 2026

The owner reported a CPU/compute warning and an unavailable database. The exact dashboard warning is requested but has not yet been supplied. This report does not claim a confirmed CPU root cause or a repaired production instance.

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

Supabase integration was found but is not yet installed/connected. Once the owner connects it to this project, read current project status, active queries, blockers, top normalized statement statistics, memory/IO and schedule metadata before deciding on changes. An owner-provided SQL-capable credential file is an alternative. Do not treat a service-role REST key as a Management token or database password.

`scripts/diagnose-database-health.sql` is a metadata-only, read-only, five-second diagnostic prepared for that connection. It does not expose SQL text or cron commands and makes no changes. Follow the evidence: fix the demonstrated query/index/retry issue, or pause a demonstrated runaway task, rather than guessing from an upgrade banner. Any paid compute change needs the actual size and price agreed with the owner first.

References: [Supabase high CPU](https://supabase.com/kb/troubleshooting/high-cpu-usage), [disk IO](https://supabase.com/kb/troubleshooting/exhaust-disk-io), [Metrics API](https://supabase.com/docs/guides/observability/metrics).

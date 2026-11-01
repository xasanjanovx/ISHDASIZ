# Database optimization — 1 November 2026

Production project: awkjrolplhvrscuqqive (ISHDASIZ). The separate SELF project and the server's unrelated PostgreSQL 18 instance were not modified. The site/domain remain on Vercel; database export/restore to the server is still pending.

## Applied change and verification

Supabase recorded migration **20261101101158_channel_pending_coalescing_and_duplicate_indexes** at 10:11:58 UTC. The file in supabase/migrations has the same version and SQL. It changes three narrowly scoped pieces:

- The queue claim has an ordered partial index on sync_events(created_at,id), restricted to pending/failed events with attempts below eight. Before the change, the real claim plan used a sequential scan and sort of the backlog; afterward it uses ishdasiz_sync_claim_order_idx with no sort. Both plans include FOR UPDATE SKIP LOCKED. These production checks used EXPLAIN without executing a claim.
- Repeated edits reuse an untouched, due pending event for the same job, action and region. The worker reads the current canonical vacancy. The trigger locks that pending row; if a worker already holds it, SKIP LOCKED causes a separate follow-up event. Processing, completed, failed, retried, leased, delayed and explicit-payload events are preserved. No existing event is deleted, completed or acknowledged by this migration; no Telegram publication or worker activation occurs.
- Four exactly redundant indexes are removed after validating complete index semantics, validity and constraint dependencies. The retained indexes are idx_jobs_employer_id, idx_jobs_status, idx_jobs_source_unique and idx_resumes_status. In particular, source/source_id uniqueness is retained. The migration aborts if a named pair is not equivalent.

The duplicate indexes occupied 5,341,184 bytes. The necessary claim index occupies 19,537,920 bytes. Total database size changed from 731,786,387 to 747,064,467 bytes: **this is a reduction of scanning/sorting and redundant write work, not an immediate reduction of total database disk size**. The source remains over its Free database quota. Existing queue rows are operational state, not disposable log history.

Security Advisor findings were unchanged after the change. Performance Advisor's four duplicate-index findings disappeared. Existing unrelated RLS and function findings remain for separate application-aware remediation; no access policy was broadened. The trigger function remains private with a fixed search_path. DDL used a one-second lock timeout, twelve-second statement timeout and 16 MB maintenance_work_mem.

An ordinary-traffic observation from 10:13:31 to 10:16:16 UTC counted 770 job updates and no newly inserted queue rows. This is not a controlled measurement of the trigger's savings: timestamp-only updates were already excluded before the change.

## Verification

The final local database suite passed **120 tests**:

```sh
node --test tests/channel-sync-state.test.cjs tests/mini-app-migration.test.cjs tests/source-import-state.test.cjs
```

Coverage includes event preservation, region/deletion transitions, latest canonical state, unique source identity, rollback on non-equivalent indexes, Mini App permissions/quota/atomic saves, and existing import source/lease safeguards.

tests/channel-optimization-native.py also passed against real PostgreSQL 17.11 in a disposable server container with no network or published ports, a 512 MiB memory limit and only synthetic rows. With 30,000 synthetic queue events, the measured claim changed from **28.221 ms** (sequential scan plus external merge sort with 6,816 KB disk sort) to **0.116 ms** (ordered index, one row, no sort). These are fixture results, not production latency claims.

One thousand edits produced one pending event. A real second session holding the event lock did not block a concurrent edit: it created a follow-up, leaving one processing event and one pending event. The measured edit took 59 ms. The test container was stopped and removed after verification. The server report is retained at /opt/ishdasiz-server/state/optimization-native-report-20261101.json.

The application REST checks for regions and public/service job reads returned HTTP 200 after application of the migration.

## Memory profile for the target

deploy/postgres-memory.conf is an **initial profile for a new isolated PostgreSQL 17 target**, tested with the synthetic fixture. It has not been applied to the cloud source or unrelated server databases.

| Setting | Source at inspection | Proposed new target |
| --- | ---: | ---: |
| shared_buffers | 224 MiB | 128 MiB |
| work_mem | 2,184 KiB | 1 MiB |
| maintenance_work_mem | 32 MiB | 16 MiB |
| autovacuum_work_mem | inherits maintenance | 16 MiB |
| max_connections | 60 | 30 |
| max_parallel_workers_per_gather | 1 | 0 |

The proposed shared buffer allocation is 96 MiB smaller. work_mem applies per sort/hash operation and can multiply across queries and sessions; max_connections is a concurrency ceiling, not a preallocated memory budget. effective_cache_size is a planner estimate and reserves no memory. Autovacuum remains enabled.

The synthetic container used about 116.9 MiB at its brief Docker sample. It did not contain the restored live database or the full Supabase API/Auth stack. Before production, restore actual data, size all service connection pools within the connection budget, and measure representative reads/imports/auth/queue work with headroom for the server's other applications.

Source host samples showed 142.7 MiB available at 09:53:03 and 209.2 MiB at 10:13:33 UTC, while used swap increased by about 38 MiB. **These samples do not establish a causal RAM saving.** Source global memory settings were not changed. Do not promise resolution of the prior 97% CPU peak from this observation alone.

## Rollback and remaining migration dependency

supabase/operations/rollback-channel-producer-20261101.sql restores only the previous event producer if needed, preserving all data and the useful ordered claim index. Removed exact duplicate indexes need not be recreated. No rollback was performed.

Later on 1 November the owner saved PostgreSQL settings under DATABASE and SUPABASE_DATA_PASSWORD. The password passed the real session-pooler check. A consistent archive was then created and restored into a network-isolated PostgreSQL 17 instance; all 99 exported data-table counts match, including every public/Auth table. With actual restored data the initial profile used about 188 MiB in a brief sample after ANALYZE, under a 512 MiB container budget. This still excludes API/Auth services and production concurrency. No source business/queue row was deleted. Full public migration and Mini App feature rollout remain incomplete. See [the restore report](database-restore-2026-11-01.md).

References: [Supabase agent skills](https://github.com/supabase/agent-skills), [PostgreSQL memory settings](https://www.postgresql.org/docs/17/runtime-config-resource.html), [Supabase duplicate-index advisor](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index), [platform-to-self-hosted restore](https://supabase.com/docs/guides/self-hosting/restore-from-platform).

# Vercel and server connection, 2 November 2026

## Verified production context

The Vercel CLI authenticated to team `team_WbpLRSZwGvbfrkd3zu0WaJQa` (`xasanjanovx-2972s-projects`). `domains inspect ishdasiz.uz` confirms the apex and www belong to **ishdasiz-hp69**, project `prj_45KGAoAjrYybeunjybhM3IQfZRTF`. The similarly named `ishdasiz` project is not the primary-domain project. Production currently serves commit `f1b5d3b3f5ecd89f424c28a414c222878381fb30`, deployment `dpl_654g5WTKNPqi1REW1wVNZiSAKz2L`.

Production environment and project metadata were saved in an owner-only directory outside Git. Three sensitive environment values cannot be exported by Vercel; their placeholders must never be deployed as credentials. The actual production `AUTH_SESSION_SECRET` was exportable and must be preserved when changing database API keys.

## Completed DNS and HTTPS

Vercel nameservers remain authoritative. Only two explicit records were added:

| Name | Type | Address | Record ID |
| --- | --- | --- | --- |
| api | A | 167.235.249.200 | rec_a90e277f8b61640447777b91 |
| bot | A | 167.235.249.200 | rec_128230ec27f39eb709d9dddf |

The existing apex, wildcard and CAA records were preserved. `ishdasiz.uz` and `www.ishdasiz.uz` continue to serve Vercel.

`scripts/prepare-staging-https.py --permanent` verifies both new hosts resolve exclusively to this server, uses the existing ACME webroot and Certbot renewal hook, and installs only `ishdasiz-public-20261102.conf`. The certificate covers both names and expires 31 January 2027. Existing unrelated server vhosts and the temporary verification routes remain intact.

Six external HTTPS checks passed with normal certificate verification: API health 200, API request without key 401, bot health 200, hidden bot root 404, unsigned webhook POST 401, primary site HEAD 200. No Telegram message or transport switch occurred.

## Pending data and application switch

The target still contains the earlier verified snapshot. A fresh source read found 686 application users and 480,945 reconciliation events, compared with 684 and 480,928 in that snapshot. **Do not promote the old copy.** Source jobs remained 52,361 at this check.

Prepare and verify the application against the server API first. Then coordinate a temporary source write fence and scheduler pause, take a new consistent export, restore and verify the new copy, and apply the target-only access/storage migrations. Preserve the phone-session signing secret, account data, leases, queues and a rollback copy. Switch Vercel's database configuration and the Telegram webhook only after these checks. Do not run two import/channel workers or acknowledge unsent channel events.

The server stack has bounded Docker local logs (10 MB × 5 per container, compressed). An idle sample used about 110 MB across PostgreSQL, REST, Auth and gateway; this is not a production load benchmark. Full-source historical Supabase analytics logs were not migrated.

## Application staging and write-fence preparation

The rebuilt `ishdasiz-web:a58ddb4` uses the server API, preserves the production phone-session signing secret and keeps Telegram dry-run enabled. Eight HTTP checks passed, including search, home counts, real Mini App storage with 14 regions/209 districts, and rejection of private unauthenticated reads. A Vercel branch Preview also passed seven API/page checks against that server API. Production aliases and database environment have not been switched by these staging steps.

The Google Cloud Vertex key returned HTTP 200 with a complete synthetic JSON response. The branch Preview now has a server-only Vertex secret. Browser catalog CORS also permits the exact reviewed branch alias, without permitting arbitrary Vercel hosts.

`supabase/operators/install-server-cutover-fence.sql` was installed on the source through a recorded migration, with **enabled=false**. It covers 73 ISHDASIZ public/Auth/Storage tables. Managed provider migration/vector metadata and historical `bot_*` tables are excluded. The other running SELF bot was confirmed to use the separate `nxehjjrxtwotdcalzpzb` database. No unrelated project was paused.

A transactionally rolled-back native test blocked public, Auth and Storage writes while retaining reads and denying service-role access to the private control table. The source test also blocked public/Auth statements and confirmed the flag remained false afterward. The first cloud installation attempt failed on managed Auth migration-table permissions and rolled back completely; the installed operator explicitly excludes that metadata.

The source fence must remain disabled until the destination refresh and rollback operators are ready. At actual cutover, pause the source scheduler and preserve pending Telegram updates, enable the fence before exporting, and remove it only from the verified restored target using `remove-target-cutover-fence.sql`. Retain the fenced source for rollback. The historical channel queue contains about 481,000 pending reconciliation events; do not start an unrestricted channel worker as a migration step.

Controlled HTTP saves against the unpublished server clone also passed: authenticated vacancy creation, idempotent retry, resume creation with real Vertex moderation, and an owned listing containing exactly one of each. The synthetic account/records/events were removed in a guarded cleanup; user/job/resume/event/record/order counts returned to their original values. No SMS, channel request, paid order or Telegram message was sent.

`scripts/pause-source-for-cutover.py inspect` is read-only and verified the source fence was disabled, its sole Osonish schedule active, the legacy polling container stopped, and the existing webhook on the primary site. The `pause` action saves rollback configuration, removes the webhook without dropping updates, locks the guarded application tables, enables the source fence and pauses that schedule. `resume` restores the exact source schedule/webhook only before target promotion. After production writes begin, a rollback requires reconciling those writes.

`scripts/refresh-private-backend.py` defaults to a read-only preflight; it confirmed the unpublished target had no new business records. Execution requires a fresh consistent archive created after the recorded source pause. It retains the old target database as `before_cutover_20261102`, restores on the network-isolated container, verifies the archive and all data-table counts/Vault, removes the fence only from the target and reinstalls the target-only migrations. Never start both database containers on their shared volume.

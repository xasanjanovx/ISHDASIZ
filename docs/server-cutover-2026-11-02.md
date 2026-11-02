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

# Mini App integration — 30 October 2026

The connected implementation is prepared for review. It has not been deployed, and the new SQL migration has not been installed in the live database.

Implemented:

- Server routes in `app/api/mini-app`: bootstrap (real refs/counts), catalog, Vertex assistant, account-owned records and channel request; salary aggregates cache each source version and recommend +10% explicitly.
- `lib/mini-app` validates incoming data, maps fields to native records, keeps secrets server-side, moderates publication and provides durable AI budget/cache adapters.
- `20261030120000_mini_app_integration.sql` provides private metadata, atomic owned/idempotent save, a shared AI ceiling, one free channel reservation, and prevents website saves from auto-posting. It has NOT been applied to production. No DATABASE_URL or Management API credential was found; a question asking for a credential file path is pending.
- The compiled client in `public/mini-app-preview` has seven stages per form, live district search with derived regions, employer-paid benefit cards, reviewed AI proposals, first-step-only 0-so‘m copy and contextual stage animation. The local source builder includes `journey-features.js` and `connected-features.js`; the official Telegram SVG is in the sync allowlist.

- Drafts persist locally per verified account or guest. The form can be filled anonymously; final save uses the existing real session, linked Telegram validation or phone OTP. Unknown numbers ask for a registration choice first. No role selector is shown.
- Public catalog/map counts and points come from Supabase. The map loads 200 real points initially and then more on request. Native own listings, views and applications use authenticated APIs. A transient map SQL timeout is retried once; an unavailable read is never presented as zero jobs.
- Private delivery confirmation records unlock only matching candidates for that active owned vacancy. Changes to criteria, ownership or receipt availability revoke access. Queued orders and client flags cannot grant it. Candidate phones require another server check; private coordinates never leave the matching service. Detailed resume views are deduplicated per employer/resume/Tashkent day.
- Resume completion fetches matching jobs. Profession and explicit work format are hard constraints; compensation, experience, days, employment, education, languages and distance explain exact/partial matches. Reads are bounded to 300 candidates or 200 jobs, with up to 50 displayed results; matching is deliberately conservative for unknown legacy work formats.

## Verification

Run from the repository:

```sh
npm run typecheck
npx eslint app/api/mini-app app/api/map/jobs app/mini-app app/mini-app-preview lib/mini-app lib/account-vacancies.ts
npx jest --runInBand __tests__/mini-app-api.test.ts __tests__/map-jobs-api.test.ts __tests__/vertex-client.test.ts __tests__/account-resumes.test.ts __tests__/vacancy-draft.test.ts
node --test tests/mini-app-migration.test.cjs
node --import tsx --test tests/mini-app-domain.test.ts
python tests/mini-app-journey.e2e.py http://127.0.0.1:8778/
python tests/mini-app-journey-audit.py
```

The Python checks use a static server on 8778 and mock every API/SMS/AI/publication response. SQL tests install the actual release plus the new migration into isolated PGlite, covering ownership, idempotency, one free reservation, delivery proof, permission revocation, deduplicated views, quota and RLS. No live database mutation, SMS, Telegram post, broadcast or charge was performed during verification. Earlier local-only preview scripts are historical tests, not this release's acceptance suite.

Live read-only checks returned 11,868 jobs and 6,549 jobs with coordinates; CV totals changed from 126 to 127 during ordinary service activity. Counts are read live rather than embedded. The new private storage probe returned `storageReady:false`.

## Rollout dependencies

1. Inspect live schema and migration history through the connected Supabase integration. Verify that the audited October release is already installed; do not blindly replay the release package. Apply only confirmed missing prerequisites, including `20261027090000_main_employer_channel.sql`, before the new `20261030120000_mini_app_integration.sql`. SQL recovered on 31 October and the independent `20261031030803_osonish_deferred_batch_progress.sql` performance fix is already installed; preserve it when planning earlier pending feature migrations. Storage quota and sustained health still need resolution before the Mini App rollout. Secrets must never be sent in chat or committed.
2. Deploy the site and the matching channel worker together. The new target rule prevents website saves from auto-posting. Point the bot's Mini App URL to the deployed same-origin `/mini-app` route. `/mini-app-preview` also redirects to the static entry file.
3. Verify authentication, moderated saving, receipt proof and the actual channel worker on controlled staging accounts before release. The locally tested Vertex transport uses `GOOGLE_CLOUD_API_KEY` or `gemini_cloud_api` server-side; anonymous and moderation requests share a durable ceiling of 100 calls/day, with 8/day and 2/minute per identity. Review these limits for production volume.
4. Click checkout credentials/callback verification, paid repeated schedules/broadcasts and generated paid channel media remain a separate integration. The current channel route returns `paymentReady:false` for paid requests; the client states that payment is unavailable and preserves the website listing. No paid success is simulated. The new channel/proof flow applies to Mini App-created records; older native records can be read/edited/archived but are not silently given new publication proof.

Current development URL: `http://127.0.0.1:8779/mini-app`. Use webpack because this worktree's shared `node_modules` junction is incompatible with the local Turbopack root. Do not mistake local verification or the draft PR for a production rollout.

## Subsequent database availability report

The owner subsequently reported a CPU/compute warning and database outage. One-row API reads and metrics timed out despite fast TCP/TLS connection establishment. SQL, REST and metrics recovered on 31 October. See `docs/database-health-2026-10-30.md` for the measured interval, oversized queues, production import-summary fix and remaining storage/health work. This does not constitute a production Mini App rollout.

The load follow-up removes hidden catalog preloading, separates map pages from whole-table counts, explicitly filters active map rows and shares public bootstrap/map-count reads through a 30-second Next.js data cache with in-flight coalescing. No account/candidate/contact/permission response is cached. Existing exact-count map clients remain compatible. These changes are prepared and tested, not yet deployed; they do not establish the root cause of the infrastructure warning.

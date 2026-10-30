# ISHDASIZ Discovery preview

Serve this directory through HTTP: `python -m http.server 8777 --bind 127.0.0.1`. Open http://127.0.0.1:8777/ ; `review.html` shows sixteen screens.

The main cards are **Xodim izlash** (create a vacancy) and **Ish topish** (create a resume). The duplicate small actions are removed. A Tashkent map with record-based vacancy/resume counts follows, then a single profile/listings/applications row. A dismissible intent dialog appears after three seconds on a first home visit with no own records or entered draft.

Resumes save only to the local database and are always free. They have no channel option or tariff. Vacancy website saving is free; the first channel vacancy is free, repeated channel vacancies use the existing plans. Candidate identities/contacts remain hidden until final channel-publication confirmation for that exact vacancy. The grant never opens a different vacancy's candidate list; changes to matching criteria require renewed publication. The preview's local storage is not security enforcement.

Matching requires profession/known alias and work format. Soft mismatches are shown separately with reasons. Voluntary coordinates allow approximate straight-line distance; a city name never produces invented kilometers. CV home coordinates are not rendered on the public map or returned in detail links. The map uses locally vendored Leaflet 1.9.4 and attributed OpenStreetMap tiles; no API key is needed for this preview. Tile availability has a list fallback.

Source helpers and QA scripts stay in the local design workspace. Runtime includes the compiled flow JS/CSS, public catalog (1,037 profession titles, 14 regions, 209 districts), original logo/professions/fonts and the licensed map runtime. No credentials or private production records are exported.

Validation: `verify_discovery.py` covers the new forms, welcome, GPS consent, matching, gate and channel scenarios; `audit_flow.py` checks responsive layout, all sixteen routes, both themes and contrast. JavaScript syntax and packaged resources are checked separately. Repeated automated map tests mock tiles to avoid unnecessary external requests. Screenshots of the map use real tiles.

**Not live:** no real account login, SMS, charges, AI moderation, Telegram messages or production DB writes occur. Entries, applications, publication proofs and resume events are local demonstration data. Production rollout requires verified server identity, private coordinate storage, server-side matching and CV permissions bound to the published vacancy version, actual Telegram confirmation, verified checkout and atomic allowance enforcement. Do not merge this design preview as a complete bot deployment. See DESIGN.md for the current product contract.

Reproducible repository QA: serve `public/mini-app-preview` on port 8778, then run `python tests/mini-app-discovery.e2e.py http://127.0.0.1:8778/` with Python Playwright and its Chromium installed. The script mocks repeated map tiles and uses demonstration identity/storage only.


30 October form update: the welcome is centered; map demo copy is removed while data remains local. Activity sector is hidden and inferred from 999 public profession mappings, 11 existing categories and 38 fallback rule groups. Unknown titles do not block progress. Position/company-or-organization/region form the first vacancy step. Remaining select fields have polished accessible popups; short hints and a 0-so‘m free-saving card clarify the process. `sectors.js` contains public reference metadata only. No production database, accounts, posts or AI settings were changed.


## Publication copy and typography — 30 October 2026

The large 0-so‘m form card and optional-channel caption are replaced by one non-interactive line directly beneath the page title. Eligible vacancies say “Sayt va kanalda bepul joylang”; after that account has used its free channel publication, only the website is described as free. No first-use quota explanation or channel price appears while completing/reviewing the form. The normal publication button checks the allowance after the click and opens existing prices if payment is required. Listing repost actions open review first; the menu no longer links directly to tariffs. CVs always say they are free and saved in the resume database, with no channel option.

The interface now uses the existing self-hosted full Inter Variable face (optical size and weight axes), including Uzbek Latin and Cyrillic. Headings, field labels, input values, options and action text have a coordinated size/weight/tracking hierarchy; helper text is more readable. The original logo remains an image. This supersedes the earlier Onest and 0-so‘m-card design notes. The packaged flow and form checks validate the updated delayed-price behavior and typography; the preview still does not post, charge or authorize production data.


## Animated placement seal and comparable compensation — 30 October 2026

The free-placement message is right aligned with an original CSS/SVG ruby gift seal, quiet shine and a small animated sparkle. It is informational, not a button. Reduced/disabled motion removes the animation; hidden-page/modal pauses also apply. Existing free-channel eligibility and delayed prices remain unchanged.

Vacancies now have seven steps: role/organization/region, schedule, location, requirements, duties, compensation, contacts. Resumes have five: identity, skills, location/work format, expected compensation, contacts. Legacy draft contact steps migrate forward without discarding entered amounts. Both forms explicitly choose month, shift, hour or service in UZS; shift length and service scope are clarified when relevant. Per-unit draft amounts survive toggling/reload and are never converted silently. Amounts have grouped digits, an entered-value summary, positive integer/range validation and a negotiated-payment option. A large difference from comparable offers produces a non-blocking check hint.

The estimate uses only explicitly typed, non-sample, non-archived vacancy records from the last 90 days matching canonical profession, region, work format, employment and experience. Currency/period must match; shifts also match duration and services match the normalized scope. The current vacancy/account are excluded. Repeated vacancies are reduced to one median contribution per employer, outliers are removed with 1.5-IQR fences, and at least five independent employers must remain. The shown center is the median, with a 25th–75th percentile typical range and visible count/window. Users choose whether to apply that range. Missing/insufficient data shows no number. It is an estimate of advertised offers, not actual take-home earnings.

The local preview calculator uses browser-local records only. Demo jobs, legacy records without explicit units and unrelated professions are not market evidence. No public salary dataset with reliable time units has been connected, and no market numbers are fabricated. Production rollout needs server-side period/currency/shift/scope persistence and a fresh, validated aggregate source with the same cohort rules; existing jobs.payment_type describes a payment method, not the monthly/hourly period. Matching and numeric search filters now also distinguish payment bases; the job-specific candidate grant fingerprint includes them. No production migration, API call, post or charge is performed by this preview.

Compensation QA uses explicitly synthetic fixtures, never shipped as real averages. It covers units/scope/duration, minimum sample, independent employers, outliers, currency/freshness, amount grouping, unit drafts, negotiated pay, validation/warnings, range application, period-aware matching/filtering, five viewport sizes/both themes and reduced/disabled motion. Existing full vacancy/CV journeys follow the new later compensation steps.

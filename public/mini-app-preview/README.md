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

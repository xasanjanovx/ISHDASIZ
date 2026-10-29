# ISHDASIZ Discovery — 29 October 2026

## Current brief and composition

Remove the small employee/job-search buttons. The two main dimensional cards now say “Xodim izlash” and “Ish topish”; they begin vacancy and resume creation respectively. The existing four-phase typed hero and eight professions remain. Under the cards, show a real interactive map centered on Tashkent at zoom 12, with professional job/CV count markers. Profile, own listings and applications form one compact row below the map. The large promotional and profile blocks are removed.

| Before | Current behavior |
| --- | --- |
| Separate small search buttons duplicated the main intent | Two main creation paths; map counts lead to discovery. |
| Large profile card occupied another row | Three equal account shortcuts in one row at the bottom of home. |
| Resume could be sent to the channel | Resumes save to the database only, always free, without a channel checkbox, tariff or quota. |
| Any user could inspect the local CV catalog | Only aggregate counts before publication; matching candidate identities and contacts require the specific vacancy's confirmed publication. |
| Position-only recommendations | Canonical profession and confirmed work format are required; salary, experience, region/distance, employment, days and languages identify partial matches. |

## Creation and channel rules

Website vacancies and database resumes are free. Filling a form or saving to the website does not publish to Telegram or unlock candidates. The first channel vacancy per account is free; repeated vacancy channel posts use the existing 59,000 / 89,000 / 119,000 / 209,000 / 359,000 UZS plans. CV channel publication and CV pricing have been removed from the current flow. Six vacancy and four resume question steps lead to one review. Resume work format must be chosen so matching does not invent it.

A confirmed channel vacancy grants access only to candidates eligible for that exact active vacancy, not to the entire catalog or another vacancy. The local grant is tied to owner, vacancy ID and canonical matching criteria. Changing those criteria invalidates the old grant until a new channel publication is confirmed; formatting-only salary/alias differences are normalized. Archiving invalidates access. There is no arbitrary account-wide or time-based access plan in this preview; the user's clarification was vacancy-specific access.

Before publication, show total active CV count and the count potentially matching the vacancy. Do not render names, contacts, CV cards or private coordinates behind a visual overlay. Enforce the same presentation guard on search, recommendation cards, direct detail/contact actions and incoming applications. Owners can always inspect their own resumes. The candidate context is chosen per account and vacancy. A paid demo checkout alone does not unlock candidates; final publication confirmation does.

## Matching and proximity

Use canonical public profession titles and known aliases, with matching work format required. Missing work format does not qualify. Salary, required experience, region, employment, days and known language requirements create visible clarification reasons. Display “Mos” and “Aniqlashtirish” separately rather than fabricated AI compatibility percentages. No claim is made that free-text requirements have been fully understood by AI.

When both parties supplied valid coordinates, compute approximate great-circle distance and label it as straight-line distance. Do not invent kilometers from a city/district name. Without coordinates, display only available region/district facts. Remote work does not impose a geographic-distance constraint. Job details show actual entered requirements, duties, schedule, salary, address and an external map link when a valid work point exists. Contact access remains authenticated.

On-site/hybrid vacancies require a work point selected with an actual map click; remote jobs do not. Changing the job region/district clears its stale point. A resume location is voluntary, can be removed, and is requested only after a separate explicit action. Store the browser-provided accuracy; never silently request GPS on entry. Do not place individual CV home points on the public map or expose them in candidate detail links. Public CV markers are region aggregates. Counts reflect the three labeled sample jobs, one labeled sample CV and active local records, not an invented live audience. The visible demo qualifier identifies this data boundary.

## First visit

After three seconds on home, first-time visitors with no own vacancy/resume see an animated intent dialog: “Xodim izlayapman” or “Ish izlayapman”. These open the corresponding form and do not assign permanent account roles. The dialog has a clear later/close path and is marked seen only when displayed. It does not interrupt a form, entered draft, another modal, hidden tab or the read-only iframe gallery. Existing accounts with local records do not see it. Keyboard focus initially announces the dialog heading, not a preselected intent.

## Map and motion

The preview vendors the site's installed Leaflet 1.9.4 distribution and original license. Tiles use https://tile.openstreetmap.org/{z}/{x}/{y}.png with visible attribution, normal browser caching and no prefetch/download facility. A failed tile request has a readable list fallback. The map does not intercept page scrolling through wheel zoom. Counts navigate to the appropriate list; CV navigation respects the publication gate. References: [Leaflet 1.9.4](https://leafletjs.com/reference.html), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

Onest, blue employer emphasis, pearl/citron seeker styling and the accepted contour background remain. Main controls have 44px minimum targets. Native Telegram fullscreen, safe areas, reduced/disabled motion, keyboard focus and modal/hidden-page pauses remain. The first-visit art reuses the existing dimensional CSS document/briefcase objects. No image generation or additional animation runtime was introduced.

## Preview boundary and production contract

This is an interactive local design preview. Browser storage, demonstration login and publication confirmation are not production security boundaries. No SMS, charge, production database mutation, AI moderation or Telegram publication occurs. Local data is not a production database and is not shared across real users.

Before rollout, the server must persist resumes and onboarding state under verified identity; record confirmed Telegram message IDs and vacancy versions; authorize every CV list/detail/contact request against ownership plus that vacancy's successful publication; run matching and aggregate queries server-side; keep seeker coordinates private and return derived distance instead; enforce the free-vacancy allowance and verified payment/idempotent posting atomically. A client flag, checkout attempt or claimed Telegram post is insufficient. Server permission checks and live bot/device integration remain outside this design PR.

## Verification

`verify_discovery.py` exercises first-visit timing/dismissal/record suppression, both creation paths, full CV save with voluntary GPS, no CV channel/fees, matching job details, pre-publication identity/contact protection, specific-job grants, different-job isolation, normalized criteria revocation, paid republication, partial matches, reload, map picking and non-fabricated distance. Tile images are mocked for repeated automated checks; live screenshots use actual Tashkent tiles. `audit_flow.py` covers sixteen routes, both themes, eight home viewport sizes and contrast. Existing draft, media, host, application and typed-hero checks remain relevant where their prior business assumptions still apply; older resume-channel tests are historical and superseded.

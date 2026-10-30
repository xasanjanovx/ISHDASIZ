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

On-site/hybrid vacancies require a work point selected with an actual map click; remote jobs do not. Changing the job region/district clears its stale point. A resume location is voluntary, can be removed, and is requested only after a separate explicit action. Store the browser-provided accuracy; never silently request GPS on entry. Do not place individual CV home points on the public map or expose them in candidate detail links. Public CV markers are region aggregates. Counts reflect the three labeled sample jobs, one labeled sample CV and active local records, not an invented live audience. The map badge was removed at the user’s request; review/confirmation and these documents still identify the local preview boundary. The map itself only shows a concise navigation hint, without claiming a live production audience.

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


## Form refinements — 30 October 2026

The first-visit animation is now a centered dialog on phones as well as desktop, with native Telegram safe-area padding. The map’s demo badge and browser/sample footnote are removed; counts and data sources are unchanged and are still local examples, not live production totals. Attribution remains visible.

The first vacancy question step now asks for position, “Kompaniya yoki tashkilot nomi”, and work region. The activity-sector question is never rendered, including the base page before enhancement. Region is summarized on the detailed location step rather than asked twice; its edit action returns to the first step without discarding entered values. A dimensional 0-so‘m status card replaces the tiny free badge and distinguishes free website/database saving from optional channel publication.

`sectors.js` exports only 11 public category rows and 999 profession/category associations from the existing reference tables; no private records or DB mutations. Inference uses those associations and 38 grouped modern/specialist fallback rules. Stable category IDs are reused rather than inventing incompatible database categories. Both vacancy and resume drafts/records store hidden category metadata. Unknown custom titles remain unclassified instead of silently keeping the prior title’s category or blocking the form. Production inference must also be validated server-side when integration is added; no Vertex secret or browser AI call is introduced.

Remaining form selects use the same accessible popup infrastructure as position lookup: dimensional field frames, category-neutral document icons, rounded option surfaces, a clear selected check, pointer choice, arrows/Enter/Escape and preserved scroll/focus. Region/district/position stay searchable. Short contextual hints explain position lookup, company/organization naming, salary units, location, skills and contact numbers; validation restores their ARIA descriptions after clearing errors. The map is disposed before its container is replaced, preventing resize callbacks on a detached map.

`verify_form_polish.py` checks classification/reference/rule/unknown paths, hidden sector UI, category draft persistence, renamed fields, custom list interactions, centered welcome in five viewport sizes and both themes, native safe areas and absence of browser API/AI calls. Existing discovery E2E now chooses the work region on the first question step. Map imagery is mocked in repeated automated checks; visual screenshots use real tiles.


## Publication copy and typography — 30 October 2026

The large 0-so‘m form card and optional-channel caption are replaced by one non-interactive line directly beneath the page title. Eligible vacancies say “Sayt va kanalda bepul joylang”; after that account has used its free channel publication, only the website is described as free. No first-use quota explanation or channel price appears while completing/reviewing the form. The normal publication button checks the allowance after the click and opens existing prices if payment is required. Listing repost actions open review first; the menu no longer links directly to tariffs. CVs always say they are free and saved in the resume database, with no channel option.

The interface now uses the existing self-hosted full Inter Variable face (optical size and weight axes), including Uzbek Latin and Cyrillic. Headings, field labels, input values, options and action text have a coordinated size/weight/tracking hierarchy; helper text is more readable. The original logo remains an image. This supersedes the earlier Onest and 0-so‘m-card design notes. The packaged flow and form checks validate the updated delayed-price behavior and typography; the preview still does not post, charge or authorize production data.


## Animated placement seal and comparable compensation — 30 October 2026

The free-placement message is right aligned with an original CSS/SVG ruby gift seal, quiet shine and a small animated sparkle. It is informational, not a button. Reduced/disabled motion removes the animation; hidden-page/modal pauses also apply. Existing free-channel eligibility and delayed prices remain unchanged.

Vacancies now have seven steps: role/organization/region, schedule, location, requirements, duties, compensation, contacts. Resumes have five: identity, skills, location/work format, expected compensation, contacts. Legacy draft contact steps migrate forward without discarding entered amounts. Both forms explicitly choose month, shift, hour or service in UZS; shift length and service scope are clarified when relevant. Per-unit draft amounts survive toggling/reload and are never converted silently. Amounts have grouped digits, an entered-value summary, positive integer/range validation and a negotiated-payment option. A large difference from comparable offers produces a non-blocking check hint.

The estimate uses only explicitly typed, non-sample, non-archived vacancy records from the last 90 days matching canonical profession, region, work format, employment and experience. Currency/period must match; shifts also match duration and services match the normalized scope. The current vacancy/account are excluded. Repeated vacancies are reduced to one median contribution per employer, outliers are removed with 1.5-IQR fences, and at least five independent employers must remain. The shown center is the median, with a 25th–75th percentile typical range and visible count/window. Users choose whether to apply that range. Missing/insufficient data shows no number. It is an estimate of advertised offers, not actual take-home earnings.

The local preview calculator uses browser-local records only. Demo jobs, legacy records without explicit units and unrelated professions are not market evidence. No public salary dataset with reliable time units has been connected, and no market numbers are fabricated. Production rollout needs server-side period/currency/shift/scope persistence and a fresh, validated aggregate source with the same cohort rules; existing jobs.payment_type describes a payment method, not the monthly/hourly period. Matching and numeric search filters now also distinguish payment bases; the job-specific candidate grant fingerprint includes them. No production migration, publication/payment API call, post or charge is performed by this preview.

Compensation QA uses explicitly synthetic fixtures, never shipped as real averages. It covers units/scope/duration, minimum sample, independent employers, outliers, currency/freshness, amount grouping, unit drafts, negotiated pay, validation/warnings, range application, period-aware matching/filtering, five viewport sizes/both themes and reduced/disabled motion. Existing full vacancy/CV journeys follow the new later compensation steps.


## Compact price header and confirmed workplace — 30 October 2026

A dimensional animated “0 so‘m” badge sits directly opposite the step number/title, including “2 / 7 · Ish tartibi”. Its small qualifier is “Sayt + kanal” while free-channel eligible, “Sayt” afterwards, and “Rezyume” for database-only CVs; no first-use quota copy is exposed. The header, progress track, translucent creation canvas, white inputs, choice chips, action bar and restrained step entrances are consistent across all seven vacancy and five resume steps. Selecting a chip does not replay the step entrance; reduced/disabled motion still applies.

The first vacancy step replaces its direct region question with an explicit workplace-location button and manual region fallback. There is no automatic GPS request. A successful request opens an address/map proposal; region, district, settlement, street/building/landmark and the original requested coordinates commit together only after “Ha, shu ish joyi”. Edits to the proposal and cancellation leave the prior draft untouched. Moving an already selected point clears the proposed old address and requires lookup or manual correction. New work locations have no guessed Tashkent default. Confirmed locations are summarized later instead of asking the same address again; an optional landmark note remains.

Only work coordinates are reverse-geocoded, using the configurable `geocoding.json` Photon endpoint. CV GPS remains voluntary/private and never enters this workplace provider flow. The local preview uses Photon's public demo endpoint for occasional explicit requests, with 30-minute memory caching, bounded cache size, spacing, an 8-second response timeout and no typeahead/panning lookup. Country/distance/shape checks reject unsuitable provider results; unavailable/partial results offer editable fields rather than invented address parts. Provider coordinates never replace the requested GPS/map point. GPS accuracy is stored separately and poor accuracy is shown for review. Cancellation, changed account/job and superseded requests cannot apply stale results.

[Photon documentation](https://github.com/komoot/photon) permits moderate demo-server use without availability guarantees; [reverse API](https://github.com/komoot/photon/blob/master/docs/api-v1.md#reverse) describes the nearest-address lookup. Map/provider attribution is visible. Production rollout must replace the demo endpoint with a managed/private service or a protected caching proxy, and persist/validate confirmed location metadata server-side. No production DB, bot, webhook or deployment is modified here. Only explicit read-only geocoding and normal map-tile requests are added.

`mini-app-location.e2e.py` uses mocked GPS/provider/tiles to cover no automatic requests, atomic confirmation and editing, canonical address mapping, cancel/reload, cache, stale GPS callbacks, denied permission, provider failure, changed-point clearing, private CV GPS, every form step across five viewport sizes/both themes, header/action sizing and native safe areas. Other journey, classification, compensation and package checks passed with the revised location fallback. A separate browser smoke check used the public Tashkent point 41.3111, 69.2797 and the live Photon/OSM services; no user location or production data was used or committed.

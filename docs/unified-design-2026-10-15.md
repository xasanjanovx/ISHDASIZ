# Readable, consistent site design — 15 October 2026

The user selected a warm light vacancy section with stronger cards and requested the same design across every page, including administration.

## Implementation

- Root Onest font and shared semantic colors now apply to public catalogs, vacancy/resume details, map, statistics, search, account screens, messaging, editors, authentication and administration. The existing blue/teal utility palette is replaced with common cream, ivory, navy and warm neutral tokens. Error, warning and success colors remain semantic.
- Shared cards, fields, selects, buttons, header, footer and mobile navigation have one border, radius, contrast and spacing system. Inputs use 16 px text, shared helper text uses 13–15 px, standard controls have a 44–48 px target. Public catalog banners and account/admin navigation receive dedicated styling.
- Main vacancy cards use an ivory surface, stronger warm border, subtle shadow, 23–24 px title/salary and 15 px company text. The latest jobs section sits on a distinct warm sand background, with two columns on laptop screens and one on phones. Public seeker cards, categories and instructions also use larger text.
- The moving strip contains recognizable profession links, replacing generic repeated slogan words. Hover/focus pauses it; its decorative duplicate is excluded from keyboard navigation and reduced-motion preferences remain respected.
- Administration receives a branded heading and navigation with a current-page indicator. Its access gates, permissions, data operations and confirmation flows are preserved. No API contracts, database changes or importer behavior are introduced by this design update.
- Browser verification exposed a pre-existing map query timeout: selecting full jobs and all relation columns exceeded the anonymous database statement limit. The map now requests only its public summary, coordinate and relation-label fields. The real 100-row request returned successfully with an exact total. Cancellation, bounded loading, stable paging and retry preserve already loaded points, and an initial failure is labelled unavailable rather than zero jobs.

## Verification

All 952 existing/current Jest tests in 89 suites pass, including account, catalog, administration and access checks. Four additional map checks cover its public projection, coordinate constraints, paging/retry and cancellation. The targeted map/catalog/homepage group passes 24 tests. The strip test verifies actual category/search URLs and excludes duplicate keyboard stops. Navigation mocks now support the pathname used by the admin current-page indicator.

Browser checks cover representative public pages, search controls, authentication, administrator login, guest account gates and a narrow viewport in Russian and Uzbek. Private authenticated admin workflows are exercised by the existing role-aware UI tests; no production account records are edited for visual checks.

TypeScript and the webpack production build pass. Generated professional images are reused; no new generated assets are required.

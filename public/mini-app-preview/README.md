# ISHDASIZ Flow V12

Latest interactive design preview. Open `index.html` through HTTP, e.g. `python -m http.server 8777 --bind 127.0.0.1`, then http://127.0.0.1:8777/ . `review.html` presents sixteen screens.

The ticker is removed. The eight original profession scenes sit directly under the header, beside a four-phase typed sequence: “Xodim kerakmi?” → “Ish kerakmi?” → “Unda hoziroq e’lon bering” → “Saytda mutlaqo bepul”, with a curved arrow drawn toward posting actions. Posting and employee/job search controls share raised surfaces and clear labels; a dimensional profile card and own-listing/application shortcuts replace the red promotional block. The employer action is dominant. Fields, background and copy are refined, and the duplicated resume review is merged: six vacancy question steps, four resume question steps, then one publication review. No questions were removed.

Position search uses 1,037 public profession titles/common aliases, with suggestions only after at least one letter is entered. Fourteen regions and 209 districts come from a read-only public reference export. Comboboxes support touch, arrows, Enter, Escape and custom positions. Search updates immediately, includes locally created entries and applies salary/region filters. Own listings can be edited/archived. Candidate contact access requires the demo sign-in.

Vacancy review/confirmation suggests matching local CVs by profession/known alias, ranked by region and salary. Matching reasons are visible; sample data is labeled and empty matches remain empty. Resume owners see actual local detail-view/contact-open counts in listings and profile totals. Counts start at zero, exclude own visits and deduplicate by browser session. No invented view counts or matching percentages. These are local preview events, not production analytics or Telegram reach.

The latest trial rule supersedes V11: one free channel vacancy and one free channel resume per account, tracked separately in local demo storage. The numerical allowance is not advertised in the headline. Repeat channel posts show prices and preserve a free website-only path. Confirmation is idempotent within the preview. Drafts and pending sign-in return survive session reload; accounts have separate allowances and management views. Photo/video and paid-logo previews work locally. No media is placed in website search results.

Runtime: `index.html`, `styles.css`, `flow.css`, `flow.js`, `positions.js`, `app.js`, `scheduling.js`, `telegram.js`, the original logo/fonts/eight profession WebP images. Build sources and Python QA tools stay in the local design workspace. No credentials, .env files, private accounts or private job data are exported.

Verification:

- `verify_flow_journey.py`: full vacancy/resume creation, inline errors and autocomplete, draft/sign-in reload, free confirmation, repeated-post pricing, free website continuation, instant search/filtering, paid demo checkout, contacts and archiving.
- `audit_flow.py`: all sixteen screens in four sizes/both themes, homepage/posting/popup checks in eight sizes, text contrast and keyboard controls.
- `verify_flow_edges.py`: custom positions, salary validation, matching districts, account separation, motion preferences and short keyboard viewport.
- `verify_flow_host.py`: synthetic Telegram fullscreen/fallback, native theme colors, safe-area action shelf and campaign entry.
- `verify_flow_media.py`: actual local image/logo selection and media reset.
- `verify_employer_refinements.py`: letter-gated suggestions/aliases, candidate review and confirmation, ranking/filtering/search handoff, actual resume event counts, deduplication/owner exclusion/contact privacy and populated responsive states.
- `verify_account_home.py`: all home shortcuts, sign-in/reload return, sent/received applications, required own resume, confirmation, deduplication, account separation, real counts and alternating/reduced-motion wording.
- `verify_hero_message.py`: all four message phases in five viewports/both themes, fixed action geometry, actual timed typing/arrow reveal, cursor/path modal pause, disabled/reduced motion and a browser video.
- `review_flow.py`: screenshots of the actual rendered pages.

**Prototype boundary:** no real accounts, SMS, charges, AI moderation/generation, production reservations, database writes or Telegram publications occur. Entries, applications and allowances are local demo records. No employer is notified. Applications are labeled as demo, require an own resume and appear in sent/received account views only. Client storage is not production entitlement enforcement. Real rollout requires server-side account/allowance checks, atomic/idempotent publication, moderation, verified payment and Telegram integration. The existing draft PR remains a design review, not a complete deployment of that flow.


Duplicate-action correction: the homepage has exactly one vacancy creation button and one resume creation button. The profession hero has no posting control, plus icon or button surface; its short heading leaves attention on the paired creation tiles below.

# ISHDASIZ — connected journey, 30 October 2026

This contract supersedes the earlier local-only README, DESIGN and EVALUATION snapshots. Run the Next.js site and open `/mini-app`, which redirects to `/mini-app-preview/index.html`. Static HTTP servers can render the layout but cannot provide accounts, catalogs, AI or publication APIs.

## Interface

Keep the ISHDASIZ wordmark, eight formal profession portraits, blue employer card and muted green jobseeker card. The home contains the hero, two creation cards, a live map and one row for profile/listings/applications. No moving ticker or duplicate small creation buttons. Background uses pale architectural curves and restrained blue/green light.

Inter Variable is bundled locally. Input text is 16px to avoid mobile browser zoom. Main actions remain visible above mobile safe areas. Forms use rounded white panels, recessed inputs and detailed popup rows with icon tiles and region subtitles. Each step has a concise purpose sentence, visible progress, local draft status and one next action. Optional details expand on demand. Field errors stay next to the relevant input.

Only step one shows “E’lon joylash bepul” and “0 so‘m”. Later steps have contextual dimensional artwork rather than a repeating price message. Employee benefit cards have custom duotone artwork and selected states. Reduced-motion disables decorative loops. Telegram uses the official SVG from https://telegram.org/img/t_logo.svg.

Design guidance: the locally available [UI/UX Pro Max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) was searched for multi-step progress, submission feedback and error recovery. [VoltAgent’s collection](https://github.com/VoltAgent/awesome-design-md) and its [Jobright reference](https://getdesign.md/jobright/design-md) informed a clear career-focused hierarchy, Inter UI and pale sectional surfaces. The ISHDASIZ identity takes precedence.

## Seven steps per intent

Vacancy: profession/company/district → schedule → confirmed work address → candidate requirements → job text and employer-paid benefits → compensation → responsible contact → review.

Resume: name/profession/district → birthdate/gender/about → experience/skills → education/languages → preferred format/days/private optional location → expected compensation → contact → review.

Category is inferred from the existing profession reference and is never a question. City/district search uses live reference data and derives its region. The exact workplace point comes later. Reverse-geocoded values are proposals requiring confirmation and a known district. An unknown provider name cannot silently replace a reference ID. Resume coordinates stay private and never enter the workplace geocoder.

Benefits mean meals, transport, premiums, training and other conditions supplied by the employer. Cards explain that responsibility; selecting monetary premiums reveals their conditions. AI proposes text for review before applying it. Resume prompts use supplied facts and prohibit invented history, qualifications, compensation and benefits.

## Drafts, authentication and publication

Filling does not require login. Verified sessions are reused. Linked Telegram identity may establish the session on open; otherwise phone verification is requested at final publication. An unknown phone asks whether to register before sending SMS. Separate drafts are saved locally per verified account or guest; entering creation offers to continue a saved draft.

Website saves and resume storage are free. CVs never publish to the channel. Vacancy channel publication is a separate explicit action. The server enforces one free reservation per account; later requests show tariff amounts only after clicking. No browser flag, checkout attempt or queued order can grant candidate access.

New publication requires a verified server session and Vertex moderation. Failed publication keeps the draft. Retries reuse the same record ID and an atomic owned save. Website saving cannot automatically publish to Telegram. The first channel delivery is queued only after an explicit request, and candidate permissions require Telegram’s actual confirmed message ID.

## Salary and matching

Periods are separate: month, shift with the same duration, hour, and service with the same scope. Use UZS only and never infer a salary period from payment method. Cache each source version. Compare recent offers for the same title/region/format/employment/experience, deduplicate employers, remove outliers and require at least five observations. Show the median offer reference separately from the +10% recommendation. The employer chooses the final value. Omit the reference panel if evidence is insufficient.

Matching requires known matching profession and work format. Compensation, experience, employment, days, education, languages and region/distance produce confirmations or clarification issues. Exact and partial results have separate tabs. Two actual coordinates produce an approximate straight-line distance; no coordinates means no invented kilometers. This is structured filtering, not a claim to understand every free-text requirement.

Before a specific vacancy is confirmed in the channel, return aggregate counts only. Candidate phones are fetched separately after rechecking access; cards contain neither phones nor private coordinates. Detailed resume opens increment the native view counter once per employer/resume/Tashkent calendar day. Incoming applications strip candidate identity, resume and message fields when access is absent.

## Real data and rollout limits

Public catalog counts are exact, with 12 rows per page. The map initially loads four pages of 50 real points, then more on request. Global totals cover the entire available catalog. Failed reads show a retry rather than false zero counts. Native listings are readable/editable/archivable; this new channel-order/proof flow applies to Mini App-created records.

Own listings load up to 100 per kind. Matching scans at most 300 recent candidates in a category or 200 title-filtered jobs and returns up to 50 results; these are bounded results, not exhaustive match counts. Unknown legacy work formats are not guessed. Existing local-only discovery/location/compensation/polish tests describe the previous journey and are not the acceptance suite for this integration.

The migration must be installed before new saves, moderation budgets and candidate grants work. Public reads remain available independently. Click checkout, paid schedules/broadcasts and generated channel media are not activated here. No paid success is simulated. Read `docs/mini-app-integration.md` in the repository for rollout steps and current verification.

## Internal design assessment

| Criterion | Score | Evidence |
| --- | --- | --- |
| Spacing | 9/10 | Distinct step purpose, field surface and optional detail blocks avoid a crowded form. |
| Colors | 9/10 | Brand blue/green and a red free-price seal remain consistent in both themes. |
| Clarity | 9/10 | Plain Uzbek questions, short examples and automatic region/sector resolution reduce decisions. |
| Main action | 10/10 | The next action remains visible at every tested stage, viewport and theme. |
| Completion | 9/10 | Draft restoration, delayed login and explicit AI proposals preserve user work. |

These are internal assessments, not measured employer usability scores. Browser QA checked 200 page/stage states across 320×568, 390×844, 768×1024 and 1440×1000, both themes, keyboard suggestions and Escape. The connected end-to-end test completes both seven-step forms, confirms location, restores drafts, exercises registration/OTP, AI, salary recommendation and private candidate/contact gating. All test sends are synthetic.

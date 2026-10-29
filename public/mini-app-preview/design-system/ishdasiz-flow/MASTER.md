# ISHDASIZ Flow V12

Latest user brief (29 October): animate a four-beat typed sequence beside the profession art: “Xodim kerakmi?”, “Ish kerakmi?”, “Unda hoziroq e’lon bering” and “Saytda mutlaqo bepul”, then draw an arrow toward creation; remove the red promotional block shown in the screenshot and replace it with useful profile, own-listing and application navigation. Keep one vacancy creation button, the paired resume control, existing search and readable input behavior.

## Product rules changed in this version

The latest instruction supersedes the prior resume-only trial: **each account receives a free channel vacancy and a free channel resume**. Website publication stays free. Do not display the numerical allowance in the headline. Do not advertise unlimited free channel posting. Free badges remain on the creation tiles; the removed homepage promotion is not needed to explain eligibility. Paid repeat channel posts are identified before a purchase. Repeat creation offers paid channel plans and an explicit free website path. Eligibility is consumed only on final demo confirmation, separately by kind/account, and preserved across reloads. An interrupted form, price view, review or cancelled confirmation consumes nothing.

## Composition

The first section integrates the original eight professions into a compact split hero with a noninteractive four-phase typed message on the left. It follows the logo/header directly. Posting tiles remain adjacent; their attached search actions are raised controls with matching colors, icons and clear labels. Below them, a raised profile card and two smaller own-listing/application shortcuts replace the red promotion and old account link rows. Their counts come from local records and remain hidden for guests. There is no ticker and no bottom navigation.

Use the existing Onest family, blue employer action, pearl/citron resume control and red free/bonus accents, with a cooler layered background and a dark equivalent. Red identifies free/bonus badges; blue remains the primary action. Do not fabricate discount percentages, previous prices or urgency. Fields have 16px text, stronger focus states, compact labels and contextual inline errors. Remove repeated introductory paragraphs, management/settings explanations and saved-draft captions. Retain meaningful payment, privacy, optional-field and demo disclosures.

## Search and forms

Position and region fields use an accessible searchable combobox. Position/query suggestions require a letter; empty focus, arrow keys, whitespace, digits and clearing do not expose the catalog. One typed letter shows only matching titles/aliases. Exact aliases receive priority. The popup uses a raised layered surface, dimensional role icons, highlighted literal matches and a clear selected state. Titles include a read-only export of the site's public profession reference table, common titles and Russian/Uzbek aliases; no private vacancy/contact data is exported. Keyboard arrows, Enter, Escape and touch selection are supported, custom positions remain valid, and the popup adapts to the available viewport. Search results update while typing, include locally created demo records and respect region/salary filters.

All questions remain in six vacancy and four resume steps, followed by one shared publication review. Entered data survives navigation/reload within the session. The next/back shelf stays visible. The review screen shows the actual entered summary and destination choices; repeated channel placement opens prices before proceeding. Unknown phone numbers prompt registration. No role choice. Contacts remain sign-in gated.

## Recommendations and resume results

Vacancy review and confirmation show up to three matching local CVs. Matching uses a canonical role or known alias; region and salary compatibility affect ranking. Each card states its matching reasons rather than a made-up AI percentage. Archived CVs and the viewer's own CVs are excluded. No match has an explicit empty state and a search action; the full-search button carries the vacancy position. The sample CV remains clearly marked as a sample. This is deterministic local matching, not a production candidate service.

Own resume listings show view and contact-open counts; the profile totals active own resumes. Counts start at zero. A resume-detail open and an authenticated contact open record distinct local session events; the same visitor/session counts once per metric/resume, own visits and sample CVs do not count. Rendering cards or recommendations does not count as a view. Reload retains local counts; archiving removes a CV from the profile total. These are preview events, not site or Telegram-channel audience statistics. Production rollout requires authenticated server-side event collection, access control, deduplication and reporting.

## Review boundary and evaluation

This is an interactive design preview. Authentication, account allowance, moderation, payment, records and publication are local demonstrations, not production enforcement. No SMS, payment, production database write or Telegram post is sent. Server-side account eligibility and idempotent publication are required before rollout; browser storage is not a production security boundary.

Evaluate against the user's ten requested requirements and executable scenarios, with a separate subjective visual review. A self-score is a score against this brief, not proof that every user will prefer the aesthetics. Continue fixing concrete failures before final delivery. Retain reduced-motion, modal/focus/hidden-page handling, contrast, 44px hit targets and Telegram safe areas.

Sources remain the actually read Anthropic Frontend Design, GitHub Premium Frontend UI, local frontend-design-direction and the original site's eight profession assets; see the V11 source discussion. The latest layout and offer rules above override older versions.

## Background refinement

The accepted layout is retained. The canvas now combines pearl-white diagonal light, a soft blue glow near the profession art, a restrained citron reflection toward the lower content, thin contour arcs and a faint 48px grid. The dark theme uses deeper blue/green reflections and quieter contours. Static CSS pseudo-elements sit behind the content, do not intercept pointer events and introduce no new images or animation. `surface-background.css` is the editable source and is compiled into `flow.css`.


Duplicate-action correction: the homepage has exactly one vacancy creation button and one resume creation button. The profession hero has no posting control, plus icon or button surface; its short heading leaves attention on the paired creation tiles below.


## Account shortcuts and applications

The home account module uses an original CSS layered profile object, pearl-blue surfaces and restrained dimensional file/send icons. Every card is a real navigation target. The same applications route is in the profile and menu; the sixteen-screen review gallery includes it.

Applications have sent and received tabs. Guests see a sign-in action; empty states lead to jobs or vacancy creation. An application requires an active own resume, an available vacancy and demo confirmation. One application per account/job is saved in session storage, survives reload and appears in the job owner's received tab. Other accounts see neither side. Login and reload return to the requested application; own vacancies cannot be applied to. Rows are marked “Demo ariza”; no employer message is sent. Production identity, authorization, persistence and delivery still require server integration.

Hero wording shares the existing 4.8-second profession timer instead of adding another interval. Manual scene controls update both. The accessible heading contains the entire static sentence without repeated live announcements. Four overlapping message panels preserve layout. CSS letter reveals use a 32ms stagger, restrained cursor and a curved SVG arrow drawn toward the posting controls after the invitation. “Saytda” qualifies the free offer, so the channel is not advertised as perpetually free. No extra posting button is introduced. OS reduced motion, the animation setting, hidden-page, modal and keyboard-focus pause behavior remain honored.


Hero motion validation: every phase is checked in five viewports and both themes for overflow and stable action geometry; the arrow cannot cover actions. A real browser recording verifies automatic progression, completed letter/arrow reveals, modal pause (including cursor/path) and disabled/reduced motion. The preview adds no timers or network dependencies for this effect.

# ISHDASIZ Fresh — current design system

The user rejected Impact V9 and requested a different, more colorful design for all pages. These decisions replace the prior black/gold and WebGL direction.

## Identity and hierarchy

Keep the actual ISHDASIZ logo, Uzbek Latin and the heading «Ish va xodim topish oson». Use Inter Variable, a pale blue canvas, white content surfaces, saturated cobalt actions and a lime offer surface. Reuse semantic variables `--bg`, `--paper`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-ink`, `--promo`, `--promo-ink`. The two main search paths stay side by side. There is no bottom navigation.

The free offer is a large, clickable «0 so‘m / Saytda doim bepul» panel in the initial phone viewport. It explicitly concerns website vacancies and resumes. Channel vacancies remain paid; only the first channel resume is free. No invented old prices, discounts or marketing statistics are shown.

## Homepage and motion

The unframed, full-width marquee is the first element above the header. The homepage cycles through the site's eight real profession assets: teacher, builder, doctor, programmer, chef, tailor, driver and salesperson. A matching profession word enters letter by letter; portraits crossfade and move gently; connector lines flow as on the original website. Manual previous/next controls browse all eight professions.

There is no visible pause button on the hero. Motion can be stopped through **Menyu → Sozlamalar → Animatsiyalar**. Honor the operating system's reduced-motion preference and stop automatic changes for hidden pages, open sheets and keyboard focus. Keep text and controls fully readable with all animation disabled.

## All-page implementation

- Search: segmented vacancy/resume modes, one query field, region/filter controls, readable salaries and text-only job cards. Candidate contacts remain sign-in gated in the demo.
- Profile: one account card, two clear resume/vacancy management paths, and grouped navigation. No row of small unlabeled profile icons.
- Forms: all six vacancy and five resume steps preserve the existing questions. Consistent 16px inputs, visible labels, clear progress and next/back actions.
- Listings: show the entered draft position/company/region, edit/remove controls and distinct free/paid channel actions.
- Channel tariffs: retain the confirmed vacancy and resume prices. Selected plans use a blue border; the first-resume and weekly/monthly pin bonuses use clear lime callouts.
- Calendar, authentication, channel preview, notifications, admin and broadcast reuse the same control sizes, typography, cards, modal sheets and themes.
- Channel preview: an unpaid vacancy opens tariff selection; first eligible resume can proceed free. The example vacancy cover appears only in the paid demo state.

## Homepage publication continuation — 28 October

The accepted header, profession gallery and two search buttons retain their styling. Under the website-free banner, add two direct creation actions, an animated first-resume channel offer, and shortcuts to listings/profile. Keep this content in the scrolling homepage, without introducing bottom navigation. The channel offer says **only the first resume is free**; subsequent resumes and vacancies use paid tariffs. Hide the free CTA and zero-price illustration once the local demo eligibility has been used. New resumes start at step one; the vacancy tariff link explicitly selects vacancy prices.

The illustration shows a resume arriving at the channel, a zero-price stamp and a moving Telegram plane. These are illustrative elements, not a publication status. Motion stops with the existing setting, OS reduced-motion, a modal, keyboard focus or a hidden page. `home-publishing.css` only styles the new homepage components.

Visual self-review (not a measured user study):

| Criterion | Before | After | Reason |
| --- | --- | --- | --- |
| Spacing | 6/10 | 9/10 | The empty lower area has useful actions, 12–24px group gaps and no oversized desktop row gap. |
| Colors | 9/10 | 9/10 | Reuse the accepted blue/white surfaces and lime free offer; introduce no extra palette. |
| Text | 7/10 | 9/10 | Website-free and first-channel-resume-free offers are explicit, with paid exceptions next to the channel action. |
| Primary action | 8/10 | 9/10 | Search remains in the first viewport, with clearly named creation and channel actions below it. |

The first implementation still had excessive desktop spacing (7/10); explicit grid rows reduced the gap to 20px before the final review. `verify_home_publishing.py` checks eight sizes, both themes, contrast, hit areas, routing, eligibility, motion and that desktop gap.

## Sources actually used

- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): verified **Job Board/Recruitment** query `job board recruitment vibrant --design-system --variance 6 --motion 7 --density 4`. Use progressive forms, clear search, semantic colors, contrast and motion safeguards. Generic font and palette suggestions do not override the user brief. Generated output is in `design-system/ishdasiz-fresh/MASTER.md`.
- [Wise DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/wise/DESIGN.md): a conspicuous lime offer, rounded controls and a quiet surface hierarchy. Do not copy Wise's logo or proprietary font.
- [Miro DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/miro/DESIGN.md): more vivid contextual surfaces, one clear action color and consistent component families. Do not copy its wordmark or claims.
- The project's `components/home/hero-section.tsx` and `hero-section.module.css`: the same eight professions, portrait transitions, letter entrances and flowing connector paths, adapted to the phone.

## Review boundary

This is a self-contained interactive design preview. It does not send SMS, create real accounts, moderate/publish to the database, charge money, reserve production slots or post/broadcast in Telegram. Authentication, calendar occupancy and administrative counts are explicitly demonstration data. Russian translation and production integration are separate unfinished work. Telegram fullscreen/inset handling is retained and tested through a synthetic host; a real device check follows deployment.

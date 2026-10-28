# ISHDASIZ Fresh V10

A complete visual replacement for the rejected Impact design, covering the homepage and supporting pages.

Open through HTTP: `python -m http.server 8773 --bind 127.0.0.1`, then http://127.0.0.1:8773/ . `review.html` provides an interactive overview of the main screens.

The top marquee, eight site professions, cobalt actions, new menu/profile/forms/results/tariffs and conspicuous lime «0 so‘m» offer replace the old presentation. There is no standalone pause button; motion preferences are in the settings page. Read `DESIGN.md` for applied rules and sources.

Runtime: `index.html`, `styles.css`, `fresh.css`, `fresh.js`, `app.js`, `scheduling.js`, `telegram.js`, the original eight profession images, logo and bundled fonts. The old WebGL magnifier and its library are not loaded or needed by this version.

Validation:

- `verify_fresh.py`: eight phone/tablet/desktop/landscape sizes, all eight profession images, top ticker, first-viewport free offer, paired actions, search, menu/profile, confirmed prices, motion/theme persistence, all form steps and registration prompt. No API/SMS/payment requests occur.
- `audit_fresh.py`: normal/large text contrast in both themes on eight main pages; channel preview eligibility; campaign parameters; Telegram fullscreen, fallback and insets through a synthetic host.
- `review_fresh.py`: screenshots and runtime/overflow checks for 13 routes.
- `record_fresh.py`: `fresh-eight-scenes.mp4`, a 19-second real browser recording demonstrating all eight scenes with manual advancement.

The source prototype remains local/demo-only for accounts, payments and publication. It is uploaded as a noindex draft preview in the site repository, not connected to the production @IshdasizBot workflow. Any Vercel preview created by the GitHub integration may require the owner's Vercel login.

Assets: original ISHDASIZ logo and eight profession WebP images; Inter Variable and its SIL OFL in `assets/inter-LICENSE.txt`; original Onest font for the base stylesheet. No credentials are included. UI UX Pro Max attribution is retained in the published design-system folder.

# ISHDASIZ Impact — interactive preview

Open `index.html` through an HTTP server (`python -m http.server 8772 --bind 127.0.0.1`). Local URL: http://127.0.0.1:8772/ .

The first screen is redesigned around an oversized black/yellow headline, a real lit 3D search object, two equal search paths, and the free website offer. It has phone and desktop layouts. The borderless marquee reaches the viewport edges; no bottom navigation is rendered.

Used sources: [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) and [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md). Applied choices and overrides are recorded in `design-system/ishdasiz-impact/pages/home.md`. The generic generated recommendation is in `design-system/ishdasiz-impact/MASTER.md`.

Important runtime files: `home-professional.js` (home, routes, motion controls, campaign intent), `impact-3d.js` (Three.js renderer/lifecycle), `impact.css` (semantic themes and responsive layout), and `telegram.js` (fullscreen host protocol). Existing local form/search flows are retained.

Campaign examples:

- `?audience=hiring` — hiring scene.
- `?audience=career` — job-seeker scene.
- `?screen=search&audience=hiring` — candidate search.
- `?screen=search&audience=career` — job search.

Audience and UTM parameters survive navigation. A local `ishdasiz:intent` CustomEvent is dispatched on hero action. No advertising platform or analytics endpoint is contacted.

Validation scripts in the local design workspace: `verify_professional.py`, `check_quality.py`, `inspect_impact.py`, `record_professional.py`. They cover phone/tablet/desktop layouts, both themes, both funnels, full-width ticker, pause/reduced-motion behavior, actual WebGL animation and fallback, campaign entries, and a synthetic Telegram host.

This preview does not create real accounts, send SMS, take payments, moderate listings, reserve publication times, broadcast or publish to Telegram. Some supporting flows and translations are still demonstrative. The preview is noindex and is not wired into @IshdasizBot as the production app.

Assets: original ISHDASIZ logo; Inter with its SIL OFL in `assets/inter-LICENSE.txt`; portrait pair generated for the previous Studio iteration, prompt in the local `asset-studio-prompt.txt`; vendored Three.js 0.180.0 and MIT license in `assets/three/`. No credentials are included.

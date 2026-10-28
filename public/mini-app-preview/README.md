# ISHDASIZ Studio V11

The latest design preview replaces Fresh V10. Vacancy and resume publication are the two dominant actions in the first viewport. The original eight professions occupy a supporting animated strip. A shared new Onest type scale, material-inspired controls, two themes, forms with a persistent action shelf, search, profile, listings, tariffs, calendar, authentication and administrative screens replace the old component presentation.

Run `python -m http.server 8775 --bind 127.0.0.1` and open http://127.0.0.1:8775/ . `review.html` provides an interactive 13-screen gallery. Sources, the pre-build design plan and critique are in `DESIGN.md`.

Runtime: `index.html`, `styles.css`, `studio.css`, `studio.js`, `app.js`, `scheduling.js`, `telegram.js`, original ISHDASIZ logo, original eight profession WebP images and the bundled Onest font. There is no external 3D dependency; the briefcase/resume elements are native layered CSS objects with real HTML labels and bounded pointer response.

Validation scripts remain in the local design workspace:

- `verify_studio.py`: eight viewport sizes, prominent posting actions, thirteen routes in four sizes/both themes, overflow, persistent form actions, all profession assets and text contrast.
- `verify_studio_flows.py`: all six vacancy and five resume steps, search/detail, exact prices, scheduling navigation, unknown-phone registration, first-resume eligibility, live motion, settings and modal isolation.
- `review_studio.py` and `capture_studio.py`: actual browser screenshots of all routes and a gallery/desktop/dark overview.
- `record_studio.py`: `studio-demo.mp4`, a real recording of creation, forms, channel offer, menu and profile.

This is a noindex interactive design prototype. It does not create real accounts, send SMS, verify/charge payments, generate media, moderate text, reserve production times, publish or broadcast. The production integration remains unfinished in the draft PR. Website listings stay free; the first channel resume is free, channel vacancies and subsequent resumes use the confirmed paid tariffs. No fake historical prices or fabricated audience metrics are used. Administrative counts are marked demonstration data. Telegram fullscreen/insets use the existing host integration; a real-device check follows production integration.

No administrator credentials, environment files or private inventory documents belong in this artifact or its public preview. Administrator access notes are stored separately outside all Git repositories. No passwords were reset and no recovery messages were sent.

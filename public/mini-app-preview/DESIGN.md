# ISHDASIZ Studio — V11

## Brief and direction before implementation

The user rejected the entire Fresh UI and now wants vacancy/resume publication to dominate the first viewport. This replaces the previous search-first hierarchy. Build a working recruitment desk, using the materials of the task: vacancy slips, resume sheets, a briefcase and channel publication. Keep the actual logo, original eight professions, borderless top ticker, Uzbek Latin, both themes, fullscreen integration and no bottom navigation.

Palette: canvas `#f5f6f2`, white `#ffffff`, ink `#182c32`, royal blue `#205bea`, citron `#e3ed88`, divider `#dce0dc`. Additional contextual colors belong only to the original profession imagery. Onest is the display and reading family, with deliberate 780/650/450 weights. Fields remain 16px.

The distinctive detail is a pair of prominent dimensional publication tiles: a blue vacancy folder and a citron resume sheet. These are real controls, with semantic labels and HTML text. Depth comes from layered CSS objects, lit edges, a controlled shadow and small pointer response. Keep the other pages more restrained while sharing a polished family of buttons, form controls, menus, sheets, tabs and selection states.

Phone composition:

```text
edge-to-edge ticker
ISHDASIZ                            Menu
Ish va xodim topish oson.
[ Vacancy publication ][ Resume publication ]
[ Find an employee    ][ Find a job         ]
eight-profession animated editorial strip
first resume free in channel / paid exceptions
my listings / account
```

Forms use a step rail and one clear question group, with a persistent next/back action shelf. Search uses a proper search toolbar and detailed result rows. Profile uses a personal identity header and prominent creation paths. Tariff selection uses deliberate radio states, a separated price hierarchy and a clear checkout shelf. Calendar/auth/admin/broadcast follow the same tokens and components.

## Critique of the plan

The previous oversized portrait placed the actual posting controls below the fold; remove that hierarchy. The previous repeated rounded cards and repeated free banners made the site look like a generic component kit; vary structure according to the job of each section, and use one precise channel offer. Do not add a preloader, scroll hijacking, huge marketing-only hero or a new animation framework to a daily-use phone app. Preserve simple task flows and accessible native scrolling.

## Sources actually read

- [Anthropic Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): subject-grounded visual identity, opinionated typography, two-pass critique, user-facing copy and purposeful structure.
- [GitHub Premium Frontend UI](https://github.com/github/awesome-copilot/blob/main/skills/premium-frontend-ui/SKILL.md): dimensional touch/hover states, lighting, variable typography, composited motion and responsive degradation. Landing-page-specific preloaders and full-screen scroll narratives do not fit this Mini App's task-first brief.
- Local `frontend-design-direction`: actual usable workflow in the first viewport, clear hierarchy, product-specific material and stable mobile constraints.
- Earlier UI UX Pro Max and Awesome DESIGN.md research remains context; this version's layout supersedes V10.

## Product boundary

This is the design prototype, not a production authentication/payment/publication system. Website listings are free; only the first channel resume is free, vacancies and later channel resumes are paid. No invented old prices or audience statistics. Preserve all six vacancy and five resume steps. Contacts remain gated in the demo. Motion respects OS reduced motion, the app setting, hidden-page and modal/focus states. Do not include credentials in this artifact or the public preview.

# Homepage and OsonIsh update — 14 October 2026

## Design

The initial green design was replaced following the user's feedback. The final design uses a navy background, electric-blue accents, a generated glass portal illustration, subtle hero motion, compact vacancy cards, public seeker profiles, category navigation, inclusive vacancy shortcuts and Telegram access. Employer promotion and the employer counter were removed from the homepage. The existing employer account workflows remain available.

Profiles use the existing public resume search and its sanitized card projection. Phones, birth dates, private work history and resume ownership are never passed to the homepage component. Vacancy cards also use an explicit projection instead of all database columns. Data failures remain visible and unknown counters are not replaced with invented numbers.

The generated artwork is public/hero-career-portal.webp (1774 × 887, 168888 bytes). The original office photograph remains in the repository. Reduced-motion preferences disable the scene and card animations.

## Import

The active Supabase schedule was inspected read-only: ishdasiz-osonish-refresh runs every five minutes. Previously its continuation handler stopped once an existing run ended, leaving new cycles to the daily Vercel cron. The handler now lets the database atomically claim/start the next cycle after its six-hour cooldown, then pins that run while processing. Existing leases, checkpoints, retries and per-item confirmation remain intact; no new scheduler or database migration is required.

The live OsonIsh system-configs response on this date contains arrays in value, rather than value.uz. The parser accepts both formats, refreshes metadata hourly, limits network requests to five seconds and propagates cancellation. The worker now consumes these configs.

Corrections: work_type 2 means shift work, 5 means work from home; experience ranges no longer use invented averages; original experience range codes are saved for filtering; fixed salary zeroes are preserved; an old hardcoded contact-number replacement is removed; all twelve current working schedules are displayed; approved min_education and work_type metadata are included in public vacancy details. Source IDs, not names or speculative list disappearance, remain the identity boundary.

## Validation

TypeScript checks; a webpack production build; targeted homepage, importer, catalog and public-access tests; browser checks of Uzbek/Russian layouts, seeker registration and a narrow mobile viewport. Screenshots are saved beside the repositories. These local checks do not establish a production deployment.

## Image generation provenance

Built-in ImageGen; use case stylized-concept. Prompt:

Use case: stylized-concept. Asset type: an original cinematic raster hero illustration for ISHDASIZ, a job-search website in Uzbekistan. Create a striking premium 3D rendering in wide landscape format. Main subject: a large sculptural luminous cobalt-blue arch/portal, made of thick polished translucent optical glass, standing on a curved midnight-blue platform. Inside the portal is an elegant tiny city-inspired skyline and one minimal sculptural silver briefcase, symbolizing the next career opportunity. A few restrained translucent glass rectangles and chrome spheres orbit around the portal in depth, with soft blue light trails. Rich atmospheric navy background (#050b1c) with subtle mist, soft reflections, crystalline refractions, and high-end studio lighting. The portal sits mainly in the right two thirds, leaving a dark uncluttered area at the left edge for blending into the website. Strong editorial art direction, tactile materials, sophisticated asymmetric composition, realistic ray tracing, impressive sense of scale and 3D depth. Palette: midnight navy, electric royal blue, cool icy highlights; absolutely no green, teal, warm colors, purple or rainbow. No words, no numbers, no interface text, no logos, no people, no watermark. Do not generate a website screenshot; generate only the standalone artwork that will be placed into the real website.

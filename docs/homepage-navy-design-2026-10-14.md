# Homepage and OsonIsh update — 14 October 2026

## Design

The final composition follows the user's supplied https://lachuga.shop/ reference: oversized ISHDASIZ typography behind a central 3D character, peripheral cards, a scrolling topic strip, three selectable avatar scenes, editorial headings and a numbered how-it-works section. The previously requested navy palette is retained. The scenes provide working actions for vacancy search, seeker registration and the vacancy map. Employer promotion and the employer counter were removed from the homepage. The existing employer account workflows remain available.

Profiles use the existing public resume search and its sanitized card projection. Phones, birth dates, private work history and resume ownership are never passed to the homepage component. Vacancy cards also use an explicit projection instead of all database columns. Data failures remain visible and unknown counters are not replaced with invented numbers.

The current generated assets are public/mascot-search.webp (355052 bytes), public/mascot-resume.webp (321206 bytes) and public/mascot-map.webp (360014 bytes), all 1024 × 1536 with real alpha transparency. They are decorative illustrations, not photographs assigned to actual seekers. The original office photograph and earlier portal artwork remain in the repository. Reduced-motion preferences disable animation and automatic rotation. Manual avatar selection stops rotation; pointer hover and keyboard focus also suspend it.

## Import

The active Supabase schedule was inspected read-only: ishdasiz-osonish-refresh runs every five minutes. Previously its continuation handler stopped once an existing run ended, leaving new cycles to the daily Vercel cron. The handler now lets the database atomically claim/start the next cycle after its six-hour cooldown, then pins that run while processing. Existing leases, checkpoints, retries and per-item confirmation remain intact; no new scheduler or database migration is required.

The live OsonIsh system-configs response on this date contains arrays in value, rather than value.uz. The parser accepts both formats, refreshes metadata hourly, limits network requests to five seconds and propagates cancellation. The worker now consumes these configs.

Corrections: work_type 2 means shift work, 5 means work from home; experience ranges no longer use invented averages; original experience range codes are saved for filtering; fixed salary zeroes are preserved; an old hardcoded contact-number replacement is removed; all twelve current working schedules are displayed; approved min_education and work_type metadata are included in public vacancy details. Source IDs, not names or speculative list disappearance, remain the identity boundary.

## Validation

TypeScript checks; a webpack production build; targeted homepage, importer, catalog and public-access tests; browser checks of Uzbek/Russian layouts, seeker registration and a narrow mobile viewport. Screenshots are saved beside the repositories. These local checks do not establish a production deployment.

## Image generation provenance

Built-in ImageGen; use case stylized-concept. Prompt:

Use case: stylized-concept. Asset type: an original cinematic raster hero illustration for ISHDASIZ, a job-search website in Uzbekistan. Create a striking premium 3D rendering in wide landscape format. Main subject: a large sculptural luminous cobalt-blue arch/portal, made of thick polished translucent optical glass, standing on a curved midnight-blue platform. Inside the portal is an elegant tiny city-inspired skyline and one minimal sculptural silver briefcase, symbolizing the next career opportunity. A few restrained translucent glass rectangles and chrome spheres orbit around the portal in depth, with soft blue light trails. Rich atmospheric navy background (#050b1c) with subtle mist, soft reflections, crystalline refractions, and high-end studio lighting. The portal sits mainly in the right two thirds, leaving a dark uncluttered area at the left edge for blending into the website. Strong editorial art direction, tactile materials, sophisticated asymmetric composition, realistic ray tracing, impressive sense of scale and 3D depth. Palette: midnight navy, electric royal blue, cool icy highlights; absolutely no green, teal, warm colors, purple or rainbow. No words, no numbers, no interface text, no logos, no people, no watermark. Do not generate a website screenshot; generate only the standalone artwork that will be placed into the real website.

## Current mascot prompts

Built-in ImageGen, transparent_background=true, one generation per asset. All three prompts share this base:

Use case: stylized-concept. Asset type: an ORIGINAL premium 3D plush mascot cutout for ISHDASIZ job-search homepage, not a website mockup. Portrait composition showing the entire character from top of hood to soles, all accessories fully inside frame. A charming collectible designer toy career navigator, oversized round ivory fabric face, expressive relaxed large eyes, padded rounded astronaut-inspired hoodie hood with a small crescent ridge (no star silhouette), tailored utility trousers, oversized off-white chunky sneakers. High-end tactile plush and felt fabric, stitched seams, brushed-metal fasteners, cinematic polished 3D render, friendly confident expression, slightly three-quarter pose facing camera. Main palette midnight navy and rich cobalt royal blue with cool white highlights, absolutely no green, no teal, no magenta. Isolated on a genuinely transparent alpha background, no environment, no floor, no rectangular backdrop, no cast shadow outside the character. No text, no numbers, no brand marks, no OpenAI/ChatGPT or other logos. Keep silhouette bold and appealing, suitable for a large hero centerpiece. Not a real person's portrait.

Search suffix: Variant SEARCH GUIDE: deep cobalt plush hoodie, midnight utility pants, small silver compass brooch. Holds a luminous blue glass magnifying-glass orb above one open palm, with three very small translucent glass job-card symbols floating near it. Other hand holds a compact polished silver briefcase. A short navy cape fans out elegantly to one side.

Resume suffix: Variant RESUME GUIDE: ivory and navy plush hoodie, cobalt utility pants, large soft navy hood. Holds a thick elegant blue portfolio folder with a simple embossed geometric person pictogram (no letters) and a polished silver pen. One hand gestures a relaxed peace sign. Small cobalt fabric scarf and metallic details. Show all objects and fingers.

Map suffix: Variant MAP GUIDE: blue-gray plush hoodie, navy utility pants, royal-blue rounded padded hood with subtle silver compass details. Holds a glowing cobalt glass globe with one small silver location pin hovering above it and a rolled navy route-map scroll with abstract blue lines (no readable map text). Short flowing dark blue explorer cape. Distinct pose from other two variants.

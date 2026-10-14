# Homepage and OsonIsh update — 14 October 2026

## Design

The homepage adapts the supplied https://lachuga.shop/ reference to job search: warm cream background (#ece9e2), oversized ISHDASIZ lettering, central professional character, peripheral search and seeker cards, pill navigation, and calm editorial sections below. Employer promotion and the employer counter are removed from the homepage. Existing employer account workflows remain available.

Five original realistic CGI human illustrations replace the previous toy characters: a teacher in a formal navy business suit, builder, doctor, programmer, and chef. Selection changes the person, localized headline, profession label, button, and background accents together. Background layers crossfade; character layers transition and gently sway. The cream base remains consistent while education uses warm brown accents, construction terracotta, medicine slate teal, IT slate blue, and cooking olive.

Scenes automatically rotate every seven seconds. Manual selection pauses rotation; pointer hover and keyboard focus suspend it. Pause/play controls and reduced-motion preferences are respected. Images are decorative illustrations and are not assigned to real seeker profiles.

Profession actions use existing catalog category IDs and keep the selected database region ID. The chef additionally uses q=oshpaz, which searches the existing Uzbek/Russian title and description fields. General query search, public seeker profiles, resume creation, vacancy details, and map access remain functional. Counters and profiles come from actual public data; unavailable counters show an em dash rather than fabricated values.

Profiles use the existing sanitized public resume projection. Phones, birth dates, private work history and ownership are not passed to homepage components. Vacancy cards use an explicit public projection.

## Import

The active Supabase schedule was inspected read-only: ishdasiz-osonish-refresh runs every five minutes. Previously its continuation handler stopped once an existing run ended, leaving new cycles to the daily Vercel cron. The handler now lets the database atomically claim/start the next cycle after its six-hour cooldown, then pins that run while processing. Existing leases, checkpoints, retries and per-item confirmation remain intact; no new scheduler or database migration is required.

The live OsonIsh system-configs response on this date contains arrays in value, rather than value.uz. The parser accepts both formats, refreshes metadata hourly, limits network requests to five seconds and propagates cancellation. The worker now consumes these configs.

Corrections: work_type 2 means shift work, 5 means work from home; experience ranges no longer use invented averages; original experience range codes are saved for filtering; fixed salary zeroes are preserved; an old hardcoded contact-number replacement is removed; all twelve current working schedules are displayed; approved min_education and work_type metadata are included in public vacancy details. Source IDs, not names or speculative list disappearance, remain the identity boundary.

## Validation

Targeted homepage interaction/public-data tests, TypeScript, webpack production build, and browser checks of profession selection, actual catalog links, both languages and narrow mobile layout. These local checks do not establish a production deployment. The existing draft pull request is updated rather than merged.

## Generated asset provenance

Built-in ImageGen, transparent_background=true, one generation per asset. Original PNG files remain under C:/Users/DIgital CITY/.codex/generated_images/01a13a6f-a35c-7c02-afd9-2bc3f8fd8a24/. WebP conversion uses quality 88 and alpha quality 100; no pixel content editing. Every final asset is 1024 × 1536 and preserves alpha.

### teacher-formal

Final path: public/profession-teacher-formal.webp (71070 bytes). Original: exec-82c88fb9-c45c-4b20-97d5-8b66d07f187f.png.

Full prompt:

Create a premium realistic 3D rendered HUMAN professional character for a modern Uzbekistan jobs website. A believable adult with normal adult proportions, natural detailed face and anatomically correct hands, subtle friendly expression, physically based fabric and skin, polished high-end advertising CGI (not a toy, not an emoji, no oversized head, no plush, no caricature). Full body head to shoes entirely visible, centered vertical composition with generous transparent empty margin around subject, front three-quarter view, soft studio light from upper left, isolated on genuinely transparent background, no backdrop, no ground plane, no text, no logos, no watermark. Natural poised lively stance suitable for a gently animated website hero. Central Asian appearance. Elegant restrained palette suited to a warm cream editorial website. An adult female SCHOOL TEACHER in her early thirties with neatly styled shoulder-length dark hair. Proper formal business suit: immaculate matching dark navy tailored blazer and straight tailored trousers, modest ivory buttoned blouse underneath, polished low-heel black closed shoes. Fully professional neat appearance, natural dignified facial features, calm approachable expression. Holding two slim hardcover schoolbooks at waist level and a pen. No cardigan, no casual knitwear, no excessive makeup, no exaggerated body proportions. This must read as a respected qualified educator in a proper suit.

### builder

Final path: public/profession-builder.webp (112964 bytes). Original: exec-580bea04-a6eb-4d67-b478-f6181d51b515.png.

Full prompt:

Create a premium realistic 3D rendered HUMAN professional character for a modern Uzbekistan jobs website. A believable adult with normal adult proportions, natural detailed face and hands, subtle friendly expression, physically based fabric and skin, polished high-end advertising CGI (not a photograph, not a toy, not an emoji, no oversized head, no plush, no caricature). Full body head to shoes entirely visible, centered vertical composition with generous transparent empty margin around subject, front three-quarter view, soft studio light from upper left, isolated on genuinely transparent background, no backdrop, no ground plane, no text, no logos, no watermark. Natural poised lively stance suitable for a gently animated website hero. Central Asian appearance. Elegant restrained palette suited to a warm cream editorial website. Adult male construction professional in his thirties with short dark hair, neatly trimmed beard, orange safety helmet, muted navy work jacket and work trousers, tan work boots, modest tool belt. Holding a rolled construction plan in one hand. Friendly confident stance, no dangerous equipment.

### doctor

Final path: public/profession-doctor.webp (69560 bytes). Original: exec-72fde2a4-eec9-4048-a2f3-fc2c71563c58.png.

Full prompt:

Create a premium realistic 3D rendered HUMAN professional character for a modern Uzbekistan jobs website. A believable adult with normal adult proportions, natural detailed face and hands, subtle friendly expression, physically based fabric and skin, polished high-end advertising CGI (not a photograph, not a toy, not an emoji, no oversized head, no plush, no caricature). Full body head to shoes entirely visible, centered vertical composition with generous transparent empty margin around subject, front three-quarter view, soft studio light from upper left, isolated on genuinely transparent background, no backdrop, no ground plane, no text, no logos, no watermark. Natural poised lively stance suitable for a gently animated website hero. Central Asian appearance. Elegant restrained palette suited to a warm cream editorial website. Adult female doctor in her thirties with dark hair neatly tied back, white tailored medical coat over muted slate blue scrubs, stethoscope around neck and clean practical shoes. Holding a slim medical clipboard at her side. Calm approachable expression and poised stance.

### programmer

Final path: public/profession-programmer.webp (80628 bytes). Original: exec-c16ec7c3-dde9-40ed-8460-3a3cb00c27d1.png.

Full prompt:

Create a premium realistic 3D rendered HUMAN professional character for a modern Uzbekistan jobs website. A believable adult with normal adult proportions, natural detailed face and hands, subtle friendly expression, physically based fabric and skin, polished high-end advertising CGI (not a photograph, not a toy, not an emoji, no oversized head, no plush, no caricature). Full body head to shoes entirely visible, centered vertical composition with generous transparent empty margin around subject, front three-quarter view, soft studio light from upper left, isolated on genuinely transparent background, no backdrop, no ground plane, no text, no logos, no watermark. Natural poised lively stance suitable for a gently animated website hero. Central Asian appearance. Elegant restrained palette suited to a warm cream editorial website. Adult male software developer in his late twenties with short dark hair, subtle glasses, muted navy overshirt over an ivory T-shirt, charcoal trousers and clean off-white sneakers. Holding an open slim graphite laptop at waist height naturally with both hands, screen angled toward him, casual confident stance.

### chef

Final path: public/profession-chef.webp (91548 bytes). Original: exec-89f144f6-66e3-4d91-b6d5-3fee3688eade.png.

Full prompt:

Create a premium realistic 3D rendered HUMAN professional character for a modern Uzbekistan jobs website. A believable adult with normal adult proportions, natural detailed face and anatomically correct hands, subtle friendly expression, physically based fabric and skin, polished high-end advertising CGI (not a toy, not an emoji, no oversized head, no plush, no caricature). Full body head to shoes entirely visible, centered vertical composition with generous transparent empty margin around subject, front three-quarter view, soft studio light from upper left, isolated on genuinely transparent background, no backdrop, no ground plane, no text, no logos, no watermark. Natural poised lively stance suitable for a gently animated website hero. Central Asian appearance. Elegant restrained palette suited to a warm cream editorial website. An adult male professional CHEF in his early thirties with a neatly trimmed beard. Immaculate ivory double-breasted chef jacket, charcoal apron, dark trousers, practical clean black kitchen shoes, small classic cream chef toque. Holding a simple tasteful plate with a finished dish in one hand at waist level, the other hand relaxed. Warm confident expression, realistic natural adult proportions. No knives, no flames, no text or restaurant branding.

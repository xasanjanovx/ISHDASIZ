# ISHDASIZ Impact — applied design direction

This page overrides generic MASTER output and the copied Studio V8 guidance. User requirements and ISHDASIZ identity take precedence.

## Product and conversion

A recruitment marketplace: one account can search jobs and candidates, publish a vacancy or create a resume. Keep two equal, side-by-side actions: «Xodim topish» and «Ish topish». Keep the phrase «Ish va xodim topish oson». No bottom navigation. Show the confirmed offer «Saytda e’lon joylash — bepul», scoped to the website, not the paid Telegram channel.

The hero is a complete first-screen advertisement: recognizable logo → confident benefit → visual search metaphor → two clear actions → free website offer. No invented user totals, placement success rates, testimonials, old prices or scarcity. Conversion improvement is a hypothesis to validate after production integration, not an observed result.

## References actually applied

- UI UX Pro Max query `job board recruitment --design-system --variance 8 --motion 8 --density 4` matched **Job Board/Recruitment** and **Bold Typography Mobile (Inter Poster)**. An earlier query with “premium” matched a luxury brand and was rejected. Generated palette and Brutalism defaults are recommendations only.
- UI UX Pro Max explicit style query `3d hyperrealism --domain style` matched **3D & Hyperrealism**, including a real WebGL object, material lighting, perspective, layered surfaces and an accessible non-WebGL fallback. Its high-cost/risk guidance is addressed by limiting the scene to one object, capping pixel ratio and frame rate, stopping rendering when inactive, and keeping all essential controls in HTML.
- [Framer DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/framer/DESIGN.md): poster typography, a single emphatic visual stage, staged reveal and direct CTA hierarchy. Do not copy proprietary fonts, violet gradients or the all-dark default.
- [Revolut DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/revolut/DESIGN.md): tactile hero object, controlled material reflections and assertive contrast. Do not copy financial claims, logos or cobalt palette.

## Identity and typography

Use the original ISHDASIZ logo without recoloring. Use warm paper, near-black, and the logo's yellow as the single vivid accent. Inter Variable throughout, 800 display, 650 actions, 450 supporting text. Headline uppercase and a rotated yellow highlight identify the campaign. No cartoon figures or clay UI icons.

## Spatial scene

A real Three.js r180 WebGL magnifier with metal, studio reflections and a dark handle searches the hiring/career portrait. The lens changes orientation and position as the two scenes switch. HTML cards render above the canvas so no 3D object can obscure readable content. Keep portraits as unmodified generated assets with CSS crops.

Use 30fps maximum and capped device pixel ratio; do not load external 3D models. Reduced-motion renders one static frame. Pause, keyboard focus, hidden document, offscreen intersection and route changes stop the continuous renderer. Release the GPU context on unmount. Provide the CSS magnifier fallback when WebGL is unavailable.

## Marketing handoff

`?audience=hiring` and `?audience=career` initialize the matching visual. `?screen=search&audience=hiring` opens candidate search directly; `?screen=search&audience=career` opens vacancies. Preserve audience and UTM parameters on navigation. `ishdasiz:intent` is a local CustomEvent hook; there is no analytics upload in this prototype.

## Delivery boundary

This is an interactive design prototype. No actual SMS, account creation, moderation, payments, slot reservations, broadcasts or channel publication is performed. Existing Telegram fullscreen and inset handling remains; native-device testing follows deployment. A production payment/moderation backend remains separate work.

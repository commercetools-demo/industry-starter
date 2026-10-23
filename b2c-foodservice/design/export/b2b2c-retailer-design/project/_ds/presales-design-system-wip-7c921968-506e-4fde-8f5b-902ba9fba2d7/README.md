# commercetools Design System

A design system distilled from commercetools' **"General Deck — dark mode 2.6V0.1"** PPTX and the **"B2B Commerce — D2 Pitch"** PDF. Built for presales: pitch decks, prospect mocks, and storefront/merchant demos.

## Sources

| Source | What we pulled from it |
|---|---|
| `uploads/General Deck commercetools dark mode 26V0.1.pptx` | Full color palette (slide 18), embedded fonts (Archivo + Roboto), dark-mode layout vocabulary, signature violet/teal glow imagery, layout templates (title, section headers, 2/3/4-column, customer logo, confidential, contact) |
| `uploads/B2B Commerce - D2 Pitch .pdf` | Product hierarchy (Platform + Frontend + B2B Commerce + Add-ons), B2B flows (Quote, Approval, Business Units), voice & content conventions for presales copy |
| `uploads/Onsite DEMO Nestle RFP 2026 Presentation_compressed.pdf` | RFP workshop patterns: detailed time-slot agendas, numbered **UC #N** use-case section headers, **Key Takeaways** closer (three-part benefit list + outcome line), back-office integration architecture diagrams, **6-month MVP timeline / phased rollout roadmap**, controlled-launch (25→50→100%) visual, **From cart to order** commerce domain model (Cart + Order with Customer / Store / Line Items / Shipments / Payments / Discounts / Taxes as related entities) |
| `uploads/General Deck commercetools dark mode 26V0.1.pdf` | Integration Patterns deck: the three canonical modes — **Sync API Extensions** (request-in-flight loop with rollback path), **Async Subscriptions** (event → queue → listener pipe), **Custom Applications** (UI + data-model extensions) — all optionally hosted in commercetools Connect |

Raw extracted XML + notes live in `_research/`. Media from the PPTX is in `assets/pptx-media/` (signature radial glows, navy/violet geometric background, prism hero, product-tiles photo).

---

## Product context

commercetools is a **cloud-native, headless, API-first composable commerce platform**. The four products presales deals with:

1. **Composable Commerce** — core API platform (catalog, orders, carts, customers, pricing)
2. **Frontend** — React/Next.js frontend-as-a-service that connects to Composable Commerce
3. **Checkout** — pre-built, customizable checkout flow
4. **Merchant Center** — admin UI for business users; extensible via Custom Applications

The design system covers **two surface types**:
- **Customer-facing** (storefront, checkout, marketing site, pitch decks)
- **Merchant-facing** (Merchant Center admin UI)

---

## Index

| Path | Purpose |
|---|---|
| `README.md` | This file — content, visual, iconography docs |
| `SKILL.md` | Portable skill manifest (works as Claude Code skill too) |
| `colors_and_type.css` | CSS variables: colors, type scale, spacing, radii, shadows |
| `fonts/README.md` | Font substitution note (Google Fonts used in place of embedded Archivo/Roboto) |
| `assets/` | Official logo (`commercetools-logo.svg`, white-outline variant) + `pptx-media/` (glows, backgrounds, hero photos) |
| `preview/` | Small HTML cards for the Design System review tab |
| `ui_kits/storefront/` | Storefront (B2C/B2B) UI kit with JSX components + interactive `index.html` |
| `ui_kits/merchant-center/` | Merchant Center admin UI kit |
| `slides/` | Presales slide template in HTML (title, agenda, section header, 2/3/4-col, quote, customer logo, confidential, contact) |
| `_research/` | Raw slide XML, theme, notes — keep for reference |

---

## Content fundamentals

**Voice.** Enterprise B2B, confident, outcome-oriented. Speaks to decision-makers (VPs, CTOs, Heads of Digital) about revenue, scale, TCO and time-to-market — not about code. Sentences are assertive and benefit-led, then followed by a feature list that proves the claim. Examples from the deck:

> "Deliver **superior digital experiences** for all of your customers, quickly and at scale."
> "**Accelerate procurement** with intelligent, lightning-fast search that respects B2B-specific product entitlements, pricing, and complex filtering needs for effortless discovery."
> "**Effortlessly manage** massive, complex product data sets, ensuring accuracy and relevance through flexible data models tailored to every business buyer's needs."

**Casing.** The brand writes its own name lowercase — always **`commercetools`** (never "Commercetools" or "CommerceTools"), even at the start of a sentence. Product names are Title Case: **Composable Commerce**, **Merchant Center**, **Business Unit**, **Store Launchpad**. Acronyms keep conventional casing: `MACH®`, `OOTB`, `B2B`, `API`, `SLA`, `TCO`.

**Person.** Second person for prospects (*"your business"*, *"your customers"*). First-person-plural for commercetools (*"our robust core product"*, *"we believe…"*). Never "I".

**Pattern — the three-part benefit slide.** This is the workhorse. Bold outcome verb, supporting "how" line, then an indented feature/capability list. Examples: *"Drive margin and enforce contracts with dynamic, tiered, and volume-based pricing…"* → B2B Commerce Modules: Pricing → bullet list.

**Eyebrow → Headline → Supporting copy** is the standard hierarchy on marketing/pitch slides. Eyebrows are short labels like *"Product overview"*, *"B2B Commerce"*, *"What's next"*.

**Bullet style.** Uses `●` (filled) at level 1 and `○` (hollow) at level 2 in the source decks. Keep this.

**Numbers.** Slide agendas use two-digit numerals: **01, 02, 03**. (The source deck has a typo — `O6` instead of `06` — don't copy that.)

**No emoji. No icons-as-decoration.** The source decks and product content use zero emoji. Iconography is sparing and functional (status dots, feature glyphs, product mini-diagrams). Unicode mid-dots (`⏐`) appear as dividers in contact layouts.

**Vibe.** Grown-up, enterprise, slightly Germanic precision. Confident but not hypey — no "revolutionary", no "supercharge". Words that recur: *composable, cloud-native, modular, flexible, scale, seamless, extensible, entitled, enterprise-grade, OOTB, future-proof*.

---

## Visual foundations

**Color philosophy — dark-first.** The core pitch deck is dark mode. Deep indigo-navy `#191741` is the default canvas. Violet `#6359FF` is the signature brand color — used for headlines, accents, and the signature radial "glow" behind hero content. Teal `#0BBFBF` is the secondary accent for data, diagrams and "available now" states. Amber `#FFC806` is sparing — used for highlights, callouts, status. Warm stone neutrals `#FBF9F5 → #7C7975` are the light-mode counterpart (Merchant Center leans lighter).

Every brand hue has a **7-step tint scale** (+3 lighter → primary → −4 darker). See `colors_and_type.css`.

**Typography.**
- **Archivo** (700 / 500 / 400) — display, headings, UI labels. Tight tracking (`-0.02em`) on display sizes.
- **Roboto** (400 / 500 / 700) — body copy, paragraphs, form fields.
- **Roboto Mono** — numeric tables, IDs, code snippets.
- Display sizes run big on hero slides (`clamp(56px, 6vw, 96px)`), body stays 15–18px.

**Backgrounds.** Three modes:
1. **Solid navy** (`#191741`) for most content slides
2. **Aurora / gradient** — soft radial glows (violet + teal) on hero and section slides; sampled directly from `assets/pptx-media/image5.png` and `image8.jpg`
3. **Geometric block** — navy / white / violet diagonal (from `image3.png`) for title slides

The glow images (`image1.png` violet, `image5.png` teal) are used as full-bleed atmospherics, low-opacity, behind hero content. Never on content-dense slides.

**Animation.** Minimal in the source decks (static). In web UI use `cubic-bezier(0.4, 0, 0.2, 1)` @ 200ms for state changes; `cubic-bezier(0.16, 1, 0.3, 1)` @ 320ms for entrance. No bounces, no easter-eggs. Fades + gentle Y-shifts (8–12px) only.

**Hover states.** Buttons darken by one step (violet `#6359FF` → `#4E43D8`). Links brighten to lighter tint on dark backgrounds (`#C2C2FF`). Cards gain a subtle 1px border lift (`rgba(255,255,255,0.08) → 0.16`) and a small shadow (no scale, no lift translate).

**Press states.** One step darker again (`#4242B2`). Subtle inset `0 1px 2px rgba(0,0,0,0.2)`.

**Borders.** Hairline `1px solid rgba(255,255,255,0.08)` on dark; `1px solid #DEDAD4` on light. Used sparingly — the brand prefers color blocks and shadow over outlines.

**Shadows.**
- Small: `0 1px 2px rgba(0,0,0,0.35)` for inputs/chips on dark
- Medium: `0 6px 20px rgba(0,0,0,0.35)` for elevated cards
- Large: `0 20px 48px rgba(0,0,0,0.45)` for modals
- **Signature glow:** `0 0 60px -10px rgba(99,89,255,0.55)` behind hero imagery

Protection gradients (not capsules) to lift text off imagery: a 180deg fade from `rgba(25,23,65,0.0)` to `rgba(25,23,65,0.85)` at the bottom of hero image areas.

**Corner radii.** 4 / 6 / 10 / 16 / 24 / 32px scale. Buttons `10px`. Cards `16px`. Large hero tiles `24px`. Pills `999px`. The deck uses generous rounding — nothing is hard 90°.

**Cards.** Dark-mode cards are `#252566` (navy-700) surface, no border, `border-radius: 16px`, `box-shadow: 0 6px 20px rgba(0,0,0,0.35)`, padding `24px`. Light-mode: `#FFFFFF` surface, `1px solid #DEDAD4`, same radius, lighter shadow.

**Layout rules.**
- 12-column grid at 1280+ ; 4 col at ≤640.
- Fixed gutter 24px. Outer margin 48px desktop, 20px mobile.
- Slides are 16:9 at 1920×1080 with 80px edge padding.
- Section headers bleed edge-to-edge (no padding), content slides pad.

**Transparency & blur.** `backdrop-filter: blur(20px)` on floating UI (command palettes, toasts, sticky headers on imagery). Transparency is for atmosphere (overlay glows, frosted headers) — never for content containers.

**Imagery color vibe.** Cool, slightly cinematic. Product photography (see `pptx-media/image8.jpg`) trends grey-neutral with selective violet accents. 3D renders (`image7.jpg` prism) push saturated violet + cyan — "prism / refraction / light" is a repeating metaphor. No grain, no warm tones, no b&w.

**Layering rules.** Glow behind → image / content middle → eyebrow + headline foreground. Glows never clip — they fade fully to transparent within the slide's bleed.

---

## Iconography

The source decks and PDF contain **almost no decorative iconography** — commercetools deliberately uses typography + geometry + color blocks to carry visual weight. What icons exist are:

- **Status dots** — `●` (filled circle) for "available / on", `○` (hollow circle) for "in progress / sub-item". Used heavily in bullet lists.
- **Feature glyphs** — simple outline SVGs inside the Merchant Center and on capability slides. These match the **Lucide / Heroicons** outline style at 1.5px stroke. The source didn't ship a custom icon set.
- **Product mini-diagrams** — rectangles + arrows in thin strokes showing data flow (Quote flow, Approval flow, Business Unit hierarchy). These are drawn inline per slide, not reused as an icon library.

**No emoji** anywhere. **No Unicode decorative chars** beyond the bullet marks above and `⏐` as a divider in the Contact layout.

**Our substitution.** We link **Lucide** (via CDN) for all interface icons — 1.5px stroke weight, 24px grid, rounded caps. This matches the outline + weight used in the Merchant Center screenshots. Documented in `ui_kits/*/README.md`.

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```

Logos: `assets/commercetools-logo.svg` is the **official** commercetools wordmark (white-outline variant — renders white on dark; invert with `filter: invert(1)` for dark-on-light use). Always use this file — do not redraw the mark.

---

## Known substitutions & caveats

| Asset | Status |
|---|---|
| **Archivo** font | ✅ Exact match via Google Fonts — source PPTX embedded Archivo. |
| **Roboto** font | ✅ Exact match via Google Fonts. |
| **commercetools logo** | ✅ Official SVG in `assets/commercetools-logo.svg`. |
| **Icon library** | ⚠️ Using Lucide via CDN (no custom icon set in source). |
| **Merchant Center component library** (`@commercetools-uikit`) | ⚠️ Not attached. We recreate the visual style from public screenshots; component specs may drift from the real library. |


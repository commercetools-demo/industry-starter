# Malva — plumbing and waste management: design foundations

Source: `source/Malva.html` (a single-file prototype with hash routes `#home #plumbing #waste #about #quote` and a sign-in modal), tokens from `source/colors_and_type.css` (Store Launchpad B2B system).

## Business context

B2B contractor offering plumbing and waste management. Audiences: **facilities managers, manufacturers, property / real estate, healthcare**. Services are **quoted, not priced** — there is no price anywhere in the design. Conversion is "Request a quote"; retention is the **client portal**.

### Services (canonical list, from the brief and the design)

| # | Plumbing (5) | Waste management (7) |
| --- | --- | --- |
| 1 | Pipe installation & repair | General waste collection |
| 2 | Drain cleaning & CCTV survey | Recycling |
| 3 | Backflow & water testing | Hazardous waste |
| 4 | Boiler & hot water | Grease trap servicing |
| 5 | Commercial fit-outs | Medical / clinical waste |
| 6 | | Liquid waste & tankering |
| 7 | | Compliance reporting |

## Tokens (unchanged from the design system)

| Group | Values |
| --- | --- |
| Ink / text | `--sl-ink #212121`, muted `--fg2 #494949`, `--fg3 #707070` |
| Brand | `--sl-navy-900 #173A5F` (only accent), `-700 #274082`, `-500 #415A77`, `-100 #ECF0FB` |
| Surfaces | white; wash `--bg-muted #F3F5F9`; dark band `--sl-ink`; footer `--sl-ink-2 #262626`; top bar `#000` |
| Border | `#D1D1D1`, subtle `#DCE0EB` |
| Semantic | success `#E4F3E9/#1E7A3E`, danger `#F6E5E7/#B1263A`, info `#ECF0FB/#274082`, warn `#FCEFD4/#8A6D1F` |
| Type | Inter (UI), Inter Display (28pt, headings ≥ 24px). Body 16px (the design raises the system's 14px to 16px) |
| Radii | buttons, inputs **0**; cards, modal 8px; tags 4px; step badges 50% |
| Shadow | card `0 1px 2px rgba(25,40,81,.05)`, hover `0 2px 6px rgba(25,40,81,.08)`, overlay `0 12px 32px rgba(0,0,0,.12)` |
| Focus | `0 0 0 2px #fff, 0 0 0 4px #173A5F` |
| Layout | container 1440px, side padding 48px (20px < 900px), top bar 40px, nav 72px sticky |
| Motion | 200ms `cubic-bezier(.2,0,0,1)` on button background only |

Prototype type scale: hero H1 56/1.1 bold; page-header H1 44/1.15 bold; section H2 32/1.2 semibold; card H3 20; stat figure 48 bold; body 16; card body 15; meta 13.

## Page chrome

- **Top bar** (black): left "24/7 emergency line: 0800 555 0142"; right "Client portal" (opens modal), "Request a quote".
- **Nav** (white, sticky): logo (navy square glyph + "Malva" + "Plumbing & Waste" subline, hidden < 1180px) · Plumbing · Waste management · About · outline **Client portal** button · primary **Request a quote** button. Active link: 2px navy underline. Links hidden < 900px — **no mobile menu is designed**.
- **Footer** (dark): 4 columns (brand blurb, Plumbing, Waste, Company); links per service group; "© … Sample content."
- **Sign-in modal**: title "Client portal", copy "View service visits, waste transfer notes and invoices.", email, password, Sign in. Closes on backdrop click.

## Components inventory

| Component | Where | Notes |
| --- | --- | --- |
| Hero | Home | 620px min, photo placeholder + 40% black overlay, H1, lead, white primary + outline-white buttons |
| Page header | Plumbing, Waste, About, Quote | muted wash, breadcrumb "Home / X", H1, lead |
| Service card | Home (2 pillars), PLP (5 / 7) | photo (200px+), mono index `01`, H3, 15px copy, "Learn more →" |
| Audience card | Home | no image; H3 + one sentence |
| Stat | Home (dark band) | 2px white top rule, 48px figure, caption |
| Cert badge | Home, About | bordered chip with title + small caption |
| Testimonial | Home | bordered card, 18px quote, role + org |
| Check list | PLP bands | "✓" bullets, light variant on dark |
| CTA band | all content pages | navy, H2 + white button to `#quote` |
| Stepper | Quote | 3 steps, active underline, done = green check |
| Option card | Quote step 1 | radio card, selected = navy border + `#ECF0FB` fill |
| Inputs | Quote, modal | 48px, sharp, label above, focus ring, error text 13px red |
| Confirmation | Quote | green block |
| Aside card | Quote | phone, email, emergency line |
| Modal | Portal sign-in | 420px, overlay shadow |

## Content rules

Sentence case; imperative buttons; no emoji; no prices; numerals as digits ("4 h", "98.6%"); DD/MM/YYYY dates in portal; second person for the buyer, "we" for Malva.

## Design gaps and defects found in the prototype

Treated as requirements work in `PLAN.md`.

1. **No PDP, cart, checkout (as such) or account screens.** The brief asks for them; the prototype only has a quote form and a sign-in modal. Mapping in `PLAN.md` § Mapping.
2. **Service cards link to `#quote`**, not to a detail page.
3. **No mobile navigation** (links hidden < 900px with no replacement).
4. **Portal triggers are `<a onclick>` with no `href`**: not keyboard-operable as links; modal has no `role="dialog"`, focus trap, Escape handling or focus return.
5. Form errors are inserted without `aria-live`; inputs have no `aria-invalid`; step 0 and 1 required rules are minimal (service, company), step 2 only validates email.
6. Quote step 1 has no per-service selection — only Plumbing / Waste / Both — although there are 12 services.
7. Stats (4 h, 98.6%, 82%, 350+), testimonials, registration number `CBDU000000`, "Gas Safe & WRAS", phone numbers and `quotes@malva.example` are **placeholders** and must be confirmed by the owner before launch.
8. All imagery is striped placeholders with mono captions — shot list is in `PLAN.md`.
9. Nav has no "Contact" entry; contact is merged into the quote page (matches the brief's "Request a quote / contact").
10. Healthcare-specific content (clinical waste tracking, water safety) appears only as one audience card and one testimonial; no sector landing pages.

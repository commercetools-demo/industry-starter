# Malva Telecom — design

Source: Claude Design project `d2b5e3bd-b378-4812-ba7f-800feef1257e` (prototype) on design system `82a17f5a-491a-496f-8d92-5152f6f7e349` (Telecom). Raw files in `source/`. US English copy throughout.

## Principles

1. **Honey Locust carries structure, After-Party Pink carries action.** Header, nav, page-hero strips, card headers: `brand-*`. Every CTA, link, bullet, selected state: `pink-*` (action = `pink-700`).
2. **Light brand means dark text.** Never white on `brand-500`; use `--color-text-on-brand` (`brand-950`). White is allowed on `pink-700` and darker, and on `brand-950`.
3. **Pills and soft cards.** All buttons, filter chips, nav items, inputs: `--radius-pill`. Cards: `--radius-xl` (24px); inner tiles `--radius-lg` (20px); icon tiles `--radius-md` (12px).
4. **Exo for UI, Roboto for body, Inter for CTAs.** Headings/nav/labels: Exo with `--tracking-ui` (1px; brand wordmark 2px). CTA buttons: Inter 800. Body: Roboto.
5. **Disclosure is first-class.** Every plan in the bundle and every plan on the account page shows its Broadband Facts label (regulatory component; black-on-white, intentionally outside the brand palette).

## Tokens

Source of truth: `source/_ds/tokens.css`. The storefront must carry these custom properties verbatim (names included) so the design can be re-synced.

### Color

| Group | Tokens | Notes |
| --- | --- | --- |
| Brand (Honey Locust) | `--color-brand-50…950` (base 500 `#f9c162`), `--color-brand-gradient` (90deg `#f9c162`→`#d4a453`) | 950 `#3e3019` is the "ink" on brand surfaces and the footer/active-pill background |
| Complement (After-Party Pink) | `--color-pink-50…950` (base 500 `#c162f9`) | 700 `#8745ae` = action; 800 hover; 900 `#4d2764` = add-on tiles / phone promo card; 50 = soft callouts |
| Neutral | `--color-neutral-0, 50, 100, 200, 300, 400, 500, 600, 700, 900` | 400 = input border, 50 = table header, 600 = muted text |
| Semantic | `--color-text`, `-text-muted`, `-text-on-brand`, `-text-on-pink`, `-text-link`, `-surface`, `-surface-subtle`, `-surface-brand`, `-surface-brand-subtle`, `-border` (`#ddd`), `-border-brand`, `-border-on-brand`, `-action`, `-action-hover` | Prefer semantic over scale tokens in components |

Gaps found in the prototype (hard-coded; fix when porting): `#fff` card/pill-text (use `--color-surface` / `--color-text-on-pink`), `#a1262b` form error (no error token — propose `--color-danger: #a1262b`), `#000`/`#525252`/`#3d3d3d` inside the label (intentionally literal; see `specs/broadband-label.md`), hero placeholder `rgba(62,48,25,…)` stripes.

### Typography

| Token | Value |
| --- | --- |
| `--font-display` | Exo 400/500/600/700 |
| `--font-cta` | Inter 400/500/700/800/900 |
| `--font-body` | Roboto 400/500/700/900 |
| `--text-xs…5xl` | 12, 14, 16, 18, 20, 24, 26, 36, 40 px |
| `--tracking-ui` | 1px |

Scale as used (prototype values outside the token scale in italics): H1 hero *56/1.05*; H1 page 48; H2 section 36; H2 sub 26; card title 26; price 40 (card) / 30 (cart); promo title *30/1.15*; nav 15/600; chip 14/600; eyebrow 12–14/600 uppercase or tracking 2px; CTA 15–16/800 Inter; body 16/1.4–1.5; muted 14.

### Spacing, radius, elevation, layout

- `--space-1…9`: 4, 6, 8, 10, 16, 20, 24, 30, 40. Prototype also uses 12, 14, 28, 32, 36, 48, 56, 64 — map to the nearest token or extend the scale (open decision D2).
- `--radius-sm 6 / md 12 / lg 20 / xl 24 / pill 100`.
- `--shadow-sm` header + login card; `--shadow-md` category-card hover; `--shadow-lg` unused.
- `--container-width: 1440px`, horizontal page padding 40px, section gap 24px.

## Components

| Component | Where | Anatomy / states | Spec |
| --- | --- | --- | --- |
| Site header | all pages | Sticky, `brand-500`, `shadow-sm`; wordmark "malva" (Exo 700 30px, 2px tracking, brand-950); nav pills; account link; bundle pill `My bundle · N` | `specs/shell.md` |
| Nav pill | header | Default transparent / active `brand-950` bg + white text | `specs/shell.md` |
| Filter chip | PLP, add-ons | Default `brand-100`/`brand-950`; active `brand-950`/white; "N plans" count right-aligned | `specs/plp.md` |
| Plan card | PLP | Honey header (tag, name, price 40px + "/mo") → ▸ bullets → hairline → validity → outlined pill CTA "Choose plan" ⇄ filled "Selected ✓" | `specs/plp.md` |
| Category card | Home | Honey title band, blurb, "From $X/mo →"; hover `shadow-md` | `specs/homepage.md` |
| Promo tile | Home | `pink-900` (phone) / `brand-100` (add-ons), eyebrow, 30px title, pill CTA | `specs/homepage.md` |
| Hero | Home | `brand-gradient`, 24px radius, 1.2fr/1fr, image slot 4:3 | `specs/homepage.md` |
| Add-on tile (compact) | Home, bundle | 48px `pink-900` initial tile (12px radius) + name + price | `specs/homepage.md` |
| Add-on card | Add-ons | `pink-900` 120px banner with name, tag, description, price "/mo", toggle CTA "Add to bundle" ⇄ "Added ✓" | `specs/addons.md` |
| Bundle line (plan) | Bundle | Honey header (kind, name, price) + bullets/validity/remove + Broadband Facts label | `specs/cart.md` |
| Order summary | Bundle | Sticky aside (top 96px), 320px: plans, add-ons, monthly total, one-time fees, CTA, tax note | `specs/cart.md` |
| Form field | Login | Pill input, `neutral-400` border, Exo 600 label | `specs/login.md` |
| Stat card / contract table | Account | Bordered cards; table with `neutral-50` header, 5 columns, horizontal scroll under 640px | `specs/account.md` |
| Broadband Facts label | Bundle, Account | 400px max, 2px black border, Roboto 900 headings, thick/thin rule hierarchy | `specs/broadband-label.md` |
| Footer | all pages | `brand-950` bg, `brand-500` wordmark, five text links, copyright | `specs/shell.md` |

The Telecom DS exposes no code components (`_ds_manifest.json` `components: []`); everything is hand-built from tokens. The DS preview cards (button, navigation, plan-card, syntax-chip) were not imported.

## Pages (prototype `view` states)

`home` · `phone` / `wireless` / `cable` (one PLP template, three data sets) · `addons` · `login` · `cart` ("My bundle", empty / full / ordered) · `account` (login-gated).

Not designed: PDP, search, checkout (the prototype's "Place order" completes in-place), order history, address book, payment methods, registration, password reset, error pages, footer destinations, mobile breakpoints (layout is fluid via `auto-fit`/`auto-fill`/`flex-wrap`, but no explicit small-screen design exists apart from the account table's `min-width: 640px` scroller).

## Prototype data (informational — authoritative data is the commercetools catalog)

- Phone (month-to-month): Essential 5GB $25, Plus 20GB $35, Unlimited $50 (most popular), Unlimited Max $65.
- Wireless (12-month price lock): Air Lite $45 (LTE), Air 5G $55 (most popular), Air 5G Plus $75.
- Cable (24-month price lock, $25 activation): Cable 100 $39.99, Cable 500 $59.99 (most popular), Cable Gig $79.99.
- Add-ons: Spotify $10, Apple TV+ $10, Apple Music $11, Netflix $8, Disney+ $8, Cloud 200GB $3, Device Care $12 (tags Music / Video / Extras).
- Fees on labels: ETF none (phone) / $0 (wireless) / "$10 x months remaining" (cable); government taxes "Varies by location"; bundle discounts text per kind.
- Demo account: `alex.rivera@example.com`, account no. MV-48210-7, contract rows Cable 500 (24 mo), Unlimited, Spotify.

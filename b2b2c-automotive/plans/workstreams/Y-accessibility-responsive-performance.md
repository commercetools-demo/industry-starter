<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream Y — Accessibility, responsive and performance sweep

Status: DRAFT v1 (2026-10-12). Cross-cutting: `b2b2c-automotive/storefront/` and `b2b2c-automotive/portal/`. Dev URLs assumed: storefront `http://localhost:3000`, portal `http://localhost:3001`. All measurements use a **production build** (`npm run build && npm run start`) with seeded data; `next dev` numbers are not evidence.

## Goal

Prove, with measurements, that both apps meet WCAG 2.2 level AA, work and look right at 375, 768, 1024 and 1440 px (and reflow at 320 px), can be used by keyboard alone, and meet the performance budgets below; fix every defect found. Fixes are made in the components that own the defect (not in a global patch layer), each with a test that would have caught it.

## Depends on

K, L, M, N, O, P, Q (storefront pages), S, U, V, W (portal pages) per `DEPENDENCY-PLAN.md` (V = customers, subscriptions, returns, reviews; W = marketing, bundles, product import, brand partnership; wholesale buying from Malva is out of scope, owner 2026-10-12); owner prerequisite **SO-01** (sign-off on screens missing from the designs: mobile navigation, mini-cart, filter sheet, account area, error and empty states, portal mobile layout, editor chrome). Y checks the screens as built from the specs. X runs in parallel; do not change security behaviour here.

Scope notes (owner decisions 2026-10-12): the portal has only the roles **Admin and Buyer**; there is no portal quick order, cart and checkout, orders, quotes, invoices, approvals, roles and permissions, price lists or saved lists, no partnership floor or territory screens and no tailoring review queue (text and images publish at once). Checkout is the hosted commercetools Checkout widget with the Stripe connector (third-party hosted component). Subscriptions are sold and managed for real. Store picker and portal branch screens use a Leaflet map. No e-mail is sent anywhere.

## Requirements verified (no new requirement is implemented)

Y has no primary spec. It verifies these requirements and records pass or fail per page. Paths under `b2b2c-automotive/openspec/specs/`.

| Spec | Requirement (exact title) | Check |
| --- | --- | --- |
| `seller-portal/design-portal-shell-and-navigation/spec.md` | Dark top bar and floating sidebar rail (scenario "Narrow viewport": icon rail under 1024 px, drawer under 700 px); Light and dark; Navigation follows permissions | R1 to R6, A-contrast in dark |
| `seller-portal/bootstrap-and-structure/spec.md` | Styling from the admin kit; Isolated editor styling | token-only styling; editor does not leak styles; contrast in both themes |
| `consumer-storefront/bootstrap-and-structure/spec.md` | Styling from the automotive tokens; Client state (no spinner flash); Theme read, sanitised, applied at first paint | no layout shift from theme; first paint correct |
| `consumer-storefront/theming-design/spec.md` | all requirements that define what a theme may change (read each; check the default theme and the two seeded reseller themes) | contrast of the default theme; behaviour with extreme values |
| `consumer-storefront/design-storefront-shell/spec.md`, `design-store-picker/spec.md`, `design-vehicle-finder-and-garage/spec.md`, `design-product-listing-page/spec.md`, `design-product-detail-page/spec.md`, `design-cart-page/spec.md`, `design-checkout-page/spec.md`, `design-order-confirmation-page/spec.md`, `design-account-area/spec.md`, `design-home-page/spec.md` | every requirement that mentions a responsive width, a sticky element, a dialog, a form, a status message, an image or a focus behaviour | page checklists in "Page inventory" |
| `seller-portal/design-*` (all specs the plan implements; the four out-of-scope specs quick-order-and-cart, orders-quotes-invoices, approvals-and-roles, price-lists-and-saved-lists are excluded) | tables, tabs, dialogs, toasts, chips (status is text, not only colour) | page checklists |

## Decisions already taken (do not reopen)

| # | Decision | Source |
| --- | --- | --- |
| D1 | Target: WCAG 2.2 AA for both apps in their default theme. Reseller themes from Contentools are **not** contrast-checked (design.md decision 2); the report states this and lists the two seeded themes' ratios for information only. | design.md decision 2 and Risks; Q-Y01 |
| D2 | Viewports: 375x812 (phone), 768x1024 (tablet), 1024x768, 1440x900; reflow check at 320 px wide; text-size check at 200 percent; text-spacing check per WCAG 1.4.12. | task brief |
| D3 | Tooling: Chrome DevTools MCP (`emulate`/`resize_page`, `take_snapshot`, `take_screenshot`, `press_key`, `evaluate_script`, `lighthouse_audit`, `performance_start_trace`, `performance_analyze_insight`, `list_network_requests`, `list_console_messages`) plus `jest-axe` in component tests. Lighthouse's accessibility audit runs axe-core inside; its score is not enough, **every failing audit must be fixed or justified**. | decided here |
| D4 | Status is never conveyed by colour alone: chips carry text (fit badge, margin chips, return status, subscription status, stock). Disabled actions carry the reason in text (`aria-describedby`), visible without hover. | portal shell spec; design systems |
| D5 | Budgets (production build, mobile profile = `emulate` network "Slow 4G" and CPU throttling 4x; desktop profile = no throttling): storefront LCP <= 2.5 s and CLS <= 0.1 and INP <= 200 ms and TBT <= 200 ms on home, listing, product, cart; home transferred bytes <= 1.5 MB, listing <= 1.2 MB, product <= 1.2 MB; JavaScript transferred (compressed) <= 220 KB on home, listing, product; server response (TTFB) <= 600 ms warm; Product Search calls per render <= 2. Portal (desktop profile, signed in): LCP <= 2.5 s, CLS <= 0.1, INP <= 200 ms, JavaScript transferred <= 350 KB on non-editor routes; editor routes (Theme, Pages, Content) are lazy-loaded and documented with their actual size (exception budget 1.5 MB compressed, never loaded on other routes). Tables over 50 rows paginate (50 per page). | decided here; Q-Y02 |
| D6 | The browser never calls a commercetools **API** host on any page (re-checked here with the network list). Allowed exceptions, listed in the audit: the hosted commercetools Checkout widget and its Stripe iframe on the checkout page only, and OpenStreetMap tile hosts on map pages. | storefront spec "BFF boundary and helpers"; owner Q-012, Q-I02 |
| D7 | Test and fix evidence in `plans/evidence/Y/`; one issue row per defect with the file changed and the test added. | Z |

## Page inventory (task Y-00)

Create `plans/evidence/Y/pages.md` with this list filled with real URLs, the persona for each portal route, and the state to put the page in. Add any route that exists in the app but not here (run `node scripts/list-routes.mjs` from X, or walk `app/**/page.tsx`).

**Storefront** (store path `<A>` = the first seeded reseller; locale `de-DE`, and one pass of the key pages in `en-US`): home `/de-DE/<A>`; listing `/de-DE/<A>/category/<slug>` with no vehicle, with a vehicle (fit filter on), and with zero results; search `/de-DE/<A>/search?q=`; product `/de-DE/<A>/p/<slug>` (fits, does not fit, no vehicle, out of stock, bundle, with and without reviews, with the subscribe option and its interval select, with tailored images and their alt text); cart (empty, with items, with a subscription line, with promo applied and with a rejected code); checkout (the hosted commercetools Checkout widget: address, shipping, payment with the Stripe element, a validation error state; third-party iframe content is checked for traps and focus entry/exit only, defects inside it are logged); order confirmation; account (overview, orders, order detail, garage, addresses, payment methods, subscriptions, returns, profile, sign-in, register, password reset); store picker overlay (Leaflet map plus the list as keyboard alternative); vehicle finder overlay and the plate/VIN error; mobile navigation drawer; mini-cart; filter sheet; a published Puck page `[...slug]`; `not-found`; `error`; impersonation banner on and off.

**Portal** (personas `adminA`, `buyerA`, light and dark): sign-in, register, reset, pending-approval; dashboard; Catalog & pricing (every tab, including tailoring with the image upload and required alt text); Bundles; Product import; Store & channels (branch list, branch editor with the Leaflet map and a text address alternative); Content (the three Contentools tabs); Marketing and Email (screens that store content and never send); Customers; Subscriptions (list, detail, pause, resume, cancel); Returns (list, record, detail, refund dialog); Reviews; Brand partnership; Company & team; Account settings; command palette; notifications panel; Copilot panel; business unit switcher; customer-session banner; drawer at under 700 px; `forbidden` and `not-found` pages.

## The checks

### WCAG 2.2 AA (one row per success criterion; evidence per page in `report.md`)

| SC | What to verify | How |
| --- | --- | --- |
| 1.1.1 Non-text content | every informative image has `alt` (product, logo, vehicle, tailored product images: alt is a required field in the portal tailoring form, Leaflet marker icons have `alt`/`title` naming the branch); decorative images `alt=""`; icon-only buttons have an accessible name | snapshot; Lighthouse `image-alt`, `button-name`, `link-name` |
| 1.3.1 Info and relationships | one `h1` per page; heading levels without gaps; real `table` with `caption` and `th scope`; lists are lists; form controls have `label`; groups have `fieldset/legend`; landmarks `header nav main footer`; tabs use `tablist/tab/tabpanel` | snapshot; jest-axe |
| 1.3.2 Meaningful sequence | DOM order equals visual order (esp. sticky bars, drawers, floating sidebar) | Tab order walk |
| 1.3.4 Orientation | no lock to portrait or landscape | emulate 812x375 landscape on 5 pages |
| 1.3.5 Identify input purpose | `autocomplete` on name, e-mail, phone, address, postal code, country, password, new-password in sign-in, register, checkout, profile, company address forms | snapshot of attributes |
| 1.4.1 Use of colour | chips, fit badge, margin chips, return status, subscription status, stock, links inside text (underlined or other cue) | visual plus grayscale screenshot (`emulate` has no filter: inject `html{filter:grayscale(1)}` with `evaluate_script`) |
| 1.4.3 Contrast (minimum) | text 4.5:1 (3:1 large) in default theme, both kits, light and dark for the portal; placeholder text; text on images (hero overlay); disabled text exempt | Lighthouse `color-contrast` plus `scripts/contrast-report.mjs` (below) |
| 1.4.4 Resize text | at 200 percent text size nothing is clipped or overlaps | `evaluate_script`: `document.documentElement.style.fontSize='200%'`, screenshots 1440 and 375 |
| 1.4.10 Reflow | at 320 px wide no horizontal scroll (except data tables in a scroll container with a visible, focusable region and a label) | snippet R-overflow |
| 1.4.11 Non-text contrast | focus ring, input borders, checkbox, radio, chips with icons, chart marks >= 3:1 | contrast report and visual |
| 1.4.12 Text spacing | with line-height 1.5, letter-spacing 0.12em, word-spacing 0.16em, paragraph spacing 2em nothing is lost | inject style (below), screenshots |
| 1.4.13 Content on hover or focus | tooltips and the disabled-reason popovers are dismissible (Escape), hoverable, persistent | manual keyboard and hover |
| 2.1.1 Keyboard, 2.1.2 No trap | everything operable; dialogs and drawers trap focus **and** release it on close; Contentools editors can be left by keyboard | keyboard recipes |
| 2.1.4 Character key shortcuts | the command palette uses a modifier (Cmd/Ctrl+K); no single-key shortcuts | code search `onKeyDown` for single characters |
| 2.4.1 Bypass blocks | skip link to `main` is the first focus stop in both apps | Tab once |
| 2.4.2 Page titled | unique `<title>` per route, locale-aware | snapshot or `document.title` |
| 2.4.3 Focus order | logical in every page; after a route change focus moves to the page heading or `main` | Tab walk |
| 2.4.4 / 2.4.6 Link purpose, headings and labels | no "click here"; links to the same text go to the same place; headings describe content | read snapshot |
| 2.4.7 Focus visible | visible focus indicator on every control in both themes | screenshot each stop |
| 2.4.11 Focus not obscured (minimum) | a focused control is never fully hidden by the sticky header, sticky bottom bar (buy bar, checkout summary), cookie banner or impersonation banner | scroll-and-Tab with `evaluate_script` rect overlap (below) |
| 2.5.3 Label in name | visible label text is contained in the accessible name | snapshot |
| 2.5.7 Dragging movements | priority and ordering have up/down buttons; the Puck editor drag is a third-party editor exception (documented) | check Discount priority tab |
| 2.5.8 Target size (minimum) | pointer targets at least 24x24 CSS px (inline links in sentences exempt); primary controls 44 px on 375 | snippet R-targets |
| 3.1.1 / 3.1.2 Language | `<html lang>` equals the locale (`de-DE` / `en-US`); mixed-language parts marked | snapshot |
| 3.2.1 / 3.2.2 / 3.2.3 / 3.2.4 | no context change on focus or input (the locale and store switchers need an explicit action), consistent navigation order, consistent names | manual |
| 3.3.1 / 3.3.2 / 3.3.3 | errors are identified in text, linked to the field (`aria-describedby`, `aria-invalid`), with a suggestion; summary at the top for long forms | submit invalid forms: sign-in, register, checkout address (own forms; the hosted Checkout widget is third-party), vehicle plate/VIN, return, tailoring image alt text, branch editor |
| 3.3.4 Error prevention | place order, cancel subscription, publish bundle, refund, withdraw a part have a confirmation or are reversible (marketing and email screens never send, so there is no send action) | manual |
| 3.3.7 Redundant entry | checkout does not ask again for data already given in the session (address reuse) | checkout walk |
| 3.3.8 Accessible authentication | no CAPTCHA or puzzle; password fields allow paste and password managers (`autocomplete`) | sign-in |
| 4.1.2 Name, role, value | custom controls (combobox for the vehicle finder and command palette, tabs, dialogs, switchers, steppers, toggles) expose role, name, state (`aria-expanded`, `aria-selected`, `aria-checked`, `aria-current`) | snapshot |
| 4.1.3 Status messages | toasts, cart updates, "Added to cart", subscription and return status changes (portal `SubscriptionActions`, `ReturnActions`), filter result counts, "No match" use `role="status"` or `role="alert"` as fitting | `evaluate_script` finds live regions; trigger and read |

Helper snippets (run with `evaluate_script`):

```js
// R-overflow: horizontal overflow and the elements that cause it
() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth,
  offenders: [...document.querySelectorAll('body *')]
    .filter(e => e.getBoundingClientRect().right > innerWidth + 1)
    .slice(0, 15).map(e => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '')) })
```

```js
// R-targets: interactive elements smaller than 24x24 (inline links in text are ignored by hand)
() => [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=switch],[tabindex]:not([tabindex="-1"])')]
  .filter(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && (r.width < 24 || r.height < 24); })
  .map(e => ({ tag: e.tagName, text: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }))
```

```js
// 1.4.12 text spacing: inject once, then screenshot
() => { const s = document.createElement('style'); s.id = 'ts';
  s.textContent = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}';
  document.head.append(s); return 'ok'; }
```

```js
// 2.4.11 focus not obscured: after each Tab, is the focused element covered by a fixed or sticky element?
() => { const a = document.activeElement; if (!a) return null; const r = a.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const top = document.elementFromPoint(cx, cy);
  return { focused: a.tagName + ' ' + (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 30),
    inViewport: r.bottom > 0 && r.top < innerHeight, coveredBy: top && !a.contains(top) && !top.contains(a) ? top.tagName + '.' + String(top.className).split(' ')[0] : null,
    outline: getComputedStyle(a).outlineStyle + ' ' + getComputedStyle(a).outlineWidth } }
```

### Keyboard recipes (step lists; Claude runs them with `press_key` and the focus snippet after each step)

Record, per recipe, the stop sequence and any trap or lost focus in `report.md`.

Storefront: (K1) skip link then header, store picker (open with Enter, focus moves inside, Escape closes and focus returns to the button), vehicle finder (combobox: arrows, Enter selects, Escape closes, errors read), mobile menu at 375 (open, trap, Escape, focus return); (K2) listing: filter controls, fit toggle, sort, pagination, product cards as one link each; filter sheet at 375; (K3) product: gallery, fit banner, add to cart, quantity stepper, reviews form; (K4) cart: steppers, remove, promo field with status, proceed; (K5) checkout: complete the whole flow with keyboard only through the hosted commercetools Checkout widget (focus enters the iframe on step change, can leave it with Tab/Shift+Tab, no trap; Stripe element labels read; own pages around it are fully checked), with an error on purpose; (K5b) store picker: Leaflet map is not the only way (list with the same stores is reachable first), map keyboard focus can be left, markers have names, attribution link is reachable, visible focus on map controls; (K6) account: menu (select at 375), return request, garage add; (K7) cookie or impersonation banners do not trap.

Portal: (K8) skip link, top bar, search field, Cmd/Ctrl+K palette (arrows, Enter, Escape, focus return), switcher, bell panel, Copilot panel (Confirm and Cancel reachable, Escape), theme toggle; (K9) sidebar: arrow keys not required, Tab through groups; at under 1024 px icon rail items have accessible names; at under 700 px drawer traps and releases; (K10) tables: sort headers are buttons, row actions reachable, tabs use arrow keys; (K11) subscriptions: tabs, pause, resume and cancel dialogs with confirmation; (K12) returns: record dialog, transition actions, refund dialog with amount and a required reject reason; branch editor: Leaflet map plus address fields, keyboard operable alternative; (K13) forms with dialogs: record a return, tailoring form with image upload and required alt text, import mapping selects; (K14) Contentools tabs: reach the tab strip, enter and leave each editor with keyboard (third-party content is checked for traps only; defects inside it are logged, not fixed here).

### Responsive checks

For every page in the inventory at each of 375, 768, 1024, 1440 (use `resize_page`; reload after resizing): no horizontal overflow (R-overflow), no overlapping or clipped text, targets (R-targets), images keep ratio and do not distort, sticky elements do not hide content or focus, tables either reflow to cards or scroll inside a labelled, focusable region, dialogs fit the viewport and scroll inside. Specific expectations from the specs: portal shell icon rail under 1024 px (84 px wide) and drawer under 700 px; storefront account menu becomes a select under 700 px; storefront listing grid column counts change per width and the filter becomes a sheet on phones; checkout summary stacks under the form on phones; the store picker (with its Leaflet map, which must not trap touch scrolling: page scroll remains possible around it) and vehicle finder are full-width sheets on phones; German text (about 30 percent longer) does not truncate buttons: run the key pages in `de-DE` (default) and `en-US`.

### Performance

Procedure per page and profile: reset to an empty cache (`navigate_page` with a fresh `new_page`), `emulate` the profile, `performance_start_trace` with reload and auto stop, read LCP, CLS, TBT and insights (`performance_analyze_insight` for LCP breakdown and render blocking), run the interactions for INP (open vehicle finder, apply a filter, add to cart; portal: sort a table, open the palette, open a dialog), `list_network_requests` for bytes and the host check (D6), then three runs and use the median. Product Search call count: `lib/ct/metrics.ts` debug counter (dev only, compiled out in production, created in this task: increments in `lib/ct/search.ts`, exposes `GET /api/dev/metrics` that exists only when `NODE_ENV !== 'production'`; run this one check on `next dev` with a note that only the **count** is taken from dev).

| Page | Profile | LCP | CLS | INP | TBT | JS (compressed) | Total bytes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Storefront home, listing, product, cart | mobile | <= 2.5 s | <= 0.1 | <= 200 ms | <= 200 ms | <= 220 KB | home 1.5 MB, listing and product 1.2 MB |
| Storefront checkout (hosted Checkout widget and Stripe element load third-party scripts: measure and document them separately, budgets apply to own bundles), account, confirmation | mobile | <= 3.0 s | <= 0.1 | <= 200 ms | <= 300 ms | <= 260 KB | <= 1.0 MB |
| Portal dashboard and list pages | desktop | <= 2.5 s | <= 0.1 | <= 200 ms | <= 200 ms | <= 350 KB | <= 1.2 MB |
| Portal editor routes | desktop | <= 4.0 s | <= 0.1 | <= 300 ms | <= 400 ms | actual, <= 1.5 MB | documented |

Leaflet and its OpenStreetMap tiles load only on the pages that show a map (store picker overlay, portal branch editor), via `next/dynamic`; the map is not part of the home, listing, product or cart JS budget. Also verify: fonts (at most 3 families, `font-display: swap`, preloaded woff2 for the one used above the fold, no layout shift when the theme font loads: the theme font allow-list from H); images use `next/image` with correct `sizes`, the LCP image has `priority` and no lazy loading, other images lazy with width and height; no per-visitor commercetools-bound call on public pages other than the documented client hooks; theme `<style id="store-theme">` is in the first HTML (no flash); `Cache-Control` and revalidation values documented in the report; TTFB per D5.

### Contrast report (script)

Create `scripts/contrast-report.mjs` in both apps: reads `app/tokens.css`, a pair list `scripts/contrast-pairs.json` (`{ fg: '--color-text', bg: '--color-surface', size: 'normal'|'large'|'ui', where: 'light'|'dark'|'default' }[]`), resolves each token (including `var()` chains and `data-theme="dark"` overrides for the admin kit) and prints ratio and pass or fail against 4.5, 3 and 3. Pairs: every text-on-surface pair the components use (body on page, muted on page, muted on card, on action, on topbar, link, error, success, warning, critical chips, placeholder, disabled, focus ring on surface, input border on surface, hero overlay text over `--overlay`). Run it for the default theme and, for information only, the two seeded reseller themes (resolve their values from the theme adapter). Failing pairs in the default theme are fixed by changing **usage** first (use a stronger token) and a token change only with a line in `plans/QUESTIONS.md`.

### Reduced motion

Check `scripts/check-reduced-motion.mjs` (create): every `transition`, `animation` and smooth scroll in `app/**/*.css` and component classes is covered by one global `@media (prefers-reduced-motion: reduce)` rule (animation and transition durations near zero, `scroll-behavior: auto`), and no auto-playing carousel exists without a pause control. If the `emulate` tool exposes a reduced-motion option use it; otherwise assert the rule by `evaluate_script` over `document.styleSheets`.

## Tasks

Write a failing test first whenever a defect can be tested (component test with `jest-axe`, a role/label assertion, a token-pair test); otherwise record the defect and the manual evidence.

- [ ] **Y-00** Page inventory `plans/evidence/Y/pages.md` (both apps, URLs, personas, states) and sign-in helper notes (personas from `seed/README.md`).
- [ ] **Y-01** Automated pass: `lighthouse_audit` (accessibility, best practices, SEO for the storefront; accessibility and best practices for the portal) for every inventory page at 375 (mobile) and 1440 (desktop). Save one JSON per page to `plans/evidence/Y/lighthouse/<app>-<page>-<viewport>.json`. Every failing audit becomes an issue row. Add a `jest-axe` assertion to any component test that lacks one (`npm run check` has `check-a11y-tests.mjs`: create it, it lists components under `components/` without a test that calls `axe`).
- [ ] **Y-02** Manual structure pass with `take_snapshot` for every page: headings, landmarks, labels, names, language, titles, live regions, tables; fix defects.
- [ ] **Y-03** Keyboard pass: run K1 to K14, fix traps, missing focus return, focus order, missing visible focus, and any control not reachable.
- [ ] **Y-04** Contrast: `scripts/contrast-report.mjs` plus `color-contrast` audits in light and dark; fix by usage; note token requests.
- [ ] **Y-05** Responsive pass at 375, 768, 1024, 1440 plus 320 reflow, 200 percent text, text spacing, landscape; fix overflow, target size, sticky overlap (2.4.11), clipped German text.
- [ ] **Y-06** Status and errors: trigger every error and status message listed in 3.3.x and 4.1.3, confirm announcements and text association; fix.
- [ ] **Y-07** Performance: measure per the table, fix (images, fonts, JS splitting with `next/dynamic` for the editors and the vehicle finder overlay, caching with `unstable_cache` for rarely changing reads, removing client-side fetches that belong on the server, avoiding layout shift from late theme or fonts), re-measure; record before and after. [SKILL: commercetools-storefront] (`core/performance.md`: parallel fetching, TTL cache, client-cache hydration, no N+1) [SKILL: commercetools-platform] (search call counts)
- [ ] **Y-08** Network audit: on every storefront page and portal page assert no request to a commercetools host and no browser request to a Contentools service host other than the same-origin proxy; save `plans/evidence/Y/network-audit.md`.
- [ ] **Y-09** Re-run the full sweep after fixes (Y-01 to Y-08) on the final build; write `plans/evidence/Y/report.md`: every page, every issue, status (fixed, accepted with reason, third-party), fix file path, test name, before and after numbers.
- [ ] **Y-10** Add the manual rows below to `plans/TODO-MANUAL-TESTING.md` (the coordinator merges; mark tasks that wait as `BLOCKED-ON-OWNER` and move on).

## Tests (named, in the app that owns the component; none are placeholders)

| Test (name) | File | Asserts |
| --- | --- | --- |
| `a11y: <Component>` per component | `components/**/<Component>.test.tsx` | `expect(await axe(container)).toHaveNoViolations()` in each visual state (default, error, disabled, open) |
| `skip link first` | `app/[locale]/layout.test.tsx` (both apps) | first focusable element is the skip link and targets `main` |
| `lang attribute follows locale` | same | `lang="de-DE"` and `lang="en-US"` |
| `dialog focus trap and return` | `components/ui/Dialog.test.tsx`, `Drawer.test.tsx` | focus moves in, Tab cycles, Escape closes, focus returns to the trigger |
| `combobox pattern` | `components/vehicle/VehicleFinder.test.tsx`, `components/portal/CommandPalette.test.tsx` | roles `combobox`, `listbox`, `option`, `aria-activedescendant`, Escape |
| `status chips have text` | `components/ui/Chip.test.tsx` | no chip renders without text; tone is never the only cue |
| `disabled reason is text` | `portal/components/returns/ReturnActions.test.tsx` (created by V-13) and `components/ui/DisabledAction.test.tsx` | reason in the DOM and linked by `aria-describedby` |
| `forms announce errors` | `components/checkout/AddressForm.test.tsx`, `components/ui/Field.test.tsx` | `aria-invalid`, `aria-describedby` to the error, focus to the first error |
| `live regions` | `components/ui/Toast.test.tsx`, `portal/components/subscriptions/SubscriptionActions.test.tsx` (created by V-08), `components/cart/CartSummary.test.tsx` | `role="status"` or `alert` present and updated |
| `autocomplete attributes` | `components/auth/*.test.tsx`, `components/checkout/AddressForm.test.tsx` | tokens per 1.3.5 |
| `contrast pairs` | `scripts/contrast-report.test.mjs` | every pair in `contrast-pairs.json` meets its threshold in the default theme (light and dark for the portal) |
| `reduced motion rule exists` | `scripts/check-reduced-motion.test.mjs` | the global rule exists and no animation is outside it |
| `tokens only` | existing `check-tokens` | no raw colour, px or font in any file touched by Y |
| `sidebar breakpoints` | `components/layout/Sidebar.test.tsx` (portal) | at 1023 px icon rail 84 px with accessible names; at 699 px drawer; at 1024 px full rail |
| `table has caption and scope` | `components/ui/Table.test.tsx` | caption present, `th scope` set, sortable headers are buttons with `aria-sort` |
| `images have alt and size` | `components/product/ProductImage.test.tsx` | `alt` non-empty for products (tailored images use their stored alt), `sizes` set, width and height set, only the LCP image has `priority` |
| `map has text alternative` | `components/store/StoreMap.test.tsx` (storefront), `components/store/BranchMap.test.tsx` (portal) | list or fields render with the same data as the map; markers have `alt`/`title`; attribution text present; map container has an accessible name |
| `tailoring image alt required` | `components/catalog/TailoringImageField.test.tsx` (portal) | saving an image without alt is refused with an associated error |

### Role matrix for Y

Accessibility and responsive checks run for **each** persona on the portal (Admin, Buyer; the Approver role is dropped with the out-of-scope wholesale specs) because navigation, disabled actions and empty states differ by role; expectations: Buyer navigation shows only its items and every disabled action shows its reason; a role with an empty section shows the empty state with text and a heading; no persona sees a heading level gap.

## Browser recipe (Chrome DevTools MCP; Claude runs it)

For each page of the inventory, in this order (save screenshots to `plans/evidence/Y/<app>-<page>-<viewport>.png`, naming the state):

1. `resize_page` 1440x900 (and later 1024x768, 768x1024, 375x812, 320x700). `navigate_page` to the URL, `wait_for` a known text, `list_console_messages` (must have no errors or warnings from the app), `take_snapshot` (structure checks), `take_screenshot`.
2. Run R-overflow and R-targets with `evaluate_script`; record offenders.
3. Run the keyboard recipe for the page: `press_key` Tab repeatedly (up to the page's stop count), after each stop run the focus snippet; Escape in dialogs; Enter and Space on controls.
4. `lighthouse_audit` (device mobile at 375, desktop at 1440).
5. Inject the 1.4.12 style, screenshot; set `font-size: 200%`, screenshot; reload to clear.
6. Performance pages only: `emulate` the profile, `performance_start_trace` (reload, auto stop), `performance_analyze_insight` for the LCP and layout shift insights, `list_network_requests` totals, three runs.
7. Portal dark mode: click the moon button (or set `data-theme="dark"` through the app control) and repeat steps 1, 2, 4 and the contrast report.
8. Portal personas: repeat 1 to 3 for `buyerA` on the pages it can reach.

## MCP read-back checks (`b2b2c-automotive` MCP)

Y changes no commercetools data. The MCP is used only to make sure the pages have realistic data to measure: `read_product_search`/`read_products` (listing has at least 24 assigned products for pagination), `read_customers` (customers list has more than 50 rows for the pagination check: if not, Claude creates `TST-Y-` customers through the MCP create tools and lists them in `plans/evidence/Y/test-data.md`), `read_stores` (two stores with the two seeded themes), `read_customers` (account pages), `read_recurring_orders`, `read_reviews`. After the sweep, `read_orders`/`read_carts` show no new unexpected records except the listed `TST-Y-` ones.

## Manual items (rows for `plans/TODO-MANUAL-TESTING.md`; never wait silently)

| ID | Type | What the owner does | Blocks |
| --- | --- | --- | --- |
| SO-01 (existing) | sign-off | Sign off the screens built without a design (mobile nav, mini-cart, filter sheet, account area, error and empty states, portal mobile layout, editor chrome) | Y-05 sign-off, not the measurements |
| M-Y-01 | owner (screen reader) | With VoiceOver on Safari (or NVDA on Windows) walk: storefront checkout, vehicle finder, store picker; portal returns, customers, subscriptions; note anything unclear; Claude cannot run a real screen reader | closing Y |
| M-Y-02 | owner (real devices) | Open the storefront and the portal on a real phone (375 to 430 px wide) and a tablet; confirm touch targets, sticky bars, keyboard overlap, rotation | closing Y |
| M-Y-03 | owner review | Compare the built pages with `design/export/Reseller Storefront.dc.html` and `Malva Seller Portal.dc.html` at 375 and 1440 using `plans/evidence/Y/` screenshots; list deviations | closing Y visually |
| M-Y-04 | owner decision | Look at the two seeded reseller themes and say whether they are legible; reseller themes are not contrast-checked by decision (Q-Y01) | none |

## Definition of done

1. Tasks Y-00 to Y-10 ticked; all named tests pass; `npm run check` and `npm run build` green in both apps.
2. No serious or critical accessibility issue remains on any inventory page in either theme or persona; every Lighthouse accessibility audit failure is fixed or documented as third-party (Contentools editors only).
3. No horizontal overflow at 320 px (outside labelled table scroll regions), no target below 24x24 (outside inline links), no focus obscured, at every viewport.
4. Budgets in D5 met or an exception with a reason is written in `report.md` and `plans/QUESTIONS.md`.
5. `plans/evidence/Y/report.md` complete with before and after numbers and screen reader / device items listed as owner rows.

## Evidence (all under `plans/evidence/Y/`)

`pages.md`, `lighthouse/*.json`, screenshots `<app>-<page>-<viewport>[-state].png`, `keyboard-<recipe>.md` (stop sequences), `contrast-report.txt`, `network-audit.md`, `perf-<page>-<profile>.md` (three runs and median, before and after), `test-data.md`, `report.md`.

## Progress

- storefront Y (J27, 2026-10-12): done offline and in a headless Chrome over CDP against a production build copy (fake commercetools and fake Contentools, `next start` on 3180). Evidence in `plans/evidence/Y/storefront-*` (report: `storefront-report.md`).
- storefront Y: page-level jest-axe suite `test/a11y/*.a11y.test.tsx` (harness `test/a11y.tsx`: real shell, whole-document axe, label-in-name check) for home, listing, category, search, product (fits, does not fit, bundle, out of stock, reviews, subscribe), cart (empty, items, subscription, promo, misfit, stock), checkout (widget, error, pickup), confirmation, all account pages, sign-in, register, forgot and reset, not-found, error boundary and the impersonation banner, in de-DE and en-US, default theme and a themed store; keyboard tests K1 to K4, K6.
- storefront Y: fixed in components (tokens only): AA layer `app/aa-layer.css`, input border role, label-in-name (de-DE related add button, en-US set-active, filter count button), target sizes (links in rows, consent and return checkboxes no longer shrink), header store name on its own row at phone width, hero grid at 320 px, page titles for the 404 and every account page, skeleton height against footer layout shift (CLS 0.118 to 0), reduced-motion global rule and `motion-safe:` on every pulse, Inter font no longer preloaded.
- storefront Y: gates: `scripts/contrast-report.mjs` (in `npm run check`), `scripts/check-reduced-motion.mjs` (in `npm run check`), `scripts/bundle-report.mjs` (in `npm run verify:build`). Budgets: all routes within, home with the Puck renderer is a documented exception (Q-Y12).
- storefront Y: open: Lighthouse JSON and live numbers (M-Y-33), screen reader and devices (M-Y-31, M-Y-32), AA layer sign-off (M-Y-34), footer legal links 404 (MISSED-FEATURES).
- portal Y (J26, 2026-10-12): Y-00 `plans/evidence/Y/portal-pages.md`; sign-in for runs through the fixture users (`adminA`, `buyerA`), headless Chrome over the DevTools protocol (no Chrome MCP) against `next dev --webpack` in a scratchpad copy, scripts outside the repo.
- portal Y: Y-01/Y-02 axe-core over every portal route x 2 personas x 2 locales x 2 themes: before 216 page runs / 1237 violating nodes (contrast 844, label-in-name 336, heading order 32, scrollable region 16, target size 9), after 232 runs / 0 (`portal-axe-before.json`, `portal-axe-after.json`); Lighthouse accessibility 100 on all 58 reports (`lighthouse/portal-*.json`, best practices 92 to 100, remainder third party or dev artefact).
- portal Y: Y-03 keyboard (K8, K9, K12, K14) in a real browser and in tests: palette trap, Copilot focus and return, dialog and drawer trap and return, tab strips with arrow keys, account disclosure, Contentools chrome without trap (`portal-keyboard.md`); Y-04 `scripts/contrast-report.mjs` + `scripts/contrast-pairs.json` (75 pair checks, 0 failing, 10 listed exceptions) and an AA text layer in `app/globals.css` (Q-Y03); Y-05 reflow 320 to 1440, 200 percent text, text spacing: no overflow, no target under 24 px; Y-06 alt text required for tailored images, table captions and scopes, page titles per route.
- portal Y: Y-07 `scripts/bundle-report.mjs` (in `verify:build`): first-load JS 155 to 208 KB gzip per route, editors 529 to 533 KB, budgets 350 KB and 1.5 MB; `scripts/check-reduced-motion.mjs` in `check`; images lazy with sizes, one font family; Y-08 `portal-network-audit.md` (no commercetools host, OSM tiles on the map page only, `rsms.me` from the Contentools managers refused by the CSP); report `plans/evidence/Y/portal-report.md`.
- portal Y: open: portal LCP, CLS and INP need a live signed-in production build (M-Y-23); screen reader and devices (M-Y-21, M-Y-22); AA layer decision (M-Y-24, Q-Y03); Contentools editors with the real token (M-Y-25); questions Q-Y03 to Q-Y07 in `plans/notes/questions-VWXYZ.md`; missed items in `plans/MISSED-FEATURES.md`.

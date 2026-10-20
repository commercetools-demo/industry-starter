<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream Q: Quality and release

Read `plans/JUNIOR-GUIDE.md` first. Q builds almost nothing new: it **verifies everything**, fixes small defects it finds, and prepares the release. Companion files: `plans/E2E-JOURNEYS.md` (the journey scripts J0 to J15) and `plans/RELEASE-CHECKLIST.md` (the gate list). Dev URL assumed `http://localhost:3000`; all runs use a release build (`cd storefront && npm run build && npm run start`).

## 1. Header

| Field | Value |
| --- | --- |
| ID | Q |
| Name | Quality and release: responsive pass, accessibility pass, end-to-end journeys, security review, performance, deploy gate, plan verification |
| Depends on | A to P (all `Done` or `Ready for review` in `STATUS.md`) |
| Wave | 11 (last) |
| Specs implemented | None new. Q **verifies every owned spec and every applicable generated template** (section 5 lists all 50 with their scenario counts). Primary evidence specs: `bootstrap-and-structure`, `server-architecture-and-data-flow`, `design-tokens-and-components`, `design-storefront-shell`, which contain the cross-cutting requirements Q checks end to end. |
| Generated templates | All applicable templates are verified through the journeys; the four marked not applicable by D-022 (`delivery-slot-booking`, `out-of-stock-substitutions`, `weight-based-pricing`, `account-registration-request`) are only checked for a recorded reason in `SPEC-COVERAGE.md`. |
| Owner prerequisites | OA-01 (live project), OA-02 (recurring scope), OA-04 (hosted Checkout and test card), OA-05 (hosting, for the deploy gate and the post-deploy smoke), OA-06 (commercetools MCP, optional), OA-P1 (contact receiver, for the real-receiver check), OA-N-Q1 (production secrets and keys, for the deploy gate), M-E-02 (accessibility token values, existing), SO-Q2 (demo accounts), plus **every other OA, SO and M row in `TODO-MANUAL-TESTING.md`** (gate: no row without status `DONE`, `PASS` or `WAIVED`). The lead numbers the `-Q` placeholders. |
| Skills | `commercetools-storefront` (stack `nextjs`, `best-practices/*`, `core/performance.md`), `commercetools-platform`; deploy commands `/commercetools:nextjs-deploy-vercel` and `/commercetools:nextjs-deploy-netlify`; the `security-review` skill may be run as a second pair of eyes on the final diff |

## 2. Goal and scope

**Goal.** At the end of Q the storefront can be deployed with confidence: it builds from a clean clone; every scenario of every applicable spec has a passing test or recorded evidence; the whole shopper experience works in three markets on desktop and phone; the app meets WCAG 2.2 AA on the pages tested; the BFF boundary and the secrets are intact; budgets are met; the data in the commercetools project is exactly what `SEED-PLAN.md` says; and `RELEASE-CHECKLIST.md` is honest.

**In scope**: the checks of section 3, the small fixes they trigger, the scripts of section 3 (D9 to D11), the plan verifier extension, the deploy gate script, the reports under `plans/evidence/Q/`, and the post-deploy smoke after the owner deploys.

**Fix rule.** Q may fix a defect it finds when the fix is under half a day and touches one area: commit `ws-q: fix <area>` with a test that failed first, and one entry in `plans/evidence/Q/fixes.md` (`| id | journey or check | symptom | owning workstream | commit |`). A defect that needs more goes back to the owning workstream through the lead; Q keeps the check open (`blocked: <workstream>`).

**Out of scope**: new features, redesigns, copy changes (rows for the owner), changing a decision in `DECISIONS.md`, production monitoring, load testing, penetration testing by a third party, real-card payments.

## 3. Design

### D1. Environments and rules for every run

| Item | Rule |
| --- | --- |
| Build | `npm run build && npm run start` (production). `npm run dev` only for steps that need a second server with a broken upstream |
| Ports | Main `3000`; the "broken commerce" server `3002` with its own untracked env file |
| Data | The live seeded project of OA-01 only (`EXPECTED_PROJECT_KEY` guard); creating and deleting data only through seed scripts; journeys create test data listed in `plans/evidence/Q/test-data.md` |
| Secrets | Never printed, never in evidence. Scripts read values from `.env.local` and print only `present` or `absent` and lengths |
| Browser | Chrome DevTools MCP; second shopper in an isolated context; each check records tool, URL, viewport, result |
| Evidence | `plans/evidence/Q/` with `README.md` stating what each file proves; sub folders `responsive/`, `a11y/`, `deployed/` |

### D2. Verification ledger (spec by spec)

Section 5 is the ledger: for each spec its scenario count (from the `#### Scenario` headings on disk on 2026-10-19), its primary workstream (`SPEC-COVERAGE.md`), and where Q proves it end to end. Two layers:

1. **Test ledger** (Q-01): `node plans/verify-plan.mjs --scenarios --tests` (D11) proves every scenario has a ticked checkbox in its primary workstream file and that each named test exists and passed.
2. **Behaviour proof**: the journeys (J-ids), sweeps and checks named in the last column. A scenario is `Done` only with both layers, or a recorded reason why the browser proof does not apply (for example the scenario is a unit-level guard).

### D3. Responsive pass (Q-05, Q-06)

**Widths**: 1440, 1080, 900, 820, 700, 520 (the breakpoints of `design-tokens-and-components`) and 375 (phone). Height 900 (812 at 375). Use `resize_page`; for phone behaviour also `emulate` a mobile device (touch, device pixel ratio).

**Pages** (resolve routes once in Q-00 into `plans/evidence/Q/routes.md`): home; listing (pods, with filters applied and the mobile filter sheet); search results (with results and empty); product pages of four shapes (pod, coffee, machine, accessory) including out-of-stock at store; cart (mixed bag, empty, with nudge); cart drawer; checkout (every step); confirmation (collect, ship, subscribe); account (every tab, including Subscriptions with several cards); sign-in, register, forgot password; About, Contact, FAQ, a policy, Journal list and article; 404 and 500; store picker modal; locale chooser; mega menu (at least 820 px) and mobile navigation (under 820 px). Each page in each of `en-US`, and spot checks in `de-DE` (long words) and `en-GB`.

**Expected behaviour at each breakpoint** (from the specs; any difference is a defect or a question):

| Width | Required |
| --- | --- |
| above 1080 | Four-column product grids, footer in five columns (brand plus four), product page two columns 1.05fr / 0.95fr |
| 1080 | Product grids and footer in three columns |
| 900 | Product detail, cart and account grids in one column (thumbnails move below the main image, summary follows the lines, tabs become a horizontal scroller); hero image column hidden |
| 820 | Mobile navigation (slide-in panel, 24 px Archivo links), two-column product grid, 20 px side padding, store pill text hidden, filters as full-height sheet, section titles 27 px |
| 700 | Three-column grids become two |
| 520 | Smaller wordmark (about 21 px) |
| 375 | Everything still reachable, buttons at least 44 px high where the page is touch-first (add to bag, checkout, dialog buttons) |

**Automated assertions** (run with `evaluate_script` at each width on each page; save the JSON result in `plans/evidence/Q/responsive/<page>-<width>.json`):

```js
() => {
  const w = window.innerWidth;
  const overflowPx = document.documentElement.scrollWidth - w;
  const offenders = [...document.querySelectorAll('body *')]
    .filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return r.width > 0 && r.right > w + 1 && cs.position !== 'fixed' && !e.closest('[data-allow-scroll]'); })
    .slice(0, 8).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`);
  const smallTargets = [...document.querySelectorAll('a[href],button,input,select,textarea,[role=button]')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24); })
    .slice(0, 8).map((e) => `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}"`);
  const fixedBar = document.querySelector('header');
  return { w, overflowPx, offenders, smallTargets, headerHeight: fixedBar ? Math.round(fixedBar.getBoundingClientRect().height) : null,
    grid: (document.querySelector('.grid-4, [data-grid="products"]') ? getComputedStyle(document.querySelector('.grid-4, [data-grid="products"]')).gridTemplateColumns.split(' ').length : null),
    padding: getComputedStyle(document.querySelector('main') ?? document.body).paddingLeft };
}
```

Pass rules: `overflowPx <= 0` and `offenders` empty (horizontal scrollers marked `data-allow-scroll`, such as the account tab strip, are allowed); `smallTargets` empty (WCAG 2.5.8 minimum 24 px; the token spec's 38 px stepper targets are below the 44 px guideline, record them in `fixes.md` as a question rather than a failure, Q-Q-4); `grid` equals the expected columns for the width.

A screenshot per page at 1440, 900 and 375 is saved; at 1080, 820, 700 and 520 a screenshot only where the assertion fails or the layout changes (list them). German pages are checked for truncated or overlapping text at 375.

### D4. Accessibility pass (Q-07, Q-08)

**D4.1 Contrast (computed 2026-10-19 from the token values of the spec; E's `test/contrast.ts` recomputes them after any value change).**

| Pair | Ratio | AA text 4.5 (large 3.0) |
| --- | --- | --- |
| `--ink` on `--canvas` | 16.1 | pass |
| `--ink-2` on `--canvas` / `--canvas-2` | 6.9 / 6.4 | pass |
| `--ink-3` on `--surface` / `--canvas` / `--canvas-2` | 4.33 / 4.12 / 3.81 | **fail** for body and meta text |
| `--accent` on `--canvas` / `--surface` | 4.54 / 4.77 | pass (barely); white text on `--accent` 4.77 pass |
| `--accent` on `--ink` | 3.55 | **fail** for small text (use `--teal` or `--canvas` on ink) |
| `--teal` on `--canvas` | 2.17 | **fail** for text; fine as dot, icon or fill; `--teal` on `--ink` 7.43 pass |
| `--ct-danger` on `--surface` / `--canvas` | 3.91 / 3.7 | **fail** for error text (large 3.0 passes) |
| `--ct-amber-500` on `--surface` | 1.83 | **fail** for text; dot only |

Findings the specs themselves cause: availability text "In stock at {store} (teal)" and "Low stock (amber)" (`design-product-card`), error text in `--ct-danger`, meta text in `--ink-3`.
Decision (already taken by workstream E, Q-E-1 and owner row M-E-02; Q does not decide it again): keep every token **name**, change the `--ink-3` value to `#6E6B67`, add `--teal-text` (`#08746F`) and `--danger-text` (`#C62F35`), never use teal or amber for small text, never use `--accent` text on `--ink`. E's `test/contrast.ts` and `app/tokens.test.ts` check the token pairs. **Q's job is to prove that the rendered pages actually use them**: the runtime audit below catches a component that still paints small text in teal, amber, danger or the old muted colour. If the owner answers "keep the VELA values" on M-E-02, the failures become a documented, accepted exception list in `a11y/known-issues.md`.

Runtime contrast audit (no app code; save as `plans/evidence/Q/a11y/contrast-audit.js.txt`, run with `evaluate_script` on every page of the page list at 1440 and 375, results to `a11y/contrast.md`):

```js
() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return 'image'; const c = parse(cs.backgroundColor); if (c && c.a > 0.95) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const out = []; const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim(); const el = n.parentElement;
    if (!t || !el || el.closest('script,style,noscript') || getComputedStyle(el).visibility === 'hidden') continue;
    const cs = getComputedStyle(el); const fg = parse(cs.color); const bg = bgOf(el);
    if (!fg || bg === 'image') { if (bg === 'image') out.push({ text: t.slice(0, 24), note: 'background image: check by eye' }); continue; }
    const size = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold); const min = large ? 3 : 4.5; const r = ratio(fg, bg);
    const key = cs.color + '|' + JSON.stringify(bg); if (r < min && !seen.has(key + t)) { seen.add(key + t); out.push({ text: t.slice(0, 24), color: cs.color, ratio: +r.toFixed(2), min, size }); }
  }
  return out.slice(0, 40);
}
```

Every item returned is fixed (use the right token) or listed with the reason. Text over images (tile labels, hero glass card) is checked by eye on a dark and a light photo and recorded.

**D4.2 Checklist** (each item has a check method; results in `plans/evidence/Q/a11y/checklist.md`):

| Area | Check |
| --- | --- |
| Landmarks | One `header`, `nav` (labelled), one `main`, `footer` per page; skip link first in tab order (F adds "Skip to content"; Q verifies it works and lands on `main`); `lang` of `<html>` equals the locale (`en-US`, `de-DE`, `en-GB`); fallback-language blocks have `lang="en"` |
| Headings | Exactly one `h1`; no skipped levels (`evaluate_script` listing `h1..h6`) |
| Names | Every icon-only control has `aria-label`; decorative icons `aria-hidden`; every input has a visible `<label>`; every image has `alt` (decorative `alt=""`); links have text that makes sense out of context |
| Forms | Errors identified in text and linked with `aria-describedby`, `aria-invalid`; first invalid field focused; required fields marked in text; checkout fields have `autocomplete` tokens (`given-name`, `family-name`, `street-address`, `postal-code`, `email`, `tel`) |
| Focus | Visible ring on every interactive element (the 3 px accent ring at 14% is subtle: measure that the focus indicator meets 3:1 against adjacent colours; if not, strengthen the token); focus order logical; focus **not hidden by the sticky 72 px header** (WCAG 2.4.11: `scroll-padding-top` at least 88 px on `html`); drawers, modals, store picker, mobile navigation and filter sheet trap focus, close on Escape, return focus to the opener, and set `aria-modal` or inert the page |
| Keyboard | Everything reachable and operable without a mouse: mega menu (opens on focus or Enter), option buttons, steppers, accordions, tabs, toggles (`role="switch"`), the cart chips, the FAQ `details` |
| Status messages | Toast (`role="status"`, does not take focus), cart badge changes announced via the toast, form success and error messages (`role="status"` or `role="alert"`) |
| Colour alone | Availability dots always have text; rating stars have a text value; selected options are not shown by colour only (fill plus check or aria-pressed); active tab has text weight or underline besides ink fill |
| Motion | Entrance animation (10 px translate) only under `prefers-reduced-motion: no-preference`; with `reduce` emulated all content is visible at once and no animation runs (check `getAnimations()` length is 0 after load) |
| Zoom and reflow | At 640 px wide (equals 200% of 1280) and 320 px wide (400%): no horizontal scroll, no clipped content; text spacing override (`line-height 1.5`, `letter-spacing 0.12em`, `word-spacing 0.16em`, `p spacing 2em` injected with `evaluate_script`) keeps all text visible |
| Target size | 24 px minimum everywhere; 44 px on touch-first controls (stepper 38 px: question Q-Q-4) |
| Images and media | No autoplay; hero images have real alt |
| Language | German pages: `lang="de"` on `html`; form validation messages translated |

**D4.3 Lighthouse through the MCP.** `lighthouse_audit({ pageId, device, mode: 'navigation', outputDirPath: 'plans/evidence/Q/a11y' })` returns accessibility, SEO, best practices and agentic-browsing results with failing audits and the DOM nodes they flag; it **excludes performance** (use traces, D7). Run for desktop and mobile on: home, listing, search, four product pages, cart, checkout (each step reachable without payment), confirmation, account Orders and Subscriptions, sign-in, About, Contact, FAQ, a policy, Journal list and article, 404. Targets: accessibility at least 95 (Q aims for 100 on static pages), SEO at least 95, best practices at least 95; every flagged audit is either fixed or listed with the reason in `a11y/known-issues.md`. Save the report paths in the README.

**D4.4 Manual.** One pass with VoiceOver (macOS, `M-Q-02`) over home, a product page, cart, checkout and the subscriptions tab; a keyboard-only checkout run.

### D5. End-to-end journeys (Q-09)

`plans/E2E-JOURNEYS.md` holds J0 to J15 as numbered scripts. Run protocol: release build, fresh isolated contexts, read-backs from the commercetools MCP or `seed verify`, test data register, cleanup plan. The journeys required by the brief map as: guest collects a pod box in each market = J1 (US, DE, GB); member buys machine plus capsules in one mixed bag = J2; subscribe = J3 (and manage = J4); review a product = J5; skip a subscription = J4; change market = J6; filters and sort = J7; out of stock at store = J8. J9 to J15 cover account, cart merge, orders and tracker, errors, content, isolation and payment failure.

Two helper scripts are created in `seed/` by Q-04 (seed package only, because they write): `npm run seed:advance-order -- --order <orderNumber> --to <preparing|ready-for-collection|collected> --confirm <projectKey>` (transitions the `mcf-order-*` states of an order that belongs to an `@example.com` customer; refuses any other order and any project key other than the configured one; `--dry-run`) and `npm run seed:cleanup-tests -- --register <test-data.md> [--apply --confirm <projectKey>]` (deletes only the customers, reviews, recurring orders and shopping lists named in the register; dry run by default; orders and carts are listed as "cannot be deleted").

### D6. Security review (Q-10 to Q-13)

Each row becomes a check with a method, an expected result and a place in `plans/evidence/Q/security.md`. A failing row is fixed under the fix rule or handed to its workstream.

| # | Area | Checks (method) | Expected |
| --- | --- | --- | --- |
| S1 | BFF boundary | `rg "@commercetools/" storefront --glob '!node_modules' --glob '!lib/ct/**' --glob '!lib/mappers/**'` lists nothing; `rg -l "'use client'" storefront/app storefront/components storefront/hooks storefront/context` piped to a grep for `lib/ct` and `server-only` finds no client file importing them; `rg "fetch\(" storefront --glob '!node_modules'` shows no call to a commercetools URL; lint rule test still fails for a planted violation; across all journeys `list_network_requests` shows requests only to the app's own origin and, for the hosted Checkout, only the Checkout origin documented by workstream K | Boundary intact |
| S2 | Secrets in git | `git ls-files \| rg "\\.env"` lists only `.env.example`; `git log --all -p -S"CTP_CLIENT_SECRET=" -- . ':!*.example'` (and the same for `SESSION_SECRET=`, `CONTACT_WEBHOOK_TOKEN=`) finds nothing with a value; `.gitignore` contains `.env*` except `.env.example` | None |
| S3 | Secrets in the client bundle | A built `storefront/scripts/check-bundle-secrets.mjs` (`checkBundleSecrets(root, env)`, run by `npm run verify:build`); it covers `CTP_CLIENT_SECRET`, `CTP_CLIENT_ID` and `SESSION_SECRET`. Q extends its list to every secret named in `.env.example` (`CONTACT_WEBHOOK_URL`, `CONTACT_WEBHOOK_TOKEN`, `FEEDBACK_WEBHOOK_URL`, the checkout secrets K added) and keeps the rule that it prints only the variable **name** and the file; it searches `.next/static` and the server HTML; `check-secrets.mjs` (A) already rejects `NEXT_PUBLIC_` on a secret name, Q re-runs it | `ok` everywhere |
| S4 | Cookie flags | After login (`get_network_request` on `POST /api/auth/login`): `Set-Cookie` of the session has `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000`, and on the release build served over HTTPS `Secure` (D sets `secure` when `NODE_ENV` is `production`; the skill's reference code omits it, so Q checks it on the real response of the cookie named `malva-session`); the market preference cookie has `SameSite=Lax` and is not HttpOnly only if the client needs it; no other cookie holds personal data; logout clears the session cookie (`Max-Age=0`); consider the `__Host-` prefix (question Q-Q-6) | Flags as listed |
| S5 | 401 matrix | Script `plans/evidence/Q/401-matrix.md` generated by a Node test (`storefront/scripts/api-matrix.test.ts`) that lists every `app/api/**/route.ts` and exported method; the table of expected auth per route (public or session) is checked in; the browser run calls every per-person route with no cookie: 401, body `{ "error": { "code": "unauthorized", ... } }` without detail, no data; public routes (`/api/channels`, `/api/availability`, `/api/search`, `/api/shipping-methods`, `/api/recurrence-policies`, `GET /api/reviews`, `/api/contact`, `/api/faq-feedback`) answer without a cookie and leak no per-person data; a new route without a table entry fails the test | Matrix complete |
| S6 | IDOR matrix | With two isolated shoppers (J14): for orders, order detail, addresses, payment methods, shopping lists and items, recurring orders, reviews (PATCH and DELETE), the cart by id and cart lines: B requests A's ids (and A's `cartId` in a hand-made request): 404 or 403, never A's data, never a 200 with A's content; `cartId` is never accepted from the client (only from the session) | All refused |
| S7 | CSRF and origin | Mutating handlers accept only `Content-Type: application/json` (`415` otherwise) and reject a request whose `Origin` header is present and differs from the app origin (`403 forbidden_origin`); simulate with `evaluate_script` a cross-origin `fetch` is blocked by the browser, and with a `curl` including a foreign `Origin` header and the session cookie: refused; the session cookie is `SameSite=Lax` | Refused |
| S8 | Open redirect | `next` parameter of sign-in, register, reset only accepts a path starting with a single `/` followed by a non-`/` and non-`\`; `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)` fall back to the account | Fallback |
| S9 | XSS | Reviews (title, text, author name), contact form fields, search box (`q` reflected on the results page), journal search, store search, gift note, address fields, discount code field, order notes: payloads `<img src=x onerror=window.__xss=1>`, `"><svg onload=window.__xss=1>`, `javascript:` links, `</script><script>window.__xss=1</script>`, 5000 characters, RTL text, emoji: after rendering `window.__xss` is undefined and no injected element exists; `rg "dangerouslySetInnerHTML" storefront` lists only JSON-LD scripts; **every JSON-LD script escapes `<`** (`JSON.stringify(data).replace(/</g, '\\u003c')`; product names and review text are editable outside the app, so product, review and article JSON-LD must be escaped: add a shared `safeJsonLd()` helper and a test that `</script>` in a product name does not break out); CSP (S12) is the second line | No execution |
| S10 | Rate limits | J created the shared limiter `lib/rate-limit.ts` (`rateLimit(key, { limit, windowMs })`, in-memory sliding window, shared with M). Q verifies it is applied to: login, register, password-reset request, review submit, discount code apply, contact (P), FAQ feedback (P), `POST /api/cart/lines` bursts (generous), with limits near login 10 per 10 minutes per client and per email hash, register 5 per hour, reset 5 per hour, review 10 per hour, code apply 20 per 10 minutes, `429 rate_limited` with `Retry-After`, keys hashed and never logged; any route on the list without the limiter gets it (small fix); the in-memory limit is per instance on serverless hosting: record it, and recommend the host's WAF or rate limit rule in `RELEASE-CHECKLIST.md` (Q-Q-7); commercetools has no sign-in lockout by default | 429 after the limit |
| S11 | Error shape and logging | Every route returns the stable error shape; force a 503 from commercetools (broken upstream server): the client sees `upstream_unavailable`, never a commercetools body or stack; `rg "console\\.(log|error)" storefront --glob '!node_modules' --glob '!scripts/**'` shows no logging of personal data, tokens, `message` bodies of the contact form or full request objects; server logs carry a correlation id | Clean |
| S12 | Headers | `next.config.ts` `headers()` adds on all routes: `Content-Security-Policy` (default-src self; script-src self with nonce or hashes as Next requires, plus the hosted Checkout origin; connect-src self and the Checkout API origin; img-src self data and https image hosts from the image config; frame-src the Checkout origin only; frame-ancestors none; base-uri self; form-action self), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera, microphone and geolocation (store search uses typed text, not geolocation; if G uses geolocation allow only `geolocation=(self)`), `X-Frame-Options: DENY`, `poweredByHeader: false`; HSTS is set by the host (check on the deployed URL); verify with `curl -I` and by loading every journey with the CSP in enforce mode and an empty console (CSP violations appear as console errors) | Headers present, no violations |
| S13 | Session | A tampered cookie is an empty session without an error; a new session token is issued on login (no fixation); logout clears; cart merge never moves a cart that belongs to another customer; `Max-Age` matches the JWT expiry; changing market resets `cartId` | As designed |
| S14 | Price and quantity integrity | Prices, totals, shipping and tax are computed by commercetools only; `POST /api/cart` ignores any client price field; quantity 0, negative, 1000000 and non-integer are rejected (`400`); `fulfilment` outside `collect|ship|subscribe` rejected; a collect line needs a store of the session market; discount codes apply only through the cart API | Rejected |
| S15 | Dependencies | `npm audit --omit=dev --audit-level=high` for `storefront` and `seed`; lockfile committed; version gates (`next` 16.x, `next-intl` 4.x) enforced by the check script | No high or critical, or accepted in writing |
| S16 | Payment data | `rg -i "card ?number|cvv|cvc|expiry" storefront --glob '!node_modules' --glob '!messages/**'` shows no card field; the browser journeys show no card data in the storefront origin's requests (`list_network_requests` filtered to the origin); the hosted Checkout handles card entry | No card data |
| S17 | Demo accounts | The seeded customers share a known password: listed in `RELEASE-CHECKLIST.md` row 12; the owner decides (SO-Q2) | Decision recorded |
| S18 | Health and debug routes | `app/api/health/route.ts` and D's `app/api/dev/session/route.ts` (planned for deletion in Q) absent in the release; no route under `app/**/dev*`, `test*` or `debug*`; `scripts/dev/*` not imported by the app | Absent |

### D7. Performance budgets and caching rules (Q-14)

Measure on the release build, desktop and mobile emulation. Lighthouse through the MCP **does not** report performance: use `performance_start_trace` (reload true, then `performance_stop_trace`) and `performance_analyze_insight` for the LCP and layout-shift insights; for mobile emulate with `emulate` (viewport 375x812, throttled CPU and network "Fast 4G" or the closest option the tool offers) and say which in `perf.md`.

| Metric (lab) | Budget | Pages |
| --- | --- | --- |
| LCP | at most 2.5 s mobile, 1.8 s desktop | home (hero image or headline), listing (first card image), product (main image) |
| CLS | at most 0.1 | all measured pages (images carry aspect ratios, fonts `swap`) |
| INP or TBT | at most 200 ms (INP via trace where available; otherwise total blocking time at most 200 ms) | listing filters, add to bag, cart quantity change |
| TTFB | at most 800 ms for dynamic pages on the host (local release build at most 400 ms) | home, listing, product |
| First Load JS per route (from `next build` output) | at most 200 kB for home, listing, product and cart; at most 250 kB for checkout and account | the five routes |
| Images | exactly one `priority` image per page; card images lazy; requested width at most 2x the displayed width; hero image at most 150 kB transferred | home, product |
| Requests | at most 40 requests on first load of home and listing; no request repeated twice within a page; cart and account data fetched once (SWR dedupes) | home, listing |
| Fonts | at most three families (Archivo, Roboto, Roboto Mono), `font-display: swap`, only used weights preloaded | all |
| Server round trips | Server Components run independent fetches in `Promise.all` (grep proves no sequential awaits of independent calls in the page files) | all pages |

Caching rules to verify (look at response headers with `get_network_request` and at code):

| Data | Rule | Check |
| --- | --- | --- |
| Category tree, channel list, shipping methods | `unstable_cache`, 60 s, tagged | one commercetools call per minute (server log), not per request |
| Project config (countries, currencies), recurrence policies | `unstable_cache`, 300 s | same |
| Products and prices | Not cached on the server (per market, promotions) | code review, no `unstable_cache` around product searches |
| Cart, account, orders, availability tied to a session, subscriptions, reviews of the shopper | Never cached on the server; SWR on the client with customer id or market in the key; response `Cache-Control: private, no-store` | header check on each |
| Public JSON routes (`/api/channels`, `/api/recurrence-policies`) | `public, s-maxage=60 or 300, stale-while-revalidate` | header check |
| HTML pages | A page that reads the session (home, product, cart) must not be `public` at an edge or CDN: `Cache-Control: private, no-cache` or no-store as Next sets for dynamic routes; verify on the deployed host that two shoppers get different HTML (`x-vercel-cache` or `cache-status` is `MISS` or `BYPASS`) | two-context test |
| Static assets | `public, max-age=31536000, immutable` | header check |

Findings that miss a budget are fixed (images, code splitting, removing a library, moving a client component to the server) or recorded with the owner's acceptance (M-Q-05).

### D8. Data sweep (Q-04)

With the commercetools MCP (OA-06) or `cd seed && npm run verify`, compare the live project with `SEED-PLAN.md` section by section and write `plans/evidence/Q/data-sweep.md` (one row per check: section, query, expected, observed, result, ids only): project settings (indexing `Activated`, country tax fallback); countries, currencies, languages; tax categories and rates per market; zones and shipping methods with rates and free-above tiers; custom types and order and review states; six stores with fields; product types; categories and slugs per language; roughly 40 products with names, descriptions and attributes in three locales, prices per variant per market, recurrence prices, inventory online and per store, two out-of-stock fixtures (record SKU and store for J8), three products with no reviews; discounts and codes; six demo customers; reviews and `reviewRatingStatistics`; image URLs clean (no `?` or `#`). Then run `npm run seed` a second time: it must print `0 change(s)`. Anything missing is added to the seed (workstreams B and C), not by hand.

### D9. Deploy gate (Q-15)

`storefront/scripts/predeploy-check.mjs` (spec "Health check": the deploy gate fails while `app/api/health/route.ts` exists; workstream A creates a first version, D extends it for `app/api/dev`, Q finishes it) wired as `npm run predeploy` and run by `npm run build` only when `RELEASE=1`. It exits 1 with a list on any failure and prints **names and lengths only**:

| Check | Rule |
| --- | --- |
| Health and dev routes | `app/api/health` and `app/api/dev` do not exist (A's and D's versions of the check already fail on them; Q deletes both folders after the journeys and extends the check to `debug` and `test` names); no route named `dev`, `debug` or `test` under `app/` |
| Env names present | Every name in `.env.example` that is marked required is present in the environment of the target (`process.env`, loaded from the host or a local `.env.production` for the dry run) |
| Secret rules | `SESSION_SECRET` length at least 32 and not a sample value; `EXPECTED_PROJECT_KEY` equals `CTP_PROJECT_KEY`; `CTP_CLIENT_SECRET` present; no `NEXT_PUBLIC_` variable matches secret naming |
| Scopes | `CTP_SCOPES` equals the scopes listed in the `.env.example` comment, contains `manage_recurring_orders` and `view_recurrence_policies`, and contains no `manage_project` or other admin scope |
| Versions | `next` is 16.x, `next-intl` at least 4, Node 22 (`.nvmrc`, `engines`), forbidden versions from the check script |
| Files | `.env*` files other than `.env.example` are not tracked; `scripts/dev/` is not referenced by `app/`, `lib/` or `components/` |
| Build output | `.next` exists from a build at the current commit; `check-bundle-secrets` passes (A's script); E's contrast tests pass |
| Switches | No debug flags set (`ATTACK_MODE`-style variables do not exist; if any dev-only variable exists in `.env.example` it must be unset) |

Hosting: the owner picks Vercel or Netlify (Q-015, OA-05) and deploys with the skill: `/commercetools:nextjs-deploy-vercel` or `/commercetools:nextjs-deploy-netlify`. The skill verifies the commercetools credentials, then hands off to the host's official agent skill. Q does not store host tokens and never runs a deploy without the owner. After the deploy Q runs the smoke list (RELEASE-CHECKLIST section E).

### D10. Plan verifier: extend and run `plans/verify-plan.mjs` (Q-02)

State at planning time: `plans/verify-plan.mjs` exists (lead) and checks, without dependencies: letters and dependency order of `DEPENDENCY-PLAN.md`; every spec directory listed once in `SPEC-COVERAGE.md` and its primary being the first workstream that lists it; with `--strict` the required headings and a `- [ ] X-nn` task in every workstream file. Q extends it **without dependencies** (Node 22 `node:fs`, `node:path`, `node:test` for its own tests) with the flags below. The flat layout is already handled (`openspec/specs/<name>/spec.md`).

| Flag (new) | Behaviour |
| --- | --- |
| `--scenarios` | Parses every `#### Scenario: <title>` of every `openspec/specs/*/spec.md`; for each applicable spec (not marked not applicable in `SPEC-COVERAGE.md`) requires the title text to appear in a line `- [ ]` or `- [x]` of the **Scenarios checklist** section of its primary workstream file; reports `UNCOVERED <spec> / <title>`; writes the full table to `plans/evidence/Q/spec-coverage.md` |
| `--ticks` | A ticked scenario line must name a test (a backtick-quoted `it(...)` title or a recipe step id `6.n`) |
| `--tests <vitest.json>` | Every backtick-quoted test title in a ticked scenario line must exist as a **passed** test in the Vitest JSON report (`npx vitest run --reporter=json --outputFile=<file>`); reports `MISSING TEST` and `FAILED TEST` |
| `--manual` | `TODO-MANUAL-TESTING.md` rows have the six columns; ids unique and well formed (`OA-nn`, `SO-nn`, `M-<LETTER>-nn`); status in `TODO`, `DONE`, `PASS`, `FAIL`, `WAIVED`; steps and expected result not empty; every id named in a workstream file or `notes/todo-*.md` exists |
| `--questions` | Every `Q-<letter>-<n>` named in a workstream file exists in `QUESTIONS.md` or `notes/questions-*.md` with a default |
| `--release` | Every workstream `Done` in `STATUS.md`; no owner row `TODO` or `FAIL`; no UNCOVERED scenario; exits 1 otherwise (used by the deploy step) |

Tests: `plans/verify-plan.test.mjs` with `node --test`: a fixture directory with two tiny specs and two workstream files (the verifier takes the repository root as an optional argument so tests can point it at the fixture) proving each flag fails on the planted defect (missing scenario, unticked scenario named as ticked, unknown test title, duplicate row id, bad status, dependency on a later letter) and passes on the clean fixture. Name the tests after the rule: `UNCOVERED scenario is reported`, `ticked scenario without a test is rejected`, `missing test in the vitest report is reported`, `failed test is reported`, `duplicate owner row id is rejected`, `dependency on a later letter is rejected`.

Run it: `node plans/verify-plan.mjs --strict --scenarios --ticks --manual --questions` after every workstream and in Q-01; with `--tests plans/evidence/Q/vitest.json --release` at the end (Q-16).

### D11. Evidence layout

```
plans/evidence/Q/
  README.md               what each file proves
  routes.md               route inventory (Q-00)
  clean-clone.md          Q-03
  spec-coverage.md        Q-01, regenerated by verify-plan
  vitest.json             Q-03
  bootstrap.md            Q-03
  data-sweep.md           Q-04
  responsive/             JSON per page and width, screenshots
  a11y/                   checklist.md, contrast.md, lighthouse reports, known-issues.md
  journeys.md             Q-09, screenshots J<n>-<step>-<375|1440>.png
  security.md             S1 to S18 results, 401-matrix.md
  perf.md                 budgets table with measured values
  fixes.md                every defect found and its fix or owner
  test-data.md            register of test records
  purge-plan.txt          cleanup dry run
  leftovers.md            what cannot be deleted
  npm-audit.txt, secrets.md
  deployed/               post-deploy smoke
  FINAL-REPORT.md         Q-16
```

## 4. Tasks

Common rules: `npm run check` and `npm run build` before ticking where code changed; commit `ws-q: Q-nn summary`; evidence files as named; every fix goes to `fixes.md`.

- [ ] **Q-00 Preconditions and inventory.** All workstreams A to P are `Ready for review` or `Done` in `STATUS.md`; list any not done and stop for those scopes. Chrome DevTools MCP connected (`list_pages` answers); commercetools MCP connected or `seed verify` works; OA-01 and OA-04 status noted. Create `plans/evidence/Q/` and `README.md`. Write `routes.md`: every real route (from `app/**/page.tsx`) with a resolved example URL per placeholder (`{PLP}`, `{PDP:pod}` and the others in `E2E-JOURNEYS.md`), the Route Handler list (from `app/api/**/route.ts`), the page list for D3 and D4. Record Node version, commit hash, `next` version. `npm run build` succeeds. [SKILL: commercetools-storefront]
- [ ] **Q-01 Scenario ledger.** Run the plan verifier (Q-02 first if the flags do not exist yet: swap order with Q-02). Output `plans/evidence/Q/spec-coverage.md`. For each `UNCOVERED` scenario: add the missing test in its workstream's area (small, with the scenario name as the test title) or mark the spec's scenario with a written reason (browser proof only) in the primary workstream's checklist. Zero unexplained UNCOVERED remain. Tests: the verifier's own tests (Q-02).
- [ ] **Q-02 Extend `plans/verify-plan.mjs`** per D10, with `plans/verify-plan.test.mjs`. `node --test plans/verify-plan.test.mjs` passes; running the verifier on the real plan prints a readable report. Tests named in D10.
- [ ] **Q-03 Clean-clone gates and bootstrap scenarios.** Clone to a scratch folder, `npm ci`, `npm run check`, `npm run build` in `storefront/` and `seed/`; record versions. Prove the `bootstrap-and-structure` scenarios: forbidden version (scratch edit of `next` to 15.x fails `check` with the rule), missing `SESSION_SECRET` (fails fast naming the variable only), wrong project (stops with both keys), bundle scan, planted client import of `lib/ct` fails lint, scaffold evidence of A exists. Run `npx vitest run --reporter=json --outputFile=../plans/evidence/Q/vitest.json`. Output `clean-clone.md`, `bootstrap.md`, `vitest.json`. [SKILL: commercetools-storefront]
- [ ] **Q-04 Data sweep, idempotency and test helpers.** D8. Create in `seed/`: `seed:advance-order` and `seed:cleanup-tests` per D5 (project guard, `--dry-run`, `mcf-` or register-driven, refuse others) with tests against the in-memory fake API (`advance moves preparing to ready-for-collection`, `advance refuses an order of a non-example customer`, `advance refuses a wrong project key`, `cleanup deletes only registered records`, `cleanup dry run changes nothing`, `cleanup lists orders as not deletable`). Run the sweep, the second seed run (`0 change(s)`), and record the out-of-stock fixture SKU and store. Output `data-sweep.md`. [SKILL: commercetools-platform]
- [ ] **Q-05 Responsive tooling.** Save the D3 assertion function as `plans/evidence/Q/responsive/assert.js.txt` and the page-by-width matrix as `responsive/matrix.md` (rows: pages of D3, columns: widths, cell `todo`). Run it once on home to validate the snippet. No code in the app.
- [ ] **Q-06 Responsive pass.** Execute the matrix at all widths for every page in all three locales where listed; fix defects (CSS in the owning component, one defect per commit) or list them. Screenshots at 1440, 900 and 375 for every page. Output `responsive/`. Acceptance: no overflow, grids and navigation as D3.
- [ ] **Q-07 Contrast audit.** Run E's contrast and token tests (`npm test`), then the runtime audit of D4.1 on every page of the list at 1440 and 375 (and in `de-DE`). Fix every component that still uses a failing colour for small text (switch to `--teal-text`, `--danger-text`, `--ink-2`; availability and success text, error text, meta text, subscription status pills). One component per commit, each with a test that asserts the class or token (`availability text uses teal-text`, `error text uses danger-text`, `meta text never uses ink-3 on canvas-2`). Output `a11y/contrast.md`. Never change a token name; token **values** only through E's decision (M-E-02). `npm run check`.
- [ ] **Q-08 Accessibility sweep.** D4.2 and D4.3: the checklist on all pages, `lighthouse_audit` desktop and mobile on the page list, reduced-motion check, focus-not-obscured fix (`scroll-padding-top`), skip link verified, keyboard run of checkout. Fix or list every finding. Output `a11y/`.
- [ ] **Q-09 Journeys.** Run J0 to J15 of `E2E-JOURNEYS.md` (J1 three times, J1/J2/J3/J8/J12 also at 375 px), with read-backs and the test-data register. Fix or hand over every defect. Output `journeys.md`, `test-data.md`, `fixes.md`. Journeys blocked by an owner row are marked `blocked: OA-nn` and the rest continue.
- [ ] **Q-10 Security: boundary and secrets.** S1 to S3. Run A's `check-secrets.mjs`, `check-versions.mjs` and `check-bundle-secrets.mjs`; extend the bundle script's secret list per S3 with tests (`contact webhook token in the bundle is found`, `list covers every secret named in .env.example`). Output `security.md` (S1 to S3) and `secrets.md`. [SKILL: commercetools-storefront]
- [ ] **Q-11 Security: session, 401, IDOR, CSRF, redirect.** S4 to S8, S13, S14. Create `storefront/scripts/api-matrix.test.ts` (checked-in auth table, fails on a route without an entry). Add the same-origin and content-type guard as one shared helper (`lib/http/guard.ts`) if D has none (check D's `handle` wrapper first), applied to all mutating handlers, with tests (`foreign origin is refused`, `non json body is 415`, `no origin header is allowed`); fix the `next` validation if needed with a test. Output `security.md`, `401-matrix.md`. [SKILL: commercetools-storefront]
- [ ] **Q-12 Security: XSS, headers, CSP.** S9, S12. Add `safeJsonLd()` helper (`lib/seo/json-ld.ts`) and replace every JSON-LD `JSON.stringify` in app code with it (tests: `less-than is escaped in json-ld`, `product name with a closing script tag cannot break out`); add the headers in `next.config.ts` with CSP, test with `get_network_request` and a full journey with no CSP console errors; payload runs from J5 and J13. Output `security.md`.
- [ ] **Q-13 Security: rate limits, audit, logging.** S10, S11, S15 to S18. Verify J's `lib/rate-limit.ts` is applied to every route listed in S10 and add it where missing; tests (`eleventh login attempt in ten minutes is 429`, `limiter key is hashed and never logged`, `retry-after header is present`, `contact route uses the shared limiter`); run `npm audit --omit=dev --audit-level=high` in both apps; logging grep; demo accounts row. Output `security.md`, `npm-audit.txt`.
- [ ] **Q-14 Performance and caching.** D7: traces for home, listing, product, cart on desktop and mobile emulation; First Load JS from the build output; request counts; header checks; two-context HTML check. Fix misses (one per commit) or record with M-Q-05. Output `perf.md`.
- [ ] **Q-15 Deploy gate.** D9: delete `app/api/health/` and `app/api/dev/` (with their tests; the journeys no longer need them), extend `scripts/predeploy-check.mjs` (A and D already built the health and dev checks) with all checks and tests (`health route present fails`, `short session secret fails without printing it`, `project key mismatch fails naming both keys`, `admin scope fails`, `tracked env file fails`, `dev script import fails`, `clean project passes`); wire `npm run predeploy`; add a "Deploying" section to `storefront/README.md` (env names, Node 22, base directory, the two skill commands, rollback). Run it against a scratch copy with dummy env: passes. [SKILL: commercetools-storefront]
- [ ] **Q-16 Release report.** Update every line of `plans/RELEASE-CHECKLIST.md` with status and evidence path; write `plans/evidence/Q/FINAL-REPORT.md` (what was verified, what failed and was fixed, known gaps, open owner rows, rollback note, recommended monitoring); run `node plans/verify-plan.mjs --strict --scenarios --ticks --manual --questions --tests plans/evidence/Q/vitest.json` and save the output. Set `STATUS.md` to `Ready for review` for Q.
- [ ] **Q-17 Post-deploy smoke (after the owner deploys, OA-05).** RELEASE-CHECKLIST section E on the deployed URLs; evidence in `plans/evidence/Q/deployed/`. If a deployment problem appears, write it to `fixes.md`, tell the lead; Q is `Done` only after this task.

## 5. Scenarios checklist

Q owns no spec. Tick a spec **only when** (1) `verify-plan --scenarios --tests` shows all its scenarios covered and passing in its primary workstream, and (2) the browser or check named in the last column was run and recorded. Scenario counts are the `#### Scenario` headings on disk on 2026-10-19 (total of applicable specs: 246).

| Spec | Scenarios | Primary workstream | Q proves it with | Verified |
| --- | --- | --- | --- | --- |
| `about-us` | 3 | P | J13 | [ ] |
| `account-and-self-service` | 2 | L | J9 | [ ] |
| `account-dashboard` | 3 | L | J11 | [ ] |
| `account-registration-request` | 3 | not applicable (D-022) | confirm the SPEC-COVERAGE reason, no test | n/a |
| `account-sign-in` | 4 | J | J9 J10 | [ ] |
| `address-book` | 3 | L | J9 | [ ] |
| `authentication-and-identity` | 4 | J | J9 J10 J14 | [ ] |
| `blog-resources` | 3 | P | J13 | [ ] |
| `bootstrap-and-structure` | 14 | A | Q-03 gates | [ ] |
| `cart-management` | 3 | I | J2 J8 J10 | [ ] |
| `cart-page` | 3 | I | J2 J8 | [ ] |
| `checkout` | 3 | K | J1 J2 J15 | [ ] |
| `checkout-page` | 2 | K | J1 J2 | [ ] |
| `contact-us` | 4 | P | J13 | [ ] |
| `delivery-slot-booking` | 4 | not applicable (D-022) | confirm the SPEC-COVERAGE reason, no test | n/a |
| `design-account-area` | 11 | L | J3 J4 J9 J11 | [ ] |
| `design-cart-drawer` | 5 | I | J1 J2 | [ ] |
| `design-cart-page` | 6 | I | J2 J8 | [ ] |
| `design-checkout-page` | 13 | K | J1 J2 J15 | [ ] |
| `design-home-page` | 7 | O | J0, sweeps | [ ] |
| `design-order-confirmation-page` | 4 | K | J1 J2 J3 J11 | [ ] |
| `design-product-card` | 7 | G | J7 J8 | [ ] |
| `design-product-detail-page` | 10 | H | J1 J3 J5 J8 | [ ] |
| `design-product-listing-page` | 9 | G | J7 | [ ] |
| `design-store-picker-and-locale` | 7 | F | J0 J6 J8 | [ ] |
| `design-storefront-shell` | 9 | F | J0 J6, sweeps | [ ] |
| `design-tokens-and-components` | 7 | E | Q-06 to Q-08 sweeps | [ ] |
| `discovery-and-browse` | 2 | G | J7 | [ ] |
| `email-verification` | 4 | J | J9 | [ ] |
| `error-pages` | 3 | P | J12 | [ ] |
| `faq` | 3 | P | J13 | [ ] |
| `fulfilment-and-availability-model` | 8 | F K N | J1 J2 J3 J8 J11 | [ ] |
| `home-landing-page` | 2 | O | J0 J10 | [ ] |
| `order-confirmation-page` | 3 | K | J1 J11 | [ ] |
| `order-history` | 3 | L | J11 | [ ] |
| `out-of-stock-substitutions` | 4 | not applicable (D-022) | confirm the SPEC-COVERAGE reason, no test | n/a |
| `password-reset` | 4 | J | J10 | [ ] |
| `payment-methods` | 3 | L | J9 | [ ] |
| `platform-project-setup-and-seed` | 14 | B C | Q-04 data sweep | [ ] |
| `policy-pages` | 3 | P | J13 J2 | [ ] |
| `post-purchase-order-management` | 4 | L | J11 | [ ] |
| `product-detail-page` | 3 | H | J1 J8 | [ ] |
| `product-listing-page` | 4 | G | J7 | [ ] |
| `reviews-and-ratings` | 13 | M | J5 | [ ] |
| `saved-lists` | 3 | L | J9 | [ ] |
| `search-results-page` | 4 | G | J7 | [ ] |
| `server-architecture-and-data-flow` | 10 | D | Q-10 to Q-13, J14 | [ ] |
| `subscriptions-and-recurring-orders` | 4 | N | J3 J4 | [ ] |
| `switching-region-or-language` | 3 | F | J6 | [ ] |
| `weight-based-pricing` | 4 | not applicable (D-022) | confirm the SPEC-COVERAGE reason, no test | n/a |

Cross-cutting scenarios that Q **owns the proof of**, even though other workstreams own the code:

- [ ] `bootstrap-and-structure` / Fresh clone builds, Forbidden version, Scaffold evidence, Missing secret, Client bundle scan, Wrong project, Stored URL with a query, Deploy gate, Server import in a client file: Q-03, Q-10, Q-15 (`bootstrap.md`).
- [ ] `server-architecture-and-data-flow` / Unauthenticated account call, Tampered cookie, Two shoppers, Raw fetch to commercetools, commercetools 5xx: S1, S4, S5, S13 and journeys J12, J14.
- [ ] `design-tokens-and-components` / Phone, Icon button, Content never hidden at rest, Disabled option explains itself: Q-06 to Q-08.
- [ ] `design-storefront-shell` / Threshold changes (read from configuration in every market), Pointer leaves: J0, J6.
- [ ] `fulfilment-and-availability-model` / Threshold per market, US address without state rate, Mixed order, Ready: J1, J2, J11.

## 6. Browser recipe (Chrome DevTools MCP)

The recipe for Q is the journeys plus the sweeps; follow this order and record each in `plans/evidence/Q/README.md`.

1. **Start** `npm run build && npm run start`; `list_pages`; open a page; `navigate_page http://localhost:3000/`.
2. **Responsive sweep** (D3): for each page in `routes.md` and width in 1440, 1080, 900, 820, 700, 520, 375: `resize_page`, `navigate_page`, `evaluate_script` with the assertion function, `take_screenshot` where required, `list_console_messages` (no errors) and `list_network_requests` (no failures).
3. **Accessibility sweep** (D4): `lighthouse_audit` per page and device with `outputDirPath`; `take_snapshot` to read the accessibility tree (names, roles, order); keyboard run with `press_key` (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`, arrows); `emulate` reduced motion and `evaluate_script` `document.getAnimations().length`; zoom checks by resizing to 640 and 320 px wide.
4. **Journeys** J0 to J15 exactly as written in `plans/E2E-JOURNEYS.md`.
5. **Security** (D6): `get_network_request` for headers and cookies; two isolated contexts for IDOR and isolation; payload runs from J5 and J13; `evaluate_script` for XSS markers.
6. **Performance** (D7): `performance_start_trace` with reload, `performance_stop_trace`, `performance_analyze_insight` for LCP and layout shift; repeat on mobile emulation; read `Cache-Control` of each response type.
7. **Deployed smoke** after the owner deploys (Q-17), same tools on the deployed URL at 375 and 1440.

Viewports for every journey: 1440x900, plus 375x812 where `E2E-JOURNEYS.md` says so. Console and network clean after every step.

## 7. Self-verification with data (no asking the owner)

1. **Data**: D8 sweep; second seed run `0 change(s)`; reviews' `reviewRatingStatistics` against the included reviews; price table against the pages; inventory rule against the store availability the shopper sees (J8).
2. **Journey read-backs** (in `E2E-JOURNEYS.md`): orders, carts, recurring orders, reviews, customers after each journey.
3. **After the journeys**: leftover check: only records in `test-data.md` exist; cleanup dry run; second seed run after the purge.
4. **Counts**: the number of scenarios on disk equals the number in the ledger (the verifier prints both).

## 8. Manual testing and owner items (also in `plans/notes/todo-Q.md`)

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-05 (existing) | Owner | Before Q-17 | Choose hosting, create the project, set environment variables (names in `storefront/.env.example`), deploy with `/commercetools:nextjs-deploy-vercel` or `/commercetools:nextjs-deploy-netlify`. | Deployed URL | TODO |
| OA-N-Q1 | Owner | Before the deploy | 1. Create the production storefront API client with exactly the scopes in `storefront/.env.example`. 2. Generate `SESSION_SECRET` (for example `openssl rand -base64 48`). 3. Put values only in the host's environment settings and in the local `.env.production` used for the dry run; never in chat. | `npm run predeploy` passes | TODO |
| SO-Q2 | Owner | Before the deploy | Decide what to do with the six demo customers who share one known password: keep (demo site, documented in README) or rotate the password and hide demo accounts. | Decision recorded under Q-Q-8 | TODO |
| M-Q-01 | Owner | After Q-09 | On a real phone, run J1 (US) and J3 on the deployed or local release build over the network: tap targets, keyboard, hosted Checkout with the test card. | Completes without problems | TODO |
| M-Q-02 | Owner or accessibility reviewer | After Q-08 | VoiceOver pass over home, a product, the cart, checkout and the subscriptions tab (steps in `plans/evidence/Q/a11y/checklist.md`). | Everything announced sensibly; findings listed | TODO |
| M-Q-03 | German-speaking reviewer | Before release | Read the German UI through J1-DE and the German content pages. | Natural wording | TODO |
| M-Q-04 | Owner | After Q-09 | Read `plans/evidence/Q/purge-plan.txt` (cleanup dry run); then tell the lead to run `npm run seed:cleanup-tests -- --register ../plans/evidence/Q/test-data.md --apply --confirm <projectKey>`. | Test records removed; orders stay (cannot be deleted) | TODO |
| M-Q-05 | Owner | After Q-13 and Q-14 | Read `security.md` and `perf.md` open items; accept or reject each in writing. | Accepted or fix requested | TODO |
| M-Q-06 | Owner | Before release | Read the known gaps in `RELEASE-CHECKLIST.md` section F and accept them (no monitoring, per-instance rate limits, renewal payment, repository content). | Written acceptance | TODO |
| M-Q-07 | Owner | After Q-17 | Open the deployed site; check home, one product, the cart and sign-in on your own device and network; confirm the sign-in demo accounts decision is applied. | Site as expected | TODO |

## 9. Questions (also in `plans/notes/questions-Q.md`)

| ID | Question | Default | Blocks |
| --- | --- | --- | --- |
| Q-Q-1 | Is a clean-clone `npm ci` run required on the release commit, in addition to the working-tree run? | Yes, once, before deploy | no |
| Q-Q-2 | WCAG target: 2.2 AA (the spec says AA)? | 2.2 AA | no |
| Q-Q-3 | Token value changes for contrast | Already decided by E (Q-E-1, M-E-02); Q verifies the pages use them | no |
| Q-Q-4 | Stepper targets are 38 px (token spec), below the 44 px touch guideline but above the 24 px WCAG minimum | Keep 38 px, record it, enlarge to 44 px on touch viewports only if cheap | no |
| Q-Q-5 | `scroll-padding-top` so the sticky header never hides a focused element (F has the skip link; the spec has neither)? | Yes, small fix | no |
| Q-Q-6 | Use the `__Host-` cookie prefix for the session cookie? | No (needs Secure also in development); keep the current name | no |
| Q-Q-7 | Per-instance rate limits are weak on serverless hosting | Ship the in-memory limiter; recommend host WAF rules in the deploy notes | no |
| Q-Q-8 | Demo accounts on a public deployment | Keep for a demo site, documented; SO-Q2 decides | deploy |
| Q-Q-9 | Performance budgets (LCP 2.5 s mobile, JS 200 kB, CLS 0.1) | As D7 | no |
| Q-Q-10 | Is a `/sitemap.xml` entry for products and categories needed before launch? | Content pages only (P); products parked in `IDEAS.md` | no |
| Q-Q-11 | CSP: enforce or report-only for the first deploy? | Enforce on the release build; fall back to report-only only if the hosted Checkout needs origins that cannot be listed | no |
| Q-Q-12 | May Q fix defects, or must each go back to its workstream? | Fix if under half a day and one area, with a test and a `fixes.md` entry | no |
| Q-Q-13 | Real-card test in the hosted Checkout before launch (needs a live PSP)? | No; test mode only; owner decides separately | deploy |
| Q-Q-14 | Where to run the post-deploy smoke: production URL or a preview URL first? | Preview deployment first, production after | deploy |

## 10. Definition of done

- Q-00 to Q-17 ticked (Q-17 after the owner's deploy), each with evidence under `plans/evidence/Q/` and a passing `check` commit where code changed.
- `node plans/verify-plan.mjs --strict --scenarios --ticks --manual --questions --tests plans/evidence/Q/vitest.json` exits 0 or every remaining line is explained and accepted in `FINAL-REPORT.md`; zero unexplained `UNCOVERED` scenario.
- Responsive, accessibility, journey, security and performance results recorded; every defect in `fixes.md` is fixed, handed over with a named owner, or accepted by the owner (M-Q-05).
- `npm run predeploy` passes; `app/api/health/route.ts` absent; `check-bundle-secrets` and E's contrast and token tests pass.
- `RELEASE-CHECKLIST.md` has no unexplained `[ ]`; `E2E-JOURNEYS.md` status line updated with the date and commit.
- Every row of `TODO-MANUAL-TESTING.md` is `DONE`, `PASS` or `WAIVED` (WAIVED needs a name, a date and a reason).
- No `TODO` or `FIXME` in code without an `IDEAS.md` entry; second `npm run seed` reports `0 change(s)`; test data cleaned or listed in `leftovers.md`.
- `STATUS.md` shows `Ready for review` for Q; the lead sets `Done` after the post-deploy smoke.

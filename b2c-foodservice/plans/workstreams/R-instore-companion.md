<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream R: In-store companion

Read `plans/JUNIOR-GUIDE.md` first. Everything runs in `storefront/` except R-02 (`seed/`). Branch `instore` (not pushed). Dev URL assumed `http://localhost:3000`, mock upstream `node scripts/mock-ct-server.mjs`.

## 1. Header

| Field | Value |
| --- | --- |
| ID | R |
| Name | In-store companion: the same codebase switched by `APP_MODE=instore` into a phone-first shopping experience for a shopper standing in a store; barcode scan (barcode = SKU), big-touch browse, bag and hosted Checkout |
| Depends on | G (listing loaders), H (product loader, `PdpProvider`), I (cart API and hooks), K (hosted Checkout, D-039), D (server core), E (atoms), F (shell providers). All are `Ready for review` or better. |
| Wave | 12 (after Q; does not change Q's evidence) |
| Specs implemented | none new: this workstream adds a mode, not a spec. It reuses `design-product-listing-page`, `design-product-detail-page`, `design-cart-page` and `design-checkout-page` behaviour with in-store presentation (D-041 to D-049). |
| Owner prerequisites | OA-R-a (create the type in the project: `seed` types step or Merchant Center), OA-R-b (Netlify branch deploy `instore`), OA-R-c (environment variables scoped to the branch), M-R-01 (real camera scan on a phone), M-R-02 (printed barcodes) |
| Skills | `commercetools-storefront`, `commercetools-platform` (custom types on carts and orders) |

## 2. Goal and scope

**Goal.** A shopper in a Malva store opens `instore--<site>.netlify.app` on their phone (or installs it to the home screen), taps a category or the camera button, scans the barcode on a product (the barcode encodes the SKU), sees a dialog with the product and adds it to the bag, then pays in the hosted Checkout. Every cart made this way is tagged `orderType = in-store-purchase` so the order can be told apart from online orders.

**In scope**

1. A mode switch: one server variable `APP_MODE` (`website` default, `instore`). Same build, different experience per deploy (R-03).
2. In-store shell, home (category tiles with big icons and a big scan button), category list, product page, bag and checkout layout, all single column with at least 48 px targets (R-08, R-09, R-11).
3. Barcode scanner dialog with `BarcodeDetector` and a lazily loaded `@zxing/browser` fallback, manual SKU entry, and all error states (R-06, R-07, R-10).
4. Cart custom type fields `instore-order-type` on every cart created in this mode, on existing carts, rebuilt carts, checkout clones and the order (R-05).
5. Seed definition of the type (R-02), security header and CSP for the camera (R-04), noindex, viewport, manifest (R-12), Netlify branch deploy documentation (R-13).

**Out of scope**

- A real store inventory view per store or a store picker in this mode (availability is the online stock, D-044). Parked in `IDEAS.md`.
- Collection (BOPIS), subscriptions, reviews, account area, journal, content pages, newsletter in this mode.
- Printing barcodes, a point-of-sale terminal, staff tooling.
- Deploying. Nothing is pushed or deployed by this workstream.

## 3. Design

### D1. Mode switch

`lib/app-mode.ts` (no `server-only`, pure): `parseAppMode(value)`, `getAppMode()` reads `process.env.APP_MODE`, `isInstore()`. Anything other than `instore` (case-insensitive, trimmed) is `website`. It is a server variable; the browser never reads it. Server components pass what a client component needs as props. `NEXT_PUBLIC_APP_MODE` is **not** created (D-041): nothing in client code needs the mode, and a second variable could disagree with the first.

Where the mode acts (all on the server):

| Place | Website | In-store |
| --- | --- | --- |
| `app/[locale]/layout.tsx` | shell with header, mega menu, footer | `InstoreShell` (badge, bag button, scan button, no footer) |
| `app/[locale]/page.tsx` | home | `InstoreHome` |
| `app/[locale]/c/[slug]/page.tsx` | not found | in-store category list |
| `app/[locale]/p/[slug]/[sku]/page.tsx` | product page | `InstoreProduct` |
| `app/[locale]/bag/page.tsx` | not found | in-store bag |
| `app/[locale]/checkout/page.tsx` | checkout | the same Checkout in a single column with a sticky bottom bar |
| `proxy.ts` | unchanged | redirects `/category/x` to `/c/x`, `/cart` to `/bag`, and every content, account, journal, search, shop path to the home page |
| `next.config.ts` | headers as before | adds `X-Robots-Tag: noindex, nofollow`; `Permissions-Policy` allows `camera=(self)` |
| `app/robots.ts`, `app/sitemap.ts` | as before | disallow all, empty sitemap |

### D2. Barcodes and the scan flow

Pure `lib/instore/scan.ts`: `normaliseScan(raw)` trims, removes control characters and a leading symbology prefix (`]C1`, `]E0` and similar, three characters starting with `]`), and keeps the text only when it matches `SKU_PATTERN` (`/^[A-Za-z0-9._-]{1,64}$/`). Case is kept (SKUs are upper case in the catalogue, the lookup is exact). Result `{ ok: true, sku }` or `{ ok: false, reason: 'empty' | 'invalid' }`. Anything that is not a SKU (an EAN of a competitor, a URL) is `invalid` and never sent to the server.

`lib/instore/scan-state.ts` (pure reducer): `idle`, `starting`, `scanning`, `denied`, `no-camera`, `camera-error`, `looking-up`, `found`, `unknown`, `invalid`, `lookup-failed`. `shouldAccept(last, sku, now)` ignores the same code seen again within 2500 ms (a camera sees a code 30 times a second) and while a result is shown. Scanning the same code again after the dialog was closed works.

Engine `lib/instore/scanner-engine.ts` (client only): `BarcodeDetector` when `window.BarcodeDetector` exists and supports `code_128`, `code_39`, `ean_13`, `ean_8`, `upc_a`, `upc_e`, `qr_code`, `itf`, `data_matrix`; otherwise `await import('@zxing/browser')` (lazy: not in the main bundle, checked by `npm run build` output and a test that no top-level import exists). Both read the same `MediaStream` from `getUserMedia({ video: { facingMode: 'environment' } })` shown in a `<video playsInline muted>`.

Dialog `components/instore/scan/ScanDialog.tsx` (built on `components/ui/Modal`): camera view, state messages, manual SKU form (always available: it is the fallback when permission is denied or no camera exists), result card. Result card: image, name, variant attributes (grind, pack, size, colour), price, availability, quantity stepper (big), `Add to bag`. Unknown SKU: "We do not know this code", scan again. Out of stock: the add button is disabled with the reason. Already in the bag: "In your bag: n" and the add button still works (it adds to the same line).

Test seam: in non-production builds only, `window.__mcfInstoreScan(text)` feeds a decoded string into the same handler as the camera. In production the line is removed (`process.env.NODE_ENV !== 'production'`, dead-code eliminated).

### D3. Lookup route (BFF chain, six files)

`GET /api/instore/scan?sku=<SKU>` answers `{ product: ScanProduct }` or the standard error envelope: `400 validation_failed` (bad SKU), `404 not_found` (unknown or unpublished). Chain: `components/instore/scan/*` then `hooks/useScanLookup.ts` then `app/api/instore/scan/route.ts` then `lib/ct/instore-scan.ts` (calls the existing `loadProductPage(sku, locale)`: Product Search exact `variants.sku`, projection, inventory) then `lib/mappers/scan-product.ts` (pure). Type `ScanProduct` in `lib/types.ts`, key `keyScanLookup` in `lib/cache-keys.ts`. Market from the session (`getMarket()`), never from the client. Rate limited like the other cart routes.

### D4. Browse and product page

- Home: one large tile per root category (icon from `components/ui/icons.ts`, 112 px tall, 2 per row), a full-width scan button, a link to the bag. Data: the category tree (`getCategoryTree`), nothing else.
- Category: sub-category tiles (when present) and a list of rows: image 72 px, name, price (from), availability line (in stock, low, out), whole row is the link (min height 88 px). Reuses `searchProducts` (no facets) and `getListingProjections` (G), plus `getInventoryDetail` for the default SKU of each row. No filters, no sort, no breadcrumbs beyond a back link, 24 per page with next and previous.
- Product: `PdpProvider` (H) with `collection` forced off, so state, variant resolution and stock limits are the existing ones. One image, name, price, availability, option groups (the existing `OptionGroup` without the guide link), a sticky bottom bar with a big stepper and `Add to bag - total`. No tagline, description, facts, reviews, related, trust row or accordions.

### D5. Bag and checkout

- `/bag`: single column, one card per line (image, name, variant, price), a big stepper (56 px) and Remove, a sticky bottom bar with the total and `Checkout`. Reuses `useCart` and `useCartMutations` (I). No discount code box, no fulfilment groups, no free-shipping nudge. Out-of-stock and price-changed notices of I are shown.
- `/checkout`: the existing `CheckoutPage` (K) with `variant="instore"`: compact header, no step indicator, single column, the Review stage's Continue button becomes the sticky bottom bar with the total. The hosted Checkout is unchanged (D-039). Return and confirmation routes are unchanged; the confirmation page offers "Keep shopping" to the in-store home.

### D6. Cart custom type fields

`lib/ct/order-type.ts` (server-only):

- `orderTypeCustom(): Promise<{ type: { typeId: 'type'; key: 'instore-order-type' }; fields: { orderType: 'in-store-purchase' } } | undefined>`: `undefined` unless `isInstore()` and the type exists. The existence check is one `GET /types/key=instore-order-type`, cached in memory for 5 minutes when present and 60 seconds when missing. A missing type logs **once** (`{ event: 'instore_order_type_missing' }`) and the field is skipped; the shopper sees nothing different.
- `withOrderTypeDraft(draft)`: adds `custom` to a `CartDraft` (used by `createRawCart` and the checkout clone `createPartCart`).
- `orderTypeActions(cart)`: `[]` when the cart already has `orderType = in-store-purchase`; `[setCustomType { type, fields }]` when the cart has no custom type; `[setCustomField orderType]` when it has this type with another value; `[]` and one log when the cart carries a different custom type (the platform allows one type per resource; never overwrite foreign data).
- Callers: `createRawCart` (draft, covers first add, market switch rebuild and mixed-bag migration through `rebuildCart`), `addLine` (existing cart without the field: the actions go in the same update as `addLineItem`), `getCartView` (a cart that predates the mode), `createPartCart` (clone per payment group), `reorder` (goes through `addLine`).
- Order: the hosted Checkout creates the order from the cart. The documentation read (commercetools-knowledge) does not state whether `Order.custom` is copied from `Cart.custom`; `OrderFromCartDraft` has its own `custom`, which we cannot set because the Checkout places the order. So the post-order hook `ensureOrderType` (registered in `postOrderHooks`) reads the order and, in in-store mode, sets the type and field when `custom.fields.orderType` is missing. `OrderView.orderType` exposes the value. Live confirmation is M-R-03.

### D7. Security, SEO, PWA

- `Permissions-Policy`: `camera=(self)` in in-store mode, `camera=()` in website mode (least privilege; the website has no camera feature). `geolocation=(self)` unchanged. CSP gets `media-src 'self' blob:`; `@zxing/browser` uses no worker and no `eval`, so `worker-src` is not added (verified in the browser, R-14).
- noindex: `robots` metadata on every page of the mode, `X-Robots-Tag` from `next.config.ts`, `robots.txt` disallow all, empty sitemap.
- `viewport-fit=cover`, `theme-color`, safe-area padding on the sticky bars and the scan button. Web app manifest `app/instore.webmanifest/route.ts` (404 in website mode) with an SVG icon; installable from Chrome on Android, "Add to Home Screen" on iOS.

### D8. Messages and design rules

New namespace `instore.*` in both catalogues with identical keys; en-CA uses Canadian spelling where a word differs (colour). Tokens only; icons from `components/ui/icons.ts` (new: `camera`, `scan`, `grid`). Locale navigation from `@/i18n/routing`. No `lib/ct` import from a client file.

## 4. Tasks

Common rules: test first; `npm run check` in `storefront` (and `seed` for R-02) before ticking; commit `instore: R-nn summary`; check in both modes (`APP_MODE=instore npm test` and the default).

- [ ] **R-01 Plan and notes.** This file, `STATUS.md` row R, `DEPENDENCY-PLAN.md` row R, D-041 to D-049 in `DECISIONS.md`, `notes/todo-R.md`, `notes/questions-R.md`, `consolidate-notes.mjs`, `verify-plan.mjs --strict`.
- [ ] **R-02 Seed type.** `seed/src/data/custom-types.ts` (`instore-order-type`, resourceTypeIds `order` and `cart`, enum field `orderType`), `K.typeInstoreOrder`, enum value sync in `planTypeUpdate`, seed tests.
- [ ] **R-03 Mode switch.** `lib/app-mode.ts`, `.env.example` name, proxy redirects, `robots.ts`, `sitemap.ts`, route guards. Tests: `Mode defaults to website`, `instore is case insensitive`, `proxy redirects content paths in instore mode`, `proxy leaves website mode alone`.
- [ ] **R-04 Camera headers.** `lib/security-headers.ts` and its test: `Permissions-Policy camera=(self) in instore mode only`, `CSP has media-src`; `next.config.ts` adds `X-Robots-Tag` in the mode.
- [ ] **R-05 Cart custom fields.** `lib/ct/order-type.ts` and the callers of D6, `OrderView.orderType`, post-order hook. Tests: create, existing cart, rebuilt cart, clone, foreign type, missing type logs once and skips, website mode never sets it.
- [ ] **R-06 Scan parsing and state.** `lib/instore/scan.ts`, `scan-state.ts`. Tests: normalisation table, `SKU_PATTERN`, duplicate window, every state transition.
- [ ] **R-07 Scan lookup chain.** Type, mapper, `lib/ct/instore-scan.ts`, route, hook, key. Tests: mapper (variant attributes, price, availability), route (200, 400, 404, no store header), hook.
- [ ] **R-08 Shell and home.** `InstoreShell`, `InstoreHeader`, badge, bag button, `InstoreHome`, layout and page branches, icons, messages. Tests: both modes render the right shell; badge present; targets at least 48 px (class check).
- [ ] **R-09 Category and product.** `lib/instore/category.ts`, list rows, `InstoreProduct`, big stepper. Tests: row content, no editorial blocks, add flow, out-of-stock state.
- [ ] **R-10 Scanner UI.** `ScannerProvider`, `ScanButton`, `ScanDialog`, engine with lazy zxing. Tests: every dialog state (denied, no camera, unknown, out of stock, repeat scan, manual entry, found and add), engine selection, no static zxing import.
- [ ] **R-11 Bag and checkout.** `InstoreBag`, bag route, `CheckoutPage` `variant="instore"`, sticky bars, confirmation link. Tests: bag lines and totals, Checkout link, sticky bar, checkout in-store rendering.
- [ ] **R-12 noindex, viewport, manifest.** Metadata and viewport in the root layout, manifest route, icon. Tests: robots meta, `viewport-fit=cover`, manifest 404 in website mode.
- [ ] **R-13 Netlify branch deploy.** New section in `DEPLOY-NETLIFY.md`, `OWNER-HANDOFF.md` rows, `.env.example`.
- [ ] **R-14 Browser verification and audit.** Mock server (`instore-order-type`, custom on carts), recipe 6, Lighthouse accessibility at mobile (home, category, product, bag), evidence in `plans/evidence/R/`, `STATUS.md` `Ready for review`.

## 5. Scenarios checklist

No spec scenarios apply (no spec is owned). The behaviours below are the acceptance list; each names its test or evidence.

- [ ] Default mode is the website: `app-mode.test.ts` `Mode defaults to website`.
- [ ] In-store mode redirects content pages home: `proxy.test.ts` `proxy redirects content paths in instore mode`.
- [ ] Scan normalises a barcode to a SKU: `scan.test.ts` `normaliseScan`.
- [ ] Same code twice is ignored inside the window: `scan-state.test.ts` `shouldAccept`.
- [ ] Camera permission denied offers manual entry: `ScanDialog.test.tsx` `Permission denied: manual entry is offered`.
- [ ] No camera: `ScanDialog.test.tsx` `No camera: manual entry is offered`.
- [ ] Unknown SKU: `ScanDialog.test.tsx` `Unknown SKU: says so and keeps scanning`.
- [ ] Out of stock: `ScanDialog.test.tsx` `Out of stock: add is disabled with the reason`.
- [ ] Cart carries the order type on create, existing cart, clone: `order-type.test.ts`.
- [ ] Missing type does not break the shopper: `order-type.test.ts` `Type missing: logs once and skips the field`.
- [ ] Camera header only in the mode: `security-headers.test.ts`.
- [ ] Seed type is idempotent: `seed/src/instore-type.test.ts`.

## 6. Browser recipe (Chrome DevTools MCP)

Mock upstream: `node scripts/mock-ct-server.mjs` (header explains the environment; `NODE_EXTRA_CA_CERTS` with the printed certificate), then `APP_MODE=instore npx next dev --webpack`. Emulate 375x812 and 360x640 (touch, mobile).

1. Home: badge "In-store", category tiles, scan button; no mega menu, footer or promise bar. Screenshot.
2. Category tile, list rows, a row, product page: options, stepper, `Add to bag`; the bag count rises.
3. Camera button on every page opens the dialog; with no camera in the headless browser the dialog shows the no-camera state and manual entry. Enter `MCF-POD-EMBER-50`: result card; add twice; unknown `NOPE-1`; out-of-stock SKU; injected scan through `window.__mcfInstoreScan('MCF-POD-EMBER-50')` twice quickly (one result).
4. Bag: stepper, remove, sticky total and Checkout; Checkout page single column with sticky Continue.
5. `GET /__mock/carts` shows `custom.type.key = instore-order-type` and `orderType = in-store-purchase` on the cart. Restart without the type in the mock (`MOCK_NO_INSTORE_TYPE=1`): the add still works, the log shows one `instore_order_type_missing`.
6. Website mode (`APP_MODE` unset): `/en-US` is the normal home, `/en-US/bag` and `/en-US/c/x` are 404, header `Permissions-Policy` has `camera=()`.
7. Console clean, network free of failed requests, no CSP violation when the stream starts (stream faked in the test page).
8. Lighthouse accessibility at mobile on home, a category, a product and the bag.

## 7. Self-verification with data (no asking the owner)

The mock server serves the seed catalogue and a cart engine; it now accepts cart `custom` and `setCustomType` and `setCustomField` and serves `GET /types/key=instore-order-type`. Evidence is in `plans/evidence/R/`. What cannot be verified without a real phone or live credentials is in `notes/todo-R.md`.

## 8. Manual testing and owner items (also in `plans/notes/todo-R.md`)

See `plans/notes/todo-R.md`: OA-R-a (create the type), OA-R-b (branch deploy), OA-R-c (variables), OA-R-d (domain or QR code), M-R-01 (real camera), M-R-02 (printed barcodes), M-R-03 (order carries the field), M-R-04 (install to the home screen), SO-R-a (copy).

## 9. Questions (also in `plans/notes/questions-R.md`)

See `plans/notes/questions-R.md` (Q-R-1 to Q-R-9). Each has the default that was built.

## 10. Definition of done

- R-01 to R-14 ticked, each with a passing `check` commit in the default mode and in `APP_MODE=instore`.
- Acceptance list in section 5 has a named passing test or recorded evidence.
- Recipe 6 done with evidence at 375 and 360 px; console and network clean; Lighthouse accessibility recorded.
- `npm run build` passes in both modes; the zxing chunk is not in the main bundle.
- Owner rows exist; no deploy, no push; `node plans/verify-plan.mjs --strict` prints `plan ok`.

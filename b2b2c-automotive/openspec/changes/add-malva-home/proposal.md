## Why

Malva has no front door of its own. `/en-US` and `/de-DE` without a store segment answer with the not-found page (`app/[locale]/page.tsx`, and `bootstrap-and-structure` says "a dealer locator is out of scope"), and the not-found page's "home" link points at that same dead address. A driver who arrives at Malva (not at one reseller) has nowhere to browse parts or to find who sells them. `design-store-picker` already names this gap: "a cross-reseller locator, if wanted, is a separate Malva-level site". The owner wants it now (2026-10-13).

## What Changes

- New Malva home page at `/{locale}`: Malva header with category navigation, a banner carousel with Image source images, and a "Find your reseller" widget in the middle of the page, then category tiles.
- New Malva product listing pages (PLPs) under `/{locale}/categories/{slug}` over the whole master catalog. A card shows image, name, part number and fit badge. It shows no price and no inventory, links to no product detail page (there is none at Malva level), and has a "Select a reseller" button in place of "Add to cart".
- New reseller finder: one component placed in the home page and in a side drawer. The drawer opens from "Select a reseller" on a card and from a header button. It lists resellers with their branches, searches by postal code or city, offers "Use my location", and shows a map.
- Choosing a reseller from the drawer opens that reseller's storefront. From a card it opens the same product at that reseller (`/{locale}/{store}/p/{slug}`). From the header or the home page it opens the reseller's home. (Assumption A; the owner can change it before apply.)
- Seed: Malva-level banner images (new custom object, images from the Image source `_next/data` GET with clean URLs). The finder needs no new seed data: stores already carry address and coordinates in `store-settings`, and branch channels carry address and geo.
- The not-found page's "home" link now lands on the Malva home. The not-found scenario for `/{locale}` without a store goes away.
- Two locales (en-US, de-DE) for every new string. Default theme tokens, no reseller theme.

## Capabilities

### New Capabilities

- `consumer-storefront/design-malva-home`: the Malva home page: header, categories navigation, banners, central finder, category tiles.
- `consumer-storefront/design-malva-listing`: the Malva PLP over the whole catalog, with no price, no stock and no PDP, and the "Select a reseller" card action.
- `consumer-storefront/design-reseller-finder`: the finder component and drawer, the reseller list with search and location, the destination after a choice.

### Modified Capabilities

- `consumer-storefront/bootstrap-and-structure`: the "No store segment" scenario changes from not-found to the Malva home, the reserved `categories` segment is added, and a Malva listing scenario is added. (The "cross-reseller locator" note in `design-store-picker` Gaps is not a requirement; it is closed by an edit at archive time.)

## Impact

- Storefront: `app/[locale]/page.tsx` (home), new `app/[locale]/categories/[slug]/`, new `components/malva/*` (header, banner, finder, drawer, card), reuse of `components/store-picker` map and distance pieces, `lib/ct` category and search functions without the `stores` scope, `lib/ct` reseller list, `app/not-found.tsx` link, messages in both locales.
- commercetools: read-only product search over all products (no store filter, no prices, no inventory), categories, and store, channel and branch data for the finder. The frontend client scope list may need `view_stores` and `view_products`/`view_categories` (already listed for the shell); confirm in design.
- Seed: a Malva banner object under the site container; finder data on stores or branch channels.
- Plans: new workstream rows and manual-test rows in `plans/`, new specs registered in the dependency plan, `verify-plan --sync --strict`.
- Not in scope: a Malva PDP, cart, account or checkout at Malva level, Contentools editing of the Malva home, remembering the chosen reseller between visits (left open), a map provider decision beyond what `BranchMap` already uses.

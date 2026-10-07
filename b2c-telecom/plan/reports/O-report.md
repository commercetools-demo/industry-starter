# Workstream O report (home page)

Branch `ws/o-home-page`. Live smoke: dev server against `spec-test-b2c-telecom`, `curl` of `/en-US` and `/de-DE` (text, links and prices as in C-O-1..4, C-O-6). The Chrome C-O checks were not run.

## Done
O-01 .. O-07 (ticked). `npm run verify` passes. All three scenario rows have tests named after them (`app/[locale]/page.test.tsx`, `components/home/no-session.test.ts`, `components/home/PromoTiles.test.tsx`). Commit order: O-06 (messages) was committed right after O-01 because the component tests need the messages.

## Not done / blocked
Nothing blocked. C-O-5 (static shell) cannot be met, see Findings.

## Questions for the owner
- Hero alt text is the category asset name ("Cable internet"), not "Photo: ... via Pexels" (see Deviations). Should the seed put the photographer into the asset name?

## Missed features and deviations
- Real APIs differed from the plan's assumed names: `categoryHref/categoryPath/offerPath(key|offer, locale, tree)` take locale and tree; `listingKindForCategory(key, offers)`; there is no `isListable`, so `lib/home/derive.ts` has `listableOffers` (K's `filterEligible` for the anonymous consumer plus `dedupeByAnchors`) and `anonymousBuyer`. `Category` has no `description` and `image` is a string: blurbs come from `plp.blurb.*` through `BLURB_KEY_BY_CATEGORY` only.
- Added `Category.imageAlt` (from the category asset name) in `lib/types.ts` and `lib/mappers/category.ts` (H's files, additive, tested).
- Offers: `getOffersInCategory(key, marketFromLocale(locale))` (cached), NOT K's `getVisibleOffers*` (those read cookies). Eligibility is applied for the anonymous consumer only.
- `revalidate = 60` (equals `CATALOG_TTL`), not 300.
- Hero speed text uses message keys `home.hero.speed.gbps|mbps` with an ICU number (de-DE "Gbit/s"). Extra keys: `home.hero.imageAlt`, `home.promo.phone.titleNoPrice`, `home.promo.addons.titleNoNames`.
- Add-on tiles link to the offer's canonical card (`/shop/streaming-entertainment?offer=...`), not `/shop/add-ons?offer=` (C-O-4 expectation is outdated; D-052 canonical link wins).
- Live: the wireless "From" price is $45 (matches C-O-3); de-DE prices are whole euros (`40 €`, not `39,99 €`; H finding), so C-O-6 expects "ab 40 €/Monat".
- Hero image host is `media.istockphoto.com` live (allowed by `IMAGE_HOSTS`), not only `images.pexels.com`.

## TODOs for other workstreams
- I: `/[locale]` is `ƒ` because the layout's `AccountSlot` reads cookies. For ISR/static home, resolve the account link on the client (D-050 intent).
- G/H: set category asset names to the photographer credit if the alt text should name it.

## Findings
- Build output: `/[locale]` is dynamic because of the layout; the page itself does no per-request reads.
- Live data (anonymous): hero "Up to 1 Gbps ... from $39.99/mo, with price locked for 24 months"; tiles Phone $25, Wireless $45, Cable $39.99, Add-ons browse; Spotify $10, Apple TV+ $10, Apple Music $11, Netflix $8.

## Manual tests added
None.

## Junior design choices
Placeholder stripes use brand-300/400 at 45 degrees; popular add-on tile is a white rounded card on the subtle honey band with the pink-900 initial square; category card shows blurb plus the "From" line pinned to the bottom.

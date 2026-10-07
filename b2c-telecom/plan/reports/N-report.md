# Workstream N report (category listings and add-ons page)

Branch `ws/n-category-listings-and-addons`. Live smoke ran against `spec-test-b2c-telecom` (dev server on port 3140, storefront client) through curl and the Chrome DevTools connector (add, replace, add-on, remove with a real anonymous cart; the cart was emptied again).

## Done
N-01 … N-16 (all ticked). `npm run verify` passes. Every scenario row of the workstream table has a test named after it (`node plan/verify-plan.mjs`: 0 uncovered; its only complaint is STATUS counts, which the orchestrator syncs). The "Banner target does not resolve" row belongs to O-05 (`components/home/PromoTiles.test.tsx`), not written here.

Live facts verified: cable 3 plans, wireless 3, phone 4 (the online-only duplicate hidden), add-ons 13 (12 + 1 on page 2), streaming 5, protection 3, equipment 5 items, devices 2; chips `music` 2 add-ons; `?offer=` of another category answers 307 to the canonical URL; unknown slug and `/product/x` and `/shop` answer 404; other-locale slug answers 307 to this locale's slug; add Cable 100 then Cable 500 asks "Replace Cable 100 with Cable 500?" and replaces; Spotify attaches under Cable 500; removing a plan with add-ons asks first.

## Not done / blocked
Nothing blocked. The browser C-N-* checks are written in the workstream file (updated to the real chip ids and flow) but not all run by me; mobile (375 px) and Lighthouse not run.

## Questions for the owner
- Default order is cheapest first (there is no "Featured" order: offers have no order hint). Fine?
- `dedupeByAnchors` hides the existing-customer offer (`malva-offer-cable-existing-customer`, $49.99) even for existing customers; it stays reachable by `?offer=`. Should an existing customer see the cheaper offer instead of Cable 500?

## Missed features and deviations
See "Implementation notes" in the workstream file. In short: H's chip ids (`1-gbps`, not `gig`); only `price-asc`/`price-desc`; offers through K's `getVisibleOffers*`; no compatibility pre-call (M's cart route re-checks, adds required equipment and returns the replace target); M's `ConfirmDialog` and `BlockedAddNotice` reused instead of a new `ConfirmReplace` dialog; new message keys only inside `plp`/`offers` (add-on card keys `offers.addon.*`); no `loading.tsx` (it made 404 and redirects stream as 200); header shows roots only, so child categories are linked from the title strip ("Browse by type"); `aria-busy` while the bundle loads is not set; no price facet or availability indicator (D-019).

## TODOs for other workstreams
- O/P/Q: build links with `offerHref` / `offerPath` / `categoryPath` (`lib/listing/links.ts`); P can reuse `Pagination` (props `page`, `pageCount`, `basePath`, `query`); Q replaces `DeviceListingSlot` in `components/offers/OfferGrid.tsx` (devices branch).
- M: `CartLine` of kind `fee` has `parentLineId`; N excludes it from add-on counts. M's "Change" link `/shop/add-ons?for=<lineId>` is honoured by the add-on card.
- G/H: demo copy: live highlights ("100 Mbps download", ...) are used as bullets.

## Findings
- Fee lines (custom line items) carry `parentLineId`; counting dependents without excluding `kind: 'fee'` produced "2 add-ons" for one add-on.
- A `loading.tsx` in a dynamic route makes Next send 200 before `notFound()`/`redirect()`; removed.
- Page HTML is about 155 KB because every card receives its `Offer` and the shared add-on/equipment list once; acceptable.

## Manual tests added
None.

## Junior design choices
Sort control (pill select left of the count); picker rows (muted disabled row with reason text, "Included" with check); needs-plan state of the add-on card ("Needs a plan", reason and "Choose a plan" link); term pills as radios, disabled while the plan is selected; empty and no-match panels; "Browse by type" pills in the title strip; device cards (name and lowest prices, no actions) until Q.

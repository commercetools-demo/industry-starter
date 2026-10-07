# Workstream K report (exclusivity, eligibility, serviceability, holdings)

Branch `ws/k-exclusivity-eligibility-serviceability-holdings`. Live reads ran against `spec-test-b2c-telecom` (storefront client, read-only) through a dev server on port 3117.

## Done
K-01 … K-12, all ticked. `npm run verify` passes. All 12 scenario rows have tests named after the scenario titles (`lib/offers/exclusivity.test.ts`, `holdings.test.ts`, `eligibility.test.ts`, `serviceability.test.ts`, `revalidate.test.ts`, `lib/ct/visible-offers.test.ts`, `app/api/serviceability/route.test.ts`). `node plan/verify-plan.mjs` reports 0 uncovered scenarios; its only complaint is STATUS counts (orchestrator runs `--sync`).

Live checks run by curl against the dev server: C-K-1 (checkedAt cached), C-K-2 (all seeded ZIPs, US and DE), C-K-3 (400 codes, ZIP+4), C-K-4 (cookie `HttpOnly; SameSite=lax; Max-Age=2592000`, clear with `Max-Age=0`, 405 for PUT), C-K-5, C-K-6, C-K-7 (see Findings for the differing data). Browser-based reruns of the same URLs not done.

## Not done / blocked
Nothing. C-K-9, C-K-10, C-K-11 need M, R, U (a session cart / signed-in customer); C-K-12 live part needs a cart with a conflict (unit tested: `override: true` stays unavailable and nothing is written).

## Questions for the owner
None.

## Missed features and deviations
- **J already reports cart conflicts.** J's `planCandidateVerdict` emits `EXCLUSIVE_CONFLICT` plus `replaces` for cart lines, so `mergeVerdicts(J, exclusivityVerdict)` doubled them. Added `dedupeVerdict` (exported from `lib/offers/exclusivity.ts`) and the route uses `dedupeVerdict(mergeVerdicts(...))`; the route test asserts exactly one reason. `exclusivityVerdict` itself is complete on its own (M may call it directly).
- `HELD_SERVICE_CONFLICT` and `revalidateExclusivity` held reasons carry an extra param `reference` (order number or recurring order id) next to `candidateName` / `otherName`; the ICU message ignores it.
- `getBuyerContext(market?)` keys React `cache` on the market locale (a primitive), so one resolution per request and locale. The market also decides which catalog (names of held offers) is read. When called without a market it uses en-US.
- `getCustomerGroupKeys` lives in `lib/ct/customer-groups.ts` and is re-exported from `buyer-context.ts`. A customer has ONE `customerGroup` live and an empty `customerGroupAssignments`; both are read.
- `getHoldings` reads raw orders and recurring orders through a per-request `cache(customerId)` and derives with the catalog map after, so the object argument does not break the cache key.
- Serviceability route: errors use the literal codes `INVALID_POSTAL_CODE`, `INVALID_COUNTRY` and `INVALID_REQUEST` (bad POST body) in the standard `{ error: { code, message } }` envelope; they are not `ApiErrorCode`s (same approach as J's `OFFER_RULE_VIOLATION`). `GET` without `postalCode` reads the cookie from the request `Cookie` header.
- `lib/ct/serviceability.ts` also exports `stubModeFromEnv` and `resetServiceabilityForTests`. `.env.example` now says `SERVICEABILITY_STUB=table` (values `table|all|none`; the old line said `true`, which also falls back to `table`).
- Messages: new top-level namespace `serviceability` (en-US and de-DE); `messages/parity.test.ts` top-level list gained `serviceability`. `lib/offers/messages.test.ts` renders both ICU `select` branches through next-intl `createTranslator`.
- `describeAvailability` is implemented in `serviceability.ts` and re-exported from `eligibility.ts` (the plan lists it under eligibility).
- The serviceability stub is the plan's built-in table. G's `lib/offers/serviceability-table.json` (Custom Objects, different ZIPs, key `phone`) is NOT used; the Custom Objects exist live but nothing reads them.
- Dev view: `GET /api/dev/catalog?view=visible` lives in `route.dev.ts` (H's convention); extra overrides produce 400 `INVALID_POSTAL_CODE` / `INVALID_CUSTOMER_TYPE` / `INVALID_NOW`; without `category` it covers the whole catalog.
- Not edited (stay with their owners): M's cart code, N/O/P pages. They must call the K functions listed below.

## TODOs for other workstreams
- **M:** on every cart read call `getBuyerContext(market)` then `revalidateCart({ lines, offersByKey, buyer })` and return `issues`; before an add call `evaluateAddition` (J), `exclusivityVerdict(candidate, cartLines, buyer.held, offersByKey)` (K), `evaluateEligibility` (K) and merge with `dedupeVerdict(mergeVerdicts(...))` (or reuse the route logic); "Replace X with Y" removes `replacementPlan(cart, lineItemId).removeIds` then adds the new plan; show the localized `offers.reason.*` message of each reason.
- **N / O / P:** read offers only through `getVisibleOffers`, `getVisibleOffersInCategory`, `getVisibleOfferByKey` (`lib/ct/visible-offers.ts`); P applies `filterEligible(result.offers, buyer)` (buyer from `getBuyerContext`) and subtracts the removed count from `total`; show `serviceability.notServed` / `serviceability.partial` from `availability.state`; the ZIP control calls `POST /api/serviceability` and reads the remembered ZIP with `GET /api/serviceability?country=US` (the cookie is HttpOnly).
- **U:** refuse a checkout session while `revalidateCart(...)` returns issues.
- **Orchestrator:** `node plan/verify-plan.mjs --sync`.

## Findings
Recorded in `plan/PROJECT-FINDINGS.md` under `## K — holdings and customer groups`. Live facts: order lines carry `productKey` = offer key and the `offerKey` custom field; the recurring-orders query with `expand: ['cart']` works with the storefront client (scope present); demo customers have one Customer Group each and no assignments; no seeded offer has a schedule or audience, so those rules are unit-tested only. Differences from the C-K lines: C-K-6 phone plans anonymously returns **5** offers (Essential, Plus, Unlimited, Unlimited Max, online-only), `customerType=employee` changes nothing; C-K-7 `now` overrides change nothing (no scheduled offer; `hiddenCount` stays 1 for the existing-customer offer); C-K-5 cable at 10001 anonymously shows Cable 100, 500 and Gig (hidden 1), with `existing=1` the existing-customer offer joins. `malva-cat-add-ons` at 59001 keeps Spotify, Apple Music, Cloud 200 and Device Care.

## Manual tests added
None.

## Junior design choices
None (no UI).

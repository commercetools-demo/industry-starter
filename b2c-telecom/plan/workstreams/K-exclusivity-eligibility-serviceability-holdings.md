# K — Exclusivity and eligibility: serviceability, holdings

**Specs:** `mutually-exclusive-offers` (all 6 scenarios), `eligibility-gated-offer` (all 6 scenarios). Rules, server reads and the shared "visible offers" resolution. Pages that show the results (listing, search, bundle, checkout banners, the ZIP-entry control) are built by N, O, P, M, U which **must** call the functions defined here; this file says which. J built the symmetric pair check (`conflictBetween`) and the plan-candidate conflict verdict; K adds the cart-wide, held-service, revalidation and replacement logic on top.
**Depends on:** E, H, J · **Unblocks:** M, X · **Decisions:** D-004, D-005, D-016, D-020, D-021, D-022, D-024, D-058, D-059
**Owner prerequisites:** none for unit tests; OA-02 for live checks (the client needs `view_recurring_orders` and customer/order read scopes, already in OA-02's list) · **Skill refs:** `commercetools-commerce-patterns` (eligibility, exclusivity), `commercetools-storefront` (session, orders), `commercetools-platform`

## Goal
One resolution of "what may this buyer buy, and where" (customer type, existing-customer, sales channel, offer schedule, service location, services already held) is applied identically to browse, search, direct links, add-to-bundle and checkout; conflicts between offers are detected symmetrically against the bundle and against held services; losing eligibility between add and checkout keeps the line, flags it and blocks checkout until the buyer removes it.

## Design

### 1. Answers to the open questions (all Planner defaults unless a D-id is given)
| Question (spec) | Answer |
| --- | --- |
| Which system answers serviceability; cache time? | A **built-in deterministic stub** behind an interface (D-020): seeded ZIP table, cached **5 minutes** (`SERVICEABILITY_TTL` = 300 s). The cache is an in-memory TTL map per server instance (the stub is deterministic, so a lost cache only costs a lookup). A "yes" is never kept longer than 300 s. |
| Which system is authoritative for held services; how fast is it read? | commercetools **orders and recurring orders** of the signed-in customer (D-021). Read per request (2 queries, at most 100 orders and 100 recurring orders, newest first) only for signed-in buyers; **not cached across requests** (session-specific data is never cached, ARCHITECTURE); deduplicated within a request with React `cache()`. Anonymous visitors hold nothing. |
| Overridable by an agent / approval? | **No, absolute** for every conflict and eligibility failure (D-022); no override argument exists in any function or route (test). |
| Conflict between an offer and its own replacement, customers mid-term? | Conflicts are evaluated only when something is **added** or the cart is revalidated. A customer already on the old tariff is not changed or flagged retroactively; if they try to add the new tariff the held-service conflict is reported (`HELD_SERVICE_CONFLICT`) and they cannot add it (the replacement of a held service is a change-of-plan flow, out of scope: D-040 "No plan changes"). |
| How coarse may the catalog scope be? | No Stores and no Product Selections (D-058): the scope is **resolved in code per request** from the buyer context, not from commercetools structures; the catalog stays one shared cached list (H). |
| Eligibility lost between cart and checkout: line dropped, repriced or held? | **Line kept, flagged blocking with the reason; checkout is disabled until the buyer removes it** (`CartIssue`, `resolution: 'remove'`). Nothing is silently removed or repriced; the explanation is the reason's localized message. |
| Customer type for someone who has not signed in? | **`consumer`**, not an existing customer, channel `online`. |
| Which customer type for a signed-in buyer? | From the customer's **Customer Groups** (D-058): `employee` wins over `small-business` wins over `consumer`; none of them: `consumer`. Group `existing-customer`, **or** holding at least one active service (D-021), makes `isExistingCustomer = true`. |
| Sales channel | The storefront is one channel with key **`online`** (`SALES_CHANNEL` constant in `lib/config/eligibility.ts`); an offer whose `channels` list is non-empty and does not contain `online` is not sold here. |
| Unknown ZIP | The stub (mode `table`, default) answers **served on every technology** for a well-formed ZIP that is not in the table (optimistic demo behaviour, documented); the seeded table holds the demonstration cases (§4). |

### 2. Types appended to `lib/types.ts` (section `// ===== K: eligibility and exclusivity =====`)
```ts
export type CustomerType = 'consumer' | 'small-business' | 'employee';
export interface ServiceLocation {
  postalCode: string; country: CountryCode;
  served: Record<Technology, boolean>;                    // cable, fixed-wireless, mobile
  anyServed: boolean; checkedAt: string;                  // ISO time of the (cached) answer
}
export interface HeldService { offerKey: string; offerName: string; source: 'order' | 'recurring-order'; reference: string /* order number or recurring order id */ }
export interface BuyerContext {                           // server-side only (contains Date), never serialized to the client
  customerType: CustomerType; isExistingCustomer: boolean; channel: string; now: Date;
  location?: ServiceLocation; held: HeldService[]; signedIn: boolean;
}
export interface ConflictFinding {
  source: 'cart' | 'held'; candidateKey: string; otherKey: string; otherName: string;
  lineItemId?: string; reference?: string; declaredBy: 'candidate' | 'other' | 'both';
}
export type AvailabilityState = 'no-location' | 'served' | 'partially-served' | 'not-served';
```
Reason codes for K already exist in J's `ReasonCode` union: `HELD_SERVICE_CONFLICT`, `NOT_ELIGIBLE_AUDIENCE`, `NOT_ELIGIBLE_EXISTING_CUSTOMER`, `NOT_ELIGIBLE_CHANNEL`, `NOT_STARTED`, `ENDED`, `NOT_SERVICEABLE` (and `EXCLUSIVE_CONFLICT`). `Reason`, `CartIssue`, `CartLineRef`, `CompatVerdict` come from J.

### 3. Files
| Path | Contents |
| --- | --- |
| `lib/config/eligibility.ts` | `SALES_CHANNEL = 'online'`, `POSTAL_COOKIE = 'malva-postal-code'`, `POSTAL_COOKIE_MAX_AGE = 2592000` (30 days), group keys, `CUSTOMER_TYPE_PRIORITY` |
| `lib/config/cache.ts` | **append** `CUSTOMER_GROUPS_TTL = 300` (H owns the file) |
| `lib/offers/exclusivity.ts` | `findConflicts`, `exclusivityVerdict`, `revalidateExclusivity`, `replacementPlan` |
| `lib/offers/eligibility.ts` | `evaluateEligibility`, `filterEligible`, `resolveVisibleOffer`, `describeAvailability`, `revalidateCartEligibility`, `customerTypeFromGroups` |
| `lib/offers/serviceability.ts` | `normalizePostalCode`, `createStubProvider`, `createCachedServiceability`, `SEEDED_ZIPS`, `ServiceabilityProvider` |
| `lib/offers/holdings.ts` | `deriveHoldings` (pure) |
| `lib/offers/revalidate.ts` | `revalidateCart` (J compat + K exclusivity + K eligibility, one issue per line) |
| `lib/ct/serviceability.ts` | server-only singleton `getServiceability()` (env `SERVICEABILITY_STUB`) |
| `lib/ct/holdings.ts` | server-only `getHoldings(customerId, offersByKey)` |
| `lib/ct/buyer-context.ts` | server-only `getBuyerContext()` (React `cache`), `getCustomerGroupKeys()` |
| `lib/ct/visible-offers.ts` | server-only `getVisibleOffers(market)`, `getVisibleOffersInCategory(categoryKey, market)`, `getVisibleOfferByKey(key, market)` |
| `app/api/serviceability/route.ts` | `GET`, `POST` |
| `app/api/offers/compatibility/route.ts` | **append-only edit** of J's file (holdings, exclusivity, eligibility) |
| `app/api/dev/catalog/route.ts` | **append-only edit** of H's file: `view=visible` (dev only) |
| `messages/*.json` | reason and serviceability keys (§9) |
`lib/offers/*` stays pure (no I/O, no `lib/ct` imports).

### 4. Serviceability (`lib/offers/serviceability.ts`, D-020)
```ts
export interface ServiceabilityProvider { check(postalCode: string, country: CountryCode): Promise<Pick<ServiceLocation, 'postalCode' | 'country' | 'served' | 'anyServed'>>; }
export function normalizePostalCode(raw: string, country: CountryCode): string | null;
// trims; US: 5 digits or ZIP+4 (12345-6789 becomes 12345); DE: exactly 5 digits; anything else (letters, 4 or 6 digits, empty) gives null
export type StubMode = 'table' | 'all' | 'none';
export function createStubProvider(mode: StubMode): ServiceabilityProvider;
export function createCachedServiceability(provider: ServiceabilityProvider, ttlSeconds: number, now?: () => number): { check(rawPostalCode: string, country: CountryCode): Promise<ServiceLocation> };   // key `${country}:${postalCode}`; `checkedAt` = time the provider was called
```
Seeded table (`SEEDED_ZIPS`, key = country + ZIP; `c` = cable, `w` = fixed-wireless, `m` = mobile):
| Country | ZIP | Place (demo) | Served |
| --- | --- | --- | --- |
| US | 10001 | New York | c w m |
| US | 94105 | San Francisco | c w m |
| US | 60601 | Chicago | c m (no wireless) |
| US | 73301 | Austin | w m (no cable) |
| US | 59001 | rural Montana | m only (phone plans only) |
| US | 99999 | not served | none |
| DE | 10115 | Berlin | c w m |
| DE | 80331 | München | c m |
| DE | 01067 | Dresden | w m |
| DE | 99998 | not served | none |
Modes: `table` (default; a ZIP not in the table is served on all three), `all`, `none` (everything unserved). `anyServed = served.cable || served['fixed-wireless'] || served.mobile`.
- `describeAvailability(location?: ServiceLocation): { state: AvailabilityState; technologies: Technology[] }`: no location `no-location`; none served `not-served` ("Location not served at all": the UI states the location is not served instead of rendering an empty catalog; message `serviceability.notServed`); some but not all `partially-served`; all `served`.
- `lib/ct/serviceability.ts`: `export function getServiceability()` builds the singleton `createCachedServiceability(createStubProvider(mode), SERVICEABILITY_TTL)` once per process; `mode` from `process.env.SERVICEABILITY_STUB` (`table` | `all` | `none`, anything else or unset = `table`).
- Cookie: the remembered location is `malva-postal-code=<ZIP>` (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000`, `Secure` when `NODE_ENV=production`); the country comes from the market (D-004), never from the cookie.
- `GET /api/serviceability?postalCode=10001&country=US` (`country` optional, `US` default; must be `US` or `DE`): `200 { "location": ServiceLocation }`; invalid ZIP `400 { "error": { "code": "INVALID_POSTAL_CODE", "message": "…" } }`; invalid country `400 { "error": { "code": "INVALID_COUNTRY", … } }`. **Without** `postalCode` it returns the remembered location (`{ "location": ServiceLocation | null }`, country from `country` param). No cookie is written by `GET`.
- `POST /api/serviceability` body `{ "postalCode": "10001", "country": "US" }`: validates, answers like `GET`, and **sets** the cookie; `{ "postalCode": null }` clears it (`Max-Age=0`) and answers `{ "location": null }`. (ARCHITECTURE lists only `GET`; `POST` is added here, in K's own file, for the ZIP-entry control built in N/M.) Other methods: `405`.
- The cart is re-resolved against the new ZIP on the next cart read: M calls `revalidateCart` with `getBuyerContext()` (K) every time it reads the cart; the ZIP is **not** stored on the cart as authoritative state (the `malva-cart` custom fields are informational, written by M at order time).

### 5. Eligibility (`lib/offers/eligibility.ts`) — one function for every surface
```ts
export function evaluateEligibility(offer: Offer, buyer: BuyerContext): { eligible: boolean; reasons: Reason[] };
export function filterEligible(offers: Offer[], buyer: BuyerContext): Offer[];
export function resolveVisibleOffer(offersByKey: Record<string, Offer>, key: string, buyer: BuyerContext): { offer: Offer | null; reasons: Reason[] };
export function customerTypeFromGroups(groupKeys: string[]): CustomerType;
export function revalidateCartEligibility(lines: CartLineRef[], offersByKey: Record<string, Offer>, buyer: BuyerContext): CartIssue[];
```
Rules, all collected (first = primary), in this order:
| # | Rule | Fails when | Code | Params |
| --- | --- | --- | --- | --- |
| 1 | Audience | `offer.audience` non-empty and `buyer.customerType` not in it | `NOT_ELIGIBLE_AUDIENCE` | offerName |
| 2 | Existing customer | `existingCustomer === 'existing'` and not `isExistingCustomer`; or `'new'` and `isExistingCustomer` | `NOT_ELIGIBLE_EXISTING_CUSTOMER` | offerName, rule (`existing` or `new`) |
| 3 | Channel | `offer.channels` non-empty and does not contain `buyer.channel` | `NOT_ELIGIBLE_CHANNEL` | offerName, channel (the buyer's), allowed (comma list) |
| 4 | Schedule | `startTime` set and `buyer.now < startTime`; `endTime` set and `buyer.now >= endTime` | `NOT_STARTED` / `ENDED` | offerName |
| 5 | Serviceability | only when `buyer.location` is set: see below | `NOT_SERVICEABLE` | offerName, postalCode |
Serviceability applies per offer kind: `base-package`/`bundle` with `facts.kind === 'plan'`: not served when `location.served[facts.technology] === false`; add-on: not served when **every** family in `appliesToFamilies` is unserved (family `internet` is served when cable or fixed-wireless is; `phone` when mobile is); equipment: family `internet`; device: family `phone`. **No location set means "not gated"** (the catalog is shown with a prompt for the ZIP; checkout still requires an address, M/U).
- "Ineligible offer absent not refused": `filterEligible` removes ineligible offers; `resolveVisibleOffer` returns `{ offer: null, reasons }` so a direct link (`?offer=<key>`, search hit, bundle prompt) resolves to nothing visible and the recorded reason is the rule that failed. The channel reason is always recorded (`NOT_ELIGIBLE_CHANNEL`, "Channel restricted offer"). The compatibility route (J) answers an ineligible candidate with `unavailable` and these reasons for crafted requests; the UI never offers it.
- `customerTypeFromGroups(keys)`: contains `employee` then `employee`, else `small-business`, else `consumer`.
- `revalidateCartEligibility`: for each cart line whose offer is missing from the catalog: `OFFER_NOT_FOUND`, resolution `remove`; otherwise `evaluateEligibility(offer, buyer)`; ineligible gives a blocking `CartIssue` with `resolution: 'remove'`. **Eligibility lost before checkout** and **Location changes mid session** both use this function (the second with a new `buyer.location`).
- Pure shared surface function for all server pages — `lib/ct/visible-offers.ts` (server-only):
  ```ts
  export async function getVisibleOffers(market: Market): Promise<{ offers: Offer[]; buyer: BuyerContext; availability: { state: AvailabilityState; technologies: Technology[] } }>;
  export async function getVisibleOffersInCategory(categoryKey: string, market: Market): Promise<{ offers: Offer[]; buyer: BuyerContext; availability: … }>;
  export async function getVisibleOfferByKey(key: string, market: Market): Promise<Offer | null>;
  ```
  They call H's cached reads and then `filterEligible` with `getBuyerContext()`; **N (listings), O (home), P (search results: apply `filterEligible` to `searchOffers().offers` and subtract the removed count from `total`), M (bundle prompts) must read offers through these**, never through H directly. A buyer-specific list is never cached.

### 6. Buyer context (`lib/ct/buyer-context.ts`, server-only, per request)
`getBuyerContext = cache(async (): Promise<BuyerContext>)`:
1. `session = await getSession()` (`@/lib/ct/session`, E; needs `customerId?: string`).
2. Location: read cookie `malva-postal-code`, country from the current market (D's market helper passed in by callers via `getBuyerContext(market)`; default `marketFromLocale('en-US')` when called without; signature `getBuyerContext(market?: Market)` with the argument included in the cache key by passing primitives) and `getServiceability().check(zip, country)`; invalid cookie value is ignored.
3. Anonymous: `{ customerType: 'consumer', isExistingCustomer: false, held: [], signedIn: false, channel: SALES_CHANNEL, now: new Date(), location }`.
4. Signed in: `apiRoot.customers().withId({ ID: customerId }).get()` → group ids = `customer.customerGroup?.id` plus `customer.customerGroupAssignments[].customerGroup.id`; map ids to keys with `getCustomerGroupKeys()` (`apiRoot.customerGroups().get({ queryArgs: { limit: 100 } })`, cached `unstable_cache` `CUSTOMER_GROUPS_TTL`, JSON object id to key); `customerType = customerTypeFromGroups(keys)`; `held = await getHoldings(customerId, offersByKey)`; `isExistingCustomer = keys.includes('existing-customer') || held.length > 0`. A customer read failure: `console.error`, fall back to the anonymous context (never block browsing) but mark `signedIn: true`.
Pitfall: the file must not import `unstable_cache` and use the session in the same function: `getCustomerGroupKeys` (cached, session-free) lives in its own file `lib/ct/customer-groups.ts` so H's guard test (no file importing both `unstable_cache` and the session) stays green.

### 7. Holdings (`lib/offers/holdings.ts`, `lib/ct/holdings.ts`, D-021)
```ts
export interface HoldingOrder { orderNumber: string; orderState: string; offerKeys: string[] }
export interface HoldingRecurringOrder { id: string; state: string; offerKeys: string[] }
export function deriveHoldings(orders: HoldingOrder[], recurring: HoldingRecurringOrder[], offersByKey: Record<string, Offer>): HeldService[];
```
Rules: ignore orders with `orderState === 'Cancelled'` (V sets it) and recurring orders whose `state` is not `Active` or `Paused`; keep only offers whose catalog `kind` is `base-package` or `bundle` (the *service* lines: add-ons, equipment, devices do not hold a service for conflict purposes); offer keys not in the catalog are ignored; de-duplicate by `offerKey`, preferring the `recurring-order` source over `order`; output sorted by `offerKey`.
`lib/ct/holdings.ts` [SKILL: commercetools-storefront]: `getHoldings = cache(async (customerId, offersByKey) => HeldService[])`:
- Orders: `apiRoot.orders().get({ queryArgs: { where: 'customerId="<id>"', sort: 'createdAt desc', limit: 100 } })`; per line `offerKey = line.custom?.fields?.offerKey ?? line.productKey` (the order line copies the cart line's custom field and `productKey` is the offer product's key). The `customerId` comes from the signed session; strip `"` and `\` before interpolating into the predicate.
- Recurring orders: `apiRoot.recurringOrders().get({ queryArgs: { where: 'customer(id="<id>")', sort: 'createdAt desc', limit: 100, expand: ['cart'] } })`; lines = `recurringOrder.cart.obj.lineItems` (same key rule); state = `recurringOrderState`.
- Both wrapped by `withTimeout` (H). The result is **not** cached across requests (session data).
H-style spike in K-11 confirms the field names against the live project and records them in `PROJECT-FINDINGS.md`.

### 8. Exclusivity (`lib/offers/exclusivity.ts`, absolute for buyers, D-022)
```ts
export function findConflicts(candidate: Offer, cartLines: CartLineRef[], held: HeldService[], offersByKey: Record<string, Offer>): ConflictFinding[];
export function exclusivityVerdict(candidate: Offer, cartLines: CartLineRef[], held: HeldService[], offersByKey: Record<string, Offer>): CompatVerdict;
export function revalidateExclusivity(cartLines: CartLineRef[], held: HeldService[], offersByKey: Record<string, Offer>): CartIssue[];
export function replacementPlan(cartLines: CartLineRef[], replaceLineItemId: string): { removeIds: string[] };   // = J removalPlan: the replaced plan and its dependents
```
- `findConflicts`: conflicts are decided with J's `conflictBetween(candidate, other)` (**symmetric**: declared on either side, either add order, "Conflict is symmetric"). Checked against **every** cart line's offer (`source: 'cart'`, `lineItemId`) and every held service (`source: 'held'`, `reference`); `declaredBy` = `candidate` (candidate lists other), `other`, or `both`. An offer is never in conflict with itself (same key skipped).
- `exclusivityVerdict`: no findings: `allowed` and **no warning** (reasons empty: "Non conflicting offers coexist"). Cart findings: reason `EXCLUSIVE_CONFLICT` per finding (params candidateName, otherName; `offerKeys` [candidate, other]) and `replaces` = one `{ lineItemId, offerKey, offerName }` per cart finding ("Replacement offered as a choice": the UI offers "Replace X with Y" or "Keep X"; replacement removes the old line and its dependents via `replacementPlan`, then adds the new plan). Held findings: reason `HELD_SERVICE_CONFLICT` (params candidateName, otherName; the finding carries the order reference) and **no** `replaces` (the held service cannot be removed from the cart; the buyer can only keep their service and not add this offer). Status `unavailable` whenever any finding exists. The cart is never allowed to hold both.
- `revalidateExclusivity`: pairwise over all cart lines (`conflictBetween`); for each conflicting pair the **later line in cart order** gets a blocking issue (`EXCLUSIVE_CONFLICT`, `offerKeys` both, resolution `replace`); each cart plan that conflicts with a held service gets a blocking issue `HELD_SERVICE_CONFLICT`, resolution `remove`. This is "Conflict declared after the cart was built".
- Server call order for any add (M): `evaluateAddition` (J) then `exclusivityVerdict` (K) then eligibility: merged with `mergeVerdicts` (J): reasons concatenated, status worst-wins, `replaces` concatenated.

### 9. Combined revalidation (`lib/offers/revalidate.ts`)
```ts
export function revalidateCart(args: { lines: CartLineRef[]; offersByKey: Record<string, Offer>; buyer: BuyerContext }): CartIssue[];
```
= J `revalidateCartCompat` + K `revalidateExclusivity` + K `revalidateCartEligibility`, merged to **one issue per line item** (reasons concatenated; resolution precedence `remove` > `replace` > `choose-equipment`), cart order. M calls it on every cart read and returns `issues` in the mapped cart; U refuses to create a checkout session while `issues.length > 0` and shows each reason's message (this is how "Eligibility lost before checkout" and "Cart older than the rule" become "order not placed on the ineligible offer, change explained"; lines are **never** dropped or repriced automatically).

### 10. Append to J's route (`POST /api/offers/compatibility`)
After J's verdict: `buyer = await getBuyerContext(market)`; for the candidate: `mergeVerdicts(verdict, exclusivityVerdict(...))` (plan and bundle candidates only) and, when `!evaluateEligibility(candidate, buyer).eligible`, merge `unavailable` with those reasons. The response shape does not change. Tests extend J's `route.test.ts` (mocks `@/lib/ct/buyer-context`).

### 11. Message keys (both locales; J's reason keys are in J)
| Key | en-US | de-DE |
| --- | --- | --- |
| `offers.reason.HELD_SERVICE_CONFLICT` | You already have {otherName}, which can't be combined with {candidateName}. | Sie haben bereits {otherName}; das lässt sich nicht mit {candidateName} kombinieren. |
| `offers.reason.NOT_ELIGIBLE_AUDIENCE` | {offerName} isn't available for your account type. | {offerName} ist für Ihren Kontotyp nicht verfügbar. |
| `offers.reason.NOT_ELIGIBLE_EXISTING_CUSTOMER` | {rule, select, existing {{offerName} is for existing Malva customers.} other {{offerName} is for new customers only.}} | {rule, select, existing {{offerName} gilt nur für bestehende Malva-Kunden.} other {{offerName} gilt nur für Neukunden.}} |
| `offers.reason.NOT_ELIGIBLE_CHANNEL` | {offerName} isn't available in this sales channel. | {offerName} ist in diesem Vertriebskanal nicht verfügbar. |
| `offers.reason.NOT_STARTED` | {offerName} isn't available yet. | {offerName} ist noch nicht verfügbar. |
| `offers.reason.ENDED` | {offerName} has ended. | {offerName} ist beendet. |
| `offers.reason.NOT_SERVICEABLE` | {offerName} isn't available at {postalCode}. | {offerName} ist unter {postalCode} nicht verfügbar. |
| `serviceability.notServed` | We don't serve {postalCode} yet. | Unter {postalCode} sind wir noch nicht verfügbar. |
| `serviceability.partial` | Available at {postalCode}: {technologies}. | Verfügbar unter {postalCode}: {technologies}. |
| `serviceability.invalid` | Enter a valid ZIP code. | Bitte geben Sie eine gültige Postleitzahl ein. |
| `serviceability.tech.cable` / `.fixed-wireless` / `.mobile` | Cable internet / Home wireless / Phone | Kabel-Internet / Home Wireless / Mobilfunk |

### Pitfalls
- A stale "served" answer is the expensive direction: never extend 300 s; the cart is re-resolved on every read.
- The recurring-orders client scope (`view_recurring_orders`) is in OA-02; without it holdings fail with 403: `getHoldings` must catch a 403/404 from the recurring-orders call, log once, and continue with orders only (never fail the page).
- `customerGroupAssignments` is an array of references; ids are not keys, hence `getCustomerGroupKeys`.
- A signed-in buyer's visible list differs from an anonymous one: never put `getVisibleOffers` inside `unstable_cache` or `generateStaticParams`.
- Conflict keys come from plan attributes (product keys) and offer attributes (offer keys); always compare through J's `refersTo`.
- Plan lines carry their dependents (`parentLineItemId`); replacing a plan must remove the dependents too (`replacementPlan`), otherwise orphans appear.
- `buyer.now` is a parameter, never `Date.now()` inside a rule (tests and the dev route pass it).
- The ZIP cookie is `HttpOnly`: client code must learn the location from `GET /api/serviceability` (no params), not `document.cookie`.

## Tasks
- [x] K-01 Append the K section to `lib/types.ts`; create `lib/config/eligibility.ts`; append `CUSTOMER_GROUPS_TTL` to `lib/config/cache.ts`; add the §11 message keys to both files; tests `lib/offers/messages.test.ts` extended (every K reason code has en and de messages; ICU select renders both branches) and `lib/config/eligibility.test.ts`.
- [ ] K-02 Create `lib/offers/serviceability.ts` (normalization, `SEEDED_ZIPS`, stub modes, cached wrapper, `describeAvailability`) with `lib/offers/serviceability.test.ts` (fake clock: second call within 300 s hits the provider once and keeps `checkedAt`; at 301 s the provider is called again; each seeded ZIP; unknown ZIP in each mode; ZIP+4; invalid formats null).
- [ ] K-03 [SKILL: commercetools-storefront] Create `lib/ct/serviceability.ts` and `app/api/serviceability/route.ts` (`GET`, `POST`) with `route.test.ts` (Node env; 200 shapes, 400 `INVALID_POSTAL_CODE`/`INVALID_COUNTRY`, `POST` sets the cookie with `HttpOnly; SameSite=Lax; Max-Age=2592000`, `POST null` clears, `GET` without params returns the remembered location, `GET` writes no cookie, 405 for others).
- [ ] K-04 [SKILL: commercetools-commerce-patterns] Create `lib/offers/exclusivity.ts` with `lib/offers/exclusivity.test.ts` (every scenario of `mutually-exclusive-offers` plus: both directions, self, held vs cart, later-line flagging, replacement removes dependents, no override argument).
- [ ] K-05 Create `lib/offers/holdings.ts` with `lib/offers/holdings.test.ts` (cancelled orders ignored, paused and active recurring kept, expired ignored, only base-package/bundle kept, de-duplication prefers recurring, unknown keys ignored).
- [ ] K-06 [SKILL: commercetools-storefront] Create `lib/ct/holdings.ts` with `lib/ct/holdings.test.ts` (mock API root: orders predicate uses the sanitized id, line key from custom field then `productKey`, recurring orders read from the expanded cart, 403 on recurring orders degrades to orders only, `withTimeout` used, no cross-request cache).
- [ ] K-07 [SKILL: commercetools-commerce-patterns] Create `lib/offers/eligibility.ts` with `lib/offers/eligibility.test.ts` (each rule alone and combined; no location means not gated; every family case of serviceability; direct link returns null with the reason; `customerTypeFromGroups` priority; `revalidateCartEligibility`).
- [ ] K-08 Create `lib/offers/revalidate.ts` with `lib/offers/revalidate.test.ts` (one issue per line, reasons merged, resolution precedence, cart order kept, clean cart gives `[]`).
- [ ] K-09 [SKILL: commercetools-storefront] Create `lib/ct/customer-groups.ts`, `lib/ct/buyer-context.ts`, `lib/ct/visible-offers.ts` with tests (mock API root and `@/lib/ct/session`): anonymous context is consumer/not existing/channel online; signed-in groups map to type; `existing-customer` group or one held service sets existing; customer read failure falls back without throwing; `getVisibleOffers` removes ineligible offers and reports availability `not-served` for ZIP 99999; the groups map uses `unstable_cache` with `CUSTOMER_GROUPS_TTL` and no session import (H's guard test stays green).
- [ ] K-10 [SKILL: commercetools-storefront] Append K's checks to J's `app/api/offers/compatibility/route.ts` and extend `route.test.ts`: held-service conflict returns `HELD_SERVICE_CONFLICT` without `replaces`; cart conflict returns `replaces`; ineligible candidate is `unavailable` with its reason; response shape unchanged; no write.
- [ ] K-11 [SKILL: commercetools-platform] Append `view=visible` to H's dev route (`GET /api/dev/catalog?view=visible&locale=en-US&category=<key>&postalCode=<zip>&customerType=<type>&existing=1&now=<ISO>`; development only; the overrides replace the buyer context so Claude can demonstrate each rule without accounts; response `{ availability, offers: [{ key, name }], hiddenCount }`) with tests; run the live spike (needs OA-02, a seeded demo customer from F/G or R, ideally one test order): confirm the orders and recurring-orders queries, `customerGroupAssignments` and `productKey` on order lines; record in `PROJECT-FINDINGS.md` under `## K — holdings and customer groups`.
- [ ] K-12 Run `npm run verify`; `node plan/verify-plan.mjs --sync`; report the C-K lines.

## Unit tests (scenario → test)
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Second conflicting offer refused | `mutually-exclusive-offers` | `lib/offers/exclusivity.test.ts` → "Second conflicting offer refused: adding the wireless plan to a cart holding the cable plan is unavailable and names both offers" |
| Replacement offered as a choice | `mutually-exclusive-offers` | `lib/offers/exclusivity.test.ts` → "Replacement offered as a choice: the verdict carries a replaces entry for the cart line and replacementPlan removes it with its dependents" (UI choice rendered in M: C-M-*) |
| Conflict with a service already held | `mutually-exclusive-offers` | `lib/offers/exclusivity.test.ts` → "Conflict with a service already held: reported as HELD_SERVICE_CONFLICT against the held order, no replaces entry"; `lib/offers/holdings.test.ts` → "Conflict with a service already held: held services come from non-cancelled orders and active recurring orders" |
| Non conflicting offers coexist | `mutually-exclusive-offers` | `lib/offers/exclusivity.test.ts` → "Non conflicting offers coexist: two offers without a declared conflict give allowed and no reasons" |
| Conflict declared after the cart was built | `mutually-exclusive-offers` | `lib/offers/exclusivity.test.ts` → "Conflict declared after the cart was built: revalidation flags the later line with a blocking replace issue naming both" |
| Conflict is symmetric | `mutually-exclusive-offers` | `lib/offers/exclusivity.test.ts` → "Conflict is symmetric: declared on one offer only, detected in both add orders" |
| Catalog reflects the location | `eligibility-gated-offer` | `lib/offers/eligibility.test.ts` → "Catalog reflects the location: at a cable-only ZIP the wireless plans are filtered out and cable plans remain"; `lib/ct/visible-offers.test.ts` → "Catalog reflects the location: browse and search resolve through one filter" |
| Ineligible offer absent not refused | `eligibility-gated-offer` | `lib/offers/eligibility.test.ts` → "Ineligible offer absent not refused: an existing-customer-only offer is absent from the list and a direct key lookup returns null with the reason" |
| Channel restricted offer | `eligibility-gated-offer` | `lib/offers/eligibility.test.ts` → "Channel restricted offer: an offer limited to another channel does not resolve and NOT_ELIGIBLE_CHANNEL is recorded" |
| Location changes mid session | `eligibility-gated-offer` | `lib/offers/eligibility.test.ts` → "Location changes mid session: revalidating the same cart with a new location reports the unserved line before checkout" |
| Eligibility lost before checkout | `eligibility-gated-offer` | `lib/offers/revalidate.test.ts` → "Eligibility lost before checkout: the line is kept and flagged blocking with the reason and no line is dropped" |
| Location not served at all | `eligibility-gated-offer` | `lib/offers/serviceability.test.ts` → "Location not served at all: ZIP 99999 gives state not-served, not an empty catalog" and `app/api/serviceability/route.test.ts` → "Location not served at all: GET answers anyServed false" |

## Chrome verification (run by Claude)
Run on `npm run dev` with OA-02. Use `evaluate_script` with `fetch` from `http://localhost:3000/en-US` unless a URL is given; console clean; statuses as stated.
- C-K-1 (needs OA-02): `GET /api/serviceability?postalCode=10001&country=US` → 200, `location.served` all true, `anyServed: true`, `checkedAt` an ISO time; repeat immediately → the same `checkedAt` (cached within 5 minutes).
- C-K-2 (needs OA-02): ZIPs `60601` → cable true, fixed-wireless false, mobile true; `73301` → cable false, fixed-wireless true; `59001` → mobile only; `99999` → `anyServed: false`; with `country=DE`: `80331` → cable and mobile; `01067` → fixed-wireless and mobile; `99998` → none served.
- C-K-3 (needs OA-02): `postalCode=abc`, `1234`, `123456` → 400 `INVALID_POSTAL_CODE`; `country=FR` → 400 `INVALID_COUNTRY`; `10001-1234` → 200 with `postalCode: "10001"`.
- C-K-4 (needs OA-02): `POST /api/serviceability` `{ "postalCode": "60601", "country": "US" }` → 200 and DevTools Application shows cookie `malva-postal-code=60601`, HttpOnly, SameSite Lax, 30-day expiry; `GET /api/serviceability?country=US` → `location.postalCode` `60601`; `POST` with `{ "postalCode": null }` → cookie removed and `GET` returns `{ "location": null }`; `GET` with `postalCode` never sets a cookie.
- C-K-5 (needs OA-02, G, H): `http://localhost:3000/api/dev/catalog?view=visible&locale=en-US&category=malva-cat-cable-internet&postalCode=10001` → `availability.state` `served`, three cable offers (cable-100, cable-500, cable-gig) and not `malva-offer-cable-existing-customer`; with `&existing=1` that offer appears in addition; `category=malva-cat-home-wireless&postalCode=60601` → empty `offers`, `hiddenCount` 3; `postalCode=99999` on `category=malva-cat-phone-plans` → `availability.state` `not-served` (the message, not an empty success).
- C-K-6 (needs OA-02, G, H): `…&view=visible&category=malva-cat-phone-plans` (anonymous, no ZIP) → `availability.state` `no-location`, 4 phone offers including `malva-offer-phone-online-only` (channel `online` matches this storefront); `&customerType=employee` adds any offer seeded with audience `employee` (if none seeded, unchanged: record that no such offer exists).
- C-K-7 (needs OA-02, G, H): `…&view=visible&category=malva-cat-cable-internet&now=2000-01-01T00:00:00Z` → every offer with a `startTime` is absent (offers without one remain); `now=2100-01-01T00:00:00Z` → every offer with an `endTime` is absent. If no seeded offer has a schedule, note it; the unit tests cover the rule.
- C-K-9 (needs OA-02, G, H, M): with a real session cart holding the cable plan: `POST /api/offers/compatibility` `{ "offerKey": "malva-offer-wireless-5g" }` → `unavailable`, `EXCLUSIVE_CONFLICT`, `replaces` has the cable line id; with the wireless plan in the cart and candidate cable-500 → the same (symmetric); with candidate `malva-offer-phone-unlimited` and a cable plan in the cart → `allowed`, no reasons.
- C-K-10 (needs OA-02, G, H, M, R, U): signed in as the demo customer who has an order for `malva-offer-cable-500` (place it through U, or use the seeded demo order if F/G created one): empty cart, `POST /api/offers/compatibility` `{ "offerKey": "malva-offer-wireless-5g" }` → `unavailable`, `HELD_SERVICE_CONFLICT`, no `replaces`; anonymous (new incognito context) → `allowed`. The cart page shows the held-service message (C-M-*).
- C-K-11 (needs OA-02, G, H, M, U): eligibility lost: add `malva-offer-cable-existing-customer` as the existing demo customer, then sign out / switch to a new customer in the same cart (or use `existing=0` dev override) → cart read reports an issue for that line (blocking), the line is still listed, checkout button disabled (verified in C-M-*/C-U-*).
- C-K-12 (needs OA-02): `POST /api/offers/compatibility` with `"override": true` in an incompatible case stays `unavailable` (absolute, D-022).

## Manual tests (owner only)
None.

## Excluded
- Agent override of conflicts or eligibility (D-022; `agent-redemption-quota` deferred): every refusal is absolute; no scenario here depends on an agent.
- Business-unit/company entitlement and Stores/Product Selections as the eligibility mechanism (D-005, D-058): scope is resolved in code per request.
- A real serviceability or customer-record system, real billing/provisioning holdings (D-059): the stub and commercetools orders stand in.
- The ZIP-entry control, the bundle messages and the checkout block are UI in N, M, U (this file builds the rules and endpoints they call); scenarios here are tested at rule level.

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] All 12 scenario rows above have passing tests.
- [ ] J's compatibility route now includes holdings, exclusivity and eligibility; N/O/P/M contracts (`getVisibleOffers*`, `revalidateCart`, `getBuyerContext`) are exported with the names above.
- [ ] `PROJECT-FINDINGS.md` has `## K — holdings and customer groups`.
- [ ] C-K lines present; STATUS set to `Ready for review`.
- [ ] No file in `lib/offers/**` does I/O or imports `lib/ct/**`; no function accepts an override.

# J — Offer rules: compatibility, add-ons, required equipment

**Specs:** `configurable-offers-and-compatibility` (all 9 scenarios), `offer-compatible-addons` (all 6 scenarios). **Rules and engine only.** This workstream builds the pure TypeScript evaluation (`lib/offers/compat.ts`, `addons.ts`, `equipment.ts`), the parent-link rules, the required-equipment defaults, the cart revalidation function and `POST /api/offers/compatibility`. It renders nothing: the pickers on the plan card (disabled-with-reason choices, "Included" state, add-ons page) are built in **N**; writing the parent link on cart lines, cascading removal and blocking checkout are built in **M** and **U** using the functions defined here. Per the plan rules every scenario of both capabilities is mapped in this file's table with its rule-level test; each row repeats the note "UI rendering verified in N (C-N-*)" where a screen is involved.
**Depends on:** G, H · **Unblocks:** K, M, N, X · **Decisions:** D-010, D-016, D-022, D-024, D-025, D-026, D-021
**Owner prerequisites:** none for unit tests; OA-02 for the live checks · **Skill refs:** `commercetools-commerce-patterns` (bundles/compatibility), `commercetools-storefront` (child line items linked to a parent by a custom field)

## Goal
Given the cached catalog (H), any caller (card, BFF cart endpoint, tests, checkout) asks one shared pure function whether an add-on, equipment item or plan may be added, which parent line it attaches to, which equipment a plan needs by default, and which lines of an old cart no longer satisfy the rules; the answer carries machine-readable reasons with message keys in both languages.

## Design

### 1. Answers to the open questions (Planner defaults unless a D-id is given)
| Question (spec) | Answer |
| --- | --- |
| API Extension in addition to the BFF check? | **No** (D-024). The BFF cart endpoint (M) is the only way the browser changes the cart and it calls `evaluateAddition`; the rules are pure and shared by server and client. |
| Overridable by an agent? | **No, absolute** (D-022). There is no override parameter anywhere; the route ignores unknown body fields (test). |
| Authoritative system for held services; read at add time? | commercetools orders and recurring orders of the signed-in customer (D-021); read by K (`holdings.ts`) at add time for plan candidates. J only evaluates what the cart and catalog say. |
| Required equipment: selected, defaulted or automatic? | **Defaulted** to the cheapest compatible equipment of each required kind, auto-added together with the plan as separate lines that the buyer may change (D-025). |
| Narrowed compatible set: what happens to carts and to provisioned services? | Carts: `revalidateCartCompat` flags the now-incompatible line as a **blocking issue** (the reasons of the failing rule, resolution `remove`); the line stays in the cart until the buyer removes it and checkout stays disabled (U). Already purchased/provisioned services: **untouched** (orders are immutable; no retroactive action). |
| An add-on on more than one offer in one cart? | **One line per parent, any number of parents.** An add-on may be attached once to each compatible plan line; a second attach to the same parent is refused (`ALREADY_ATTACHED`). If more than one parent is eligible and the request names none, the answer is `AMBIGUOUS_PARENT` (the card/UI always names the parent). |
| Authoritative system for compatibility: catalog or provisioning? | The commerce catalog (this project); provisioning is out of scope (D-059). |
| Meaning of `compatible-addons` / `compatible-equipment` on an offer | Catalog says "exceptions only, computed rules win unless listed". **As built (corrects the earlier allow-list default, which contradicted the seed):** the lists are **positive exceptions**. A candidate listed on the plan offer skips the family, technology and speed rules (the seed lists Netflix on Unlimited Max although Netflix is internet-only). A declared exception (`incompatible-with`) and an included extra still win. `NOT_IN_COMPATIBLE_SET` does not exist. |
| Missing or mistyped attribute | **Fail closed**: a candidate whose deciding attribute is missing is `unavailable` with `CATALOG_DATA_INCOMPLETE` (never silently compatible); the catalog lint (J-09) reports the same data. |

### 2. Types appended to `lib/types.ts` (section `// ===== J: offer rules =====`)
```ts
export type ReasonCode =
  | 'SPEED_TOO_LOW' | 'TECHNOLOGY_MISMATCH' | 'FAMILY_MISMATCH' | 'ALREADY_INCLUDED'
  | 'DECLARED_INCOMPATIBLE' | 'NOT_IN_COMPATIBLE_SET' | 'EXCLUSIVE_CONFLICT'
  | 'CATALOG_DATA_INCOMPLETE' | 'OFFER_NOT_FOUND'
  | 'REQUIRED_EQUIPMENT_MISSING' | 'PARENT_REQUIRED' | 'AMBIGUOUS_PARENT' | 'ALREADY_ATTACHED'
  // used by workstream K (declared here once so nobody edits the union twice):
  | 'HELD_SERVICE_CONFLICT' | 'NOT_ELIGIBLE_AUDIENCE' | 'NOT_ELIGIBLE_EXISTING_CUSTOMER'
  | 'NOT_ELIGIBLE_CHANNEL' | 'NOT_STARTED' | 'ENDED' | 'NOT_SERVICEABLE';

export interface Reason {
  code: ReasonCode;
  messageKey: string;                                   // always `offers.reason.${code}`
  params: Record<string, string | number>;              // ICU params: planName, candidateName, otherName, max, needed, kind
  offerKeys: string[];                                  // the offers involved (plan first, then candidate / other)
}
export interface ReplaceTarget { lineItemId: string; offerKey: string; offerName: string }
export type VerdictStatus = 'allowed' | 'unavailable' | 'included';
export interface CompatVerdict {
  status: VerdictStatus;
  reasons: Reason[];                                    // empty when allowed; first element is the primary reason
  parentLineItemId?: string;                            // the plan line the add-on/equipment attaches to (cart mode)
  candidateParents?: string[];                          // present with AMBIGUOUS_PARENT
  replaces?: ReplaceTarget[];                           // present with EXCLUSIVE_CONFLICT: lines the buyer may replace (never absolute: buyer decides)
  requiredEquipment?: EquipmentSelection[];             // present when the candidate is a plan
}
export interface CartLineRef { lineItemId: string; offerKey: string; parentLineItemId?: string; quantity: number }
export type CartIssueResolution = 'remove' | 'replace' | 'choose-equipment';
export interface CartIssue { lineItemId: string; offerKey: string; blocking: true; resolution: CartIssueResolution; reasons: Reason[] }
export interface EquipmentSelection { kind: EquipmentKind; offerKey: string; variantSku: string; mode: 'rental' | 'purchase' }
export interface CandidateEntry { offer: Offer; verdict: CompatVerdict }
```
`CartIssue` is also used by K (eligibility and exclusivity issues) and consumed by M and U.

### 3. Files (all J's area)
| Path | Contents |
| --- | --- |
| `lib/offers/refs.ts` | `offerKeyForProduct(productKey)`, `refersTo(ref, offer)` |
| `lib/offers/compat.ts` | `evaluateCandidate`, `conflictBetween`, `evaluateAddition`, `buildCandidateList`, `mergeVerdicts`, `revalidateCartCompat` |
| `lib/offers/addons.ts` | parent-link rules (D-026): `planLinesOf`, `dependentsOf`, `removalPlan`, `findOrphans`, `dependentQuantity`, `attachmentFields` |
| `lib/offers/equipment.ts` | `compatibleEquipmentFor`, `defaultEquipment`, `missingRequiredEquipment` |
| `lib/offers/errors.ts` | `OfferRuleError`, `ruleErrorBody(verdict, offerKey)` |
| `lib/offers/lint.ts` | `lintCatalog(offers)` (catalog data lint) |
| `lib/ct/cart-context.ts` | server-only: `getCartLineRefs(cartId)` (read-only) |
| `app/api/offers/compatibility/route.ts` | `POST` |
| `scripts/lint-catalog.ts` | `npm run lint:catalog` (live read, uses H) |
| `messages/*.json` | `offers.reason.*` keys (appended) |
All `lib/offers/*` files contain **no I/O and no imports from `lib/ct/**`** (they are bundled into the client by N).

### 4. References (`lib/offers/refs.ts`)
Catalog attributes name other things inconsistently: plan `included-addons` and `conflicts-with`, equipment `incompatible-with` hold **product keys** (`malva-appletv`) or SKUs, while the offer attributes hold **offer keys** (`malva-offer-appletv`). One helper resolves both:
```ts
export const offerKeyForProduct = (productKey: string): string => `malva-offer-${productKey.replace(/^malva-/, '')}`;
export function refersTo(ref: string, offer: Pick<Offer, 'key' | 'anchors' | 'variants'>): boolean;
// true when ref === offer.key, ref is one of offer.anchors, ref === offerKeyForProduct(anchor) for an anchor, or ref equals one of offer.variants[].sku
```
Never compare keys with `===` outside this helper (test: `lib/offers/refs.test.ts`).

### 5. The rules (`evaluateCandidate(plan: Offer, candidate: Offer): CompatVerdict`)
Pure; `plan.facts.kind === 'plan'` and `candidate.facts.kind` is `addon` or `equipment`, otherwise `unavailable` with `CATALOG_DATA_INCOMPLETE`. Rules are evaluated in this order; **all** failing rules are collected into `reasons` (the first is primary) except that `included` short-circuits.
| # | Rule | Applies to | Fails when | Code | Params |
| --- | --- | --- | --- | --- | --- |
| 1 | Already included | add-on, equipment | `plan.includedOffers.some(r => refersTo(r, candidate))` | `ALREADY_INCLUDED` (status `included`, stop) | planName |
| 2 | Declared exception | equipment (`facts.incompatibleWith`) | any ref refers to the plan (`refersTo(ref, plan)`) | `DECLARED_INCOMPATIBLE` | planName, candidateName |
| 3 | Positive exception (as built) | add-on: `plan.compatibleAddons`; equipment: `plan.compatibleEquipment` | never fails: a listed candidate skips rules 4 to 6 | none | none |
| 4 | Family | add-on: `appliesToFamilies`; equipment: constant `['internet']` | `plan.facts.family` not in the set; empty set on an add-on is `CATALOG_DATA_INCOMPLETE` | `FAMILY_MISMATCH` | planName |
| 5 | Technology | equipment: `supportedTechnologies`; add-on: `appliesToTechnologies` only when non-empty | `plan.facts.technology` not in the set; equipment with an empty set is `CATALOG_DATA_INCOMPLETE` | `TECHNOLOGY_MISMATCH` | planName |
| 6 | Speed | equipment | `maxDownstreamMbps < plan.facts.downstreamMbps` (equal is allowed); either number missing gives `CATALOG_DATA_INCOMPLETE` | `SPEED_TOO_LOW` | max, needed, planName |
Result `status` = `included` | `unavailable` (any failure) | `allowed`. Phone plans have `technology: 'mobile'` (H), no downstream speed, and equipment is internet-only, so every equipment item on a phone plan fails rule 4 (`FAMILY_MISMATCH`); a phone-only add-on on an internet plan fails rule 4 too.

`conflictBetween(a: Offer, b: Offer): boolean` = `a.conflictsWith.some(r => refersTo(r, b)) || b.conflictsWith.some(r => refersTo(r, a))` (symmetric; K builds the full cart-wide, held-service and revalidation logic on top of this function).

### 6. Addition evaluation (`evaluateAddition`)
```ts
export interface AdditionInput {
  candidate: Offer;
  cart: CartLineRef[];                                  // current cart lines (empty in card mode)
  planOffer?: Offer;                                    // card mode: evaluate against this plan instead of the cart
  requestedParentLineItemId?: string;
  offersByKey: Record<string, Offer>;                   // the whole cached catalog by key
}
export function evaluateAddition(input: AdditionInput): CompatVerdict;
export function mergeVerdicts(a: CompatVerdict, b: CompatVerdict): CompatVerdict;   // K uses it: reasons concatenated, status = worst (unavailable > included > allowed)
```
- **Add-on or equipment candidate**, card mode: `evaluateCandidate(planOffer, candidate)`.
- **Add-on or equipment candidate**, cart mode: plan lines = cart lines whose offer `kind` is `base-package` or `bundle` (`planLinesOf`). No plan line: `unavailable`, `PARENT_REQUIRED`. For each plan line compute the verdict with `evaluateCandidate`; a plan line that already has a dependent line with `offerKey === candidate.key` is `unavailable` with `ALREADY_ATTACHED` (param planName). Eligible parents = lines with status `allowed`. If `requestedParentLineItemId` is given: it must be a plan line, else `unavailable` + `PARENT_REQUIRED`; the answer is that line's verdict (`parentLineItemId` set when allowed). Without a requested parent: exactly one eligible parent: `allowed` and `parentLineItemId` = it (**"Same add on different offer"**: the add-on lands on the offer that allows it, unambiguous); more than one: `unavailable` + `AMBIGUOUS_PARENT` + `candidateParents`; none eligible: if some plan line says `included` the verdict is `included`; else `unavailable` with the reasons of every plan line (each reason's `offerKeys[0]` is that plan's key) in cart order.
- **Plan candidate (`base-package`, `bundle`)** (card or cart mode): conflicts: every cart line whose offer `conflictBetween(candidate, thatOffer)` yields reason `EXCLUSIVE_CONFLICT` (params candidateName, otherName; `offerKeys` = [candidate, other]) and a `replaces` entry for that line, status `unavailable` regardless of which was added first. No conflict: `allowed`. Always also `requiredEquipment = defaultEquipment(candidate, allEquipmentOffers).selections`; if a required kind has no compatible equipment (`unfulfillable` non-empty) the plan is `unavailable` with `REQUIRED_EQUIPMENT_MISSING` (param kind) because it could not be provisioned.
- Device candidates (`device`) are not evaluated here (Q): return `allowed`.
- `buildCandidateList(plan: Offer, candidates: Offer[], attachedKeys: string[] = []): CandidateEntry[]` for the card (N): returns an entry for every candidate **except** those whose reasons include `FAMILY_MISMATCH` ("Add-on for another plan family": a phone-only add-on is not offered on an internet card); equipment that fails speed or technology **is** returned, `unavailable` with its reason (disabled and explained, never hidden); candidates in `attachedKeys` return `ALREADY_ATTACHED`; included ones return `included` (shown as "Included", not sellable). Order = input order.

### 7. Parent link and removal (`lib/offers/addons.ts`, D-026)
```ts
export function planLinesOf(lines: CartLineRef[], offersByKey: Record<string, Offer>): CartLineRef[];
export function dependentsOf(lines: CartLineRef[], parentLineItemId: string): CartLineRef[];
export function removalPlan(lines: CartLineRef[], lineItemId: string): { removeIds: string[]; dependentCount: number; requiresConfirmation: boolean };
export function findOrphans(lines: CartLineRef[]): CartLineRef[];                      // parentLineItemId set but no such line
export const dependentQuantity = (parentQuantity: number): number => parentQuantity;   // add-ons and equipment mirror the parent's quantity (phone plan quantity = number of lines, D-014)
export function attachmentFields(verdict: CompatVerdict, candidate: Offer): { offerKey: string; parentLineItemId: string };  // throws if verdict.status !== 'allowed' or no parent
```
The two custom fields live on custom type `malva-line-item` (ARCHITECTURE; created by G): `parentLineItemId` (the commercetools line item **id**, string) and `offerKey`. M writes them in the same cart update that adds the line (`addLineItem` + `setLineItemCustomField` in one batched update; if the parent line is itself being added in the same request the parent id is only known after the first update: M does it in two sequential updates inside one request). `removalPlan(lines, planLineId)` returns the plan id plus every dependent id (add-ons and equipment) and `requiresConfirmation: dependentCount > 0` (UI asks "Remove Cable 500 and its 2 add-ons?"; M's endpoint requires `confirmCascade: true` else 409). Removing an add-on line removes only itself. Pitfall: the id is the line item id, **not** the SKU, and it changes if the plan line is deleted and re-added (M must rewrite children in that case; not needed in v1 because removal cascades).

### 8. Required equipment (`lib/offers/equipment.ts`, D-025)
```ts
export function compatibleEquipmentFor(plan: Offer, equipmentOffers: Offer[]): Offer[];                       // status 'allowed' only
export function defaultEquipment(plan: Offer, equipmentOffers: Offer[]): { selections: EquipmentSelection[]; unfulfillable: EquipmentKind[] };
export function missingRequiredEquipment(plan: Offer, attachedEquipment: Offer[]): EquipmentKind[];            // kinds in plan.requiredEquipmentKinds with no attached compatible item of that kind
```
`defaultEquipment`: for each kind in `plan.facts.requiredEquipmentKinds` (attribute order): candidates = `compatibleEquipmentFor` of that `equipmentKind`; none: kind goes to `unfulfillable`. Pick the cheapest by the tuple `[hasRentalVariant ? 0 : 1, cheapest rental recurring centAmount (or cheapest one-time centAmount when no rental), offer key]` ascending; the chosen variant is the cheapest **rental** variant (the one with `recurringPrice`), `mode: 'rental'`; if the offer has no rental variant the cheapest `oneTimePrice` variant with `mode: 'purchase'`. The buyer may swap an auto-added line for another allowed item of the same kind (M validates with `evaluateAddition`). **`required-addon-kinds`**: value `equipment` is satisfied by the equipment rule above; value `installation` has no add-on type in the seeded model (`addon-kind` has only streaming/security/protection), so it is **ignored** (never blocks; the lint reports it as a warning). `missingRequiredEquipment` is what `revalidateCartCompat` and U use to block checkout.

### 9. Revalidation (`revalidateCartCompat`)
```ts
export function revalidateCartCompat(lines: CartLineRef[], offersByKey: Record<string, Offer>): CartIssue[];
```
For every line (all `blocking: true`): offer missing from the catalog (retired/unpublished): `OFFER_NOT_FOUND`, resolution `remove`; dependent line whose parent line is missing (orphan): `PARENT_REQUIRED`, `remove`; dependent line where `evaluateCandidate(parentOffer, offer)` is now `unavailable`: its reasons, `remove`; now `included` (the plan newly includes it): `ALREADY_INCLUDED`, `remove`; plan line where `missingRequiredEquipment` is non-empty: `REQUIRED_EQUIPMENT_MISSING` (param kind), resolution `choose-equipment`. Output order = cart order. This is the "cart older than the rule" and "compatibility changes after the cart was built" check; M calls it on every cart read and U calls it when checkout starts (checkout stays disabled while the list is non-empty). K adds exclusivity and eligibility issues to the same list.

### 10. Errors (`lib/offers/errors.ts`) — "Server re-checks what the card allowed"
```ts
export class OfferRuleError extends Error { constructor(readonly verdict: CompatVerdict, readonly offerKey: string) }
export function ruleErrorBody(verdict: CompatVerdict, offerKey: string): { error: { code: 'OFFER_RULE_VIOLATION'; message: string; details: { offerKey: string; reasons: Reason[]; candidateParents?: string[]; replaces?: ReplaceTarget[] } } };
```
M's cart endpoints call `evaluateAddition` before any write; when the verdict is not `allowed` they respond **409** with `ruleErrorBody(...)` and **do not write the cart** (version not bumped). `message` is the fixed English text `That choice isn't available for this plan.`; the card renders the localized text from `details.reasons[].messageKey` and `params`. If E's `ApiError` helper accepts a `details` field, build the body through it; otherwise return the literal JSON above.

### 11. Server read of the cart (`lib/ct/cart-context.ts`, read-only)
`import 'server-only'`. `getCartLineRefs(cartId: string): Promise<CartLineRef[]>`: `apiRoot.carts().withId({ ID: cartId }).get()`; each line: `lineItemId = line.id`, `offerKey = line.custom?.fields?.offerKey ?? line.productKey`, `parentLineItemId = line.custom?.fields?.parentLineItemId`, `quantity`. A 404 or a cart in state other than `Active` returns `[]`. No writes, no caching (session-specific). M's own `lib/ct/cart.ts` later may reuse it.

### 12. `POST /api/offers/compatibility` (`app/api/offers/compatibility/route.ts`)
- Request: `Content-Type: application/json`, body
  ```json
  { "offerKey": "malva-offer-router-ac1200", "planOfferKey": "malva-offer-cable-gig", "parentLineItemId": "optional", "locale": "en-US" }
  ```
  `offerKey` required (`^malva-offer-[a-z0-9-]+$`); `planOfferKey` optional: **card mode** (evaluate against that plan, no cart read); without it **cart mode** (cart id from the session, **never from the body**: ARCHITECTURE lists `cartId?` in the body; it is not accepted, a cart id supplied by the client is ignored so one buyer cannot probe another's cart); `locale` optional (`en-US` default, validated with `isLocale`, only selects the cached catalog market); unknown extra fields are ignored (there is no `override`).
- Responses: `200` `{ "offerKey": "...", "mode": "card" | "cart", "verdict": CompatVerdict }` (an unavailable verdict is still 200: it is an answer, not an error); `400` `{ "error": { "code": "INVALID_REQUEST", "message": "..." } }` for bad JSON/shape; `404` `{ "error": { "code": "OFFER_NOT_FOUND", "message": "..." } }` when `offerKey` or `planOfferKey` is not in the catalog (also when unpublished); `405` for other methods; `502` `{ "error": { "code": "UPSTREAM_UNAVAILABLE", "message": "..." } }` when the catalog read fails or times out.
- Implementation: `getAllOffers(marketFromLocale(locale))` (H, cached), `getCartLineRefs(session.cartId)` only in cart mode; `evaluateAddition`; no cart write ever; K later appends holdings and eligibility checks to this handler (an append-only edit, `mergeVerdicts`).
- Example (card mode) response for the seeded router that cannot carry the top tier:
  ```json
  { "offerKey": "malva-offer-router-ac1200", "mode": "card",
    "verdict": { "status": "unavailable", "reasons": [ { "code": "SPEED_TOO_LOW", "messageKey": "offers.reason.SPEED_TOO_LOW",
      "params": { "planName": "Cable Gig", "candidateName": "Malva WiFi 5 Router AC1200", "max": 300, "needed": 1000 },
      "offerKeys": [ "malva-offer-cable-gig", "malva-offer-router-ac1200" ] } ] } }
  ```

### 13. Catalog lint (`lib/offers/lint.ts`, `scripts/lint-catalog.ts`)
`lintCatalog(offers: Offer[]): { level: 'error' | 'warning'; offerKey: string; message: string }[]`: errors: internet plan without `downstreamMbps`; equipment without `maxDownstreamMbps` or with empty `supportedTechnologies`; add-on with empty `appliesToFamilies`; any reference in `includedOffers`, `conflictsWith`, `compatibleAddons`, `compatibleEquipment`, equipment `incompatibleWith` that refers to no offer in the catalog (`refersTo` against all offers); a conflict declared on one side only is a **warning** (the evaluation is symmetric but the data should be); warnings: plan `requiredAddonKinds` contains `installation`. `npm run lint:catalog` (script `tsx --conditions=react-server --env-file=.env.local scripts/lint-catalog.ts`) reads the live catalog through H and exits 1 on any error. Not part of `npm run verify` (needs network).

### 14. Message keys appended (both locales)
| Key | en-US | de-DE |
| --- | --- | --- |
| `offers.reason.SPEED_TOO_LOW` | Supports up to {max} Mbps; {planName} delivers {needed} Mbps. | Unterstützt bis zu {max} Mbit/s; {planName} liefert {needed} Mbit/s. |
| `offers.reason.TECHNOLOGY_MISMATCH` | Doesn't work with {planName}. | Funktioniert nicht mit {planName}. |
| `offers.reason.FAMILY_MISMATCH` | Not available for this kind of plan. | Für diese Tarifart nicht verfügbar. |
| `offers.reason.ALREADY_INCLUDED` | Already included with {planName}. | Bereits in {planName} enthalten. |
| `offers.reason.DECLARED_INCOMPATIBLE` | Not compatible with {planName}. | Nicht kompatibel mit {planName}. |
| `offers.reason.NOT_IN_COMPATIBLE_SET` | Not available with {planName}. | Mit {planName} nicht verfügbar. |
| `offers.reason.EXCLUSIVE_CONFLICT` | {candidateName} can't be held together with {otherName}. | {candidateName} kann nicht zusammen mit {otherName} gebucht werden. |
| `offers.reason.CATALOG_DATA_INCOMPLETE` | Temporarily unavailable. | Vorübergehend nicht verfügbar. |
| `offers.reason.OFFER_NOT_FOUND` | This item is no longer available. | Dieser Artikel ist nicht mehr verfügbar. |
| `offers.reason.REQUIRED_EQUIPMENT_MISSING` | {planName} needs a compatible {kind}. | {planName} benötigt ein kompatibles Gerät ({kind}). |
| `offers.reason.PARENT_REQUIRED` | Add a plan first. | Fügen Sie zuerst einen Tarif hinzu. |
| `offers.reason.AMBIGUOUS_PARENT` | Choose which plan to attach this to. | Wählen Sie, zu welchem Tarif das gehört. |
| `offers.reason.ALREADY_ATTACHED` | Already added to {planName}. | Bereits zu {planName} hinzugefügt. |
K appends the keys for its own codes.

### Pitfalls
- `refersTo` is the only comparison of references; seeds mix product keys and offer keys.
- Offers passed to client components must be plain JSON (H guarantees it); never import `lib/ct/**` from `lib/offers/**` (B's boundary check fails the build).
- A rule on a missing attribute must fail closed (a missing router speed silently makes it compatible with everything otherwise).
- The catalog cache window is 60 s (H `CATALOG_TTL`): a catalog edit changes verdicts after at most that long; tests use fixtures, never the clock.
- Cart mode must read the cart from the **session**; accepting a cart id from the body would be an IDOR.
- Equality counts: a 1000 Mbps router is compatible with a 1000 Mbps plan; the typical 940 Mbps figure is not used (the nominal `downstream-mbps` is).
- In German, `{max}` and `{needed}` use plain integers; do not format them with locale separators.

## Tasks
- [x] J-01 Append the J section to `lib/types.ts`; create `lib/offers/refs.ts`; add the `offers.reason.*` keys (§14) to both message files; tests `lib/offers/refs.test.ts` (product key vs offer key vs SKU vs anchor all resolve; unrelated key does not) and `lib/offers/messages.test.ts` (every `ReasonCode` that J defines has a key in both locales; K's codes are excluded until K).
- [x] J-02 [SKILL: commercetools-commerce-patterns] Create `lib/offers/compat.ts` with `evaluateCandidate`, `conflictBetween` and fixtures `lib/offers/__fixtures__/offers.ts` (typed `Offer` objects for every seeded plan, add-on and router of `seed-catalog-data`: cable-100/500/gig, wireless-lite/5g/5g-plus, phone-essential/plus/unlimited/unlimited-max, appletv, spotify, secure, device-protect, router-ac1200, router-ax3000, mesh-be9300, modem-docsis31, 5g-gateway, with `maxDownstreamMbps` 300/1000/2500/2000/500); tests `lib/offers/compat.test.ts` for rules 1-6 including fail-closed cases and the equality case.
- [x] J-03 [SKILL: commercetools-commerce-patterns] Add `evaluateAddition`, `mergeVerdicts`, `buildCandidateList` to `compat.ts`; tests for card mode, cart mode (single parent, two parents, ambiguous, requested parent, no plan, already attached, plan candidate conflicts both directions, required-equipment unfulfillable) in `lib/offers/compat.test.ts`.
- [x] J-04 [SKILL: commercetools-storefront] Create `lib/offers/addons.ts` with tests `lib/offers/addons.test.ts` (dependents, `removalPlan` for a plan with 2 dependents, removing an add-on removes only itself, orphans, quantity mirrors parent, `attachmentFields` throws for non-allowed).
- [x] J-05 [SKILL: commercetools-commerce-patterns] Create `lib/offers/equipment.ts` with tests `lib/offers/equipment.test.ts` (cheapest compatible per kind, tie-break by key, rental preferred, purchase-only fallback, none compatible lands in `unfulfillable`, `missingRequiredEquipment`).
- [x] J-06 Add `revalidateCartCompat` to `compat.ts` and create `lib/offers/errors.ts` with tests (`compat.test.ts`: narrowed set, newly included extra, orphan, retired offer, missing equipment; `errors.test.ts`: body shape and that `OfferRuleError` carries the verdict).
- [x] J-07 [SKILL: commercetools-storefront] Create `lib/ct/cart-context.ts` with `lib/ct/cart-context.test.ts` (mock API root: maps custom fields; falls back to `productKey`; 404 returns `[]`; no write method is called).
- [x] J-08 [SKILL: commercetools-storefront] Create `app/api/offers/compatibility/route.ts` with `route.test.ts` (Node environment; mock `@/lib/ct/catalog`, `@/lib/ct/session`, `@/lib/ct/cart-context`): card mode verdicts, cart mode uses the session cart and ignores a body `cartId`, 400/404/405/502 shapes, no cart write function is ever invoked, unknown `override` field ignored.
- [x] J-09 Create `lib/offers/lint.ts`, `scripts/lint-catalog.ts` and `npm run lint:catalog` with `lib/offers/lint.test.ts` (each error rule and the one-sided-conflict warning); run it live (needs OA-02) and record the output in `PROJECT-FINDINGS.md` under `## J — catalog lint`; if it reports errors, stop and tell the owner (data belongs to G).
- [x] J-10 Run `npm run verify`; `node plan/verify-plan.mjs --sync`; report the C-J lines.

## Unit tests (scenario → test)
Every row is rule-level here. "UI rendering verified in N (C-N-*)" where a screen shows the result.
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Equipment too slow for the plan | `configurable-offers-and-compatibility` | `lib/offers/compat.test.ts` → "Equipment too slow for the plan: AC1200 (300) on Cable Gig (1000) is unavailable with SPEED_TOO_LOW and max 300 / needed 1000" (UI rendering verified in N (C-N-*)) |
| Equipment unable to use the technology | `configurable-offers-and-compatibility` | `lib/offers/compat.test.ts` → "Equipment unable to use the technology: DOCSIS modem on Air 5G is unavailable with TECHNOLOGY_MISMATCH" (UI rendering verified in N (C-N-*)) |
| Add-on for another plan family | `configurable-offers-and-compatibility` | `lib/offers/compat.test.ts` → "Add-on for another plan family: Device Care is not in the candidate list of an internet plan card" (UI rendering verified in N (C-N-*)) |
| Included extra not sold again | `configurable-offers-and-compatibility` | `lib/offers/compat.test.ts` → "Included extra not sold again: Apple TV+ on Cable Gig has status included and ALREADY_INCLUDED" (UI rendering verified in N (C-N-*)) |
| Explicit exception overrides computed compatibility | `configurable-offers-and-compatibility` | `lib/offers/compat.test.ts` → "Explicit exception overrides computed compatibility: a router that would pass every computed rule but lists the plan in incompatible-with is DECLARED_INCOMPATIBLE" |
| Conflicting home internet services | `configurable-offers-and-compatibility` | `lib/offers/compat.test.ts` → "Conflicting home internet services: adding Air 5G with Cable 500 in the cart is refused naming both, with a replaces entry, whichever was added first" (full cart-wide and held-service resolution is K) |
| Server re-checks what the card allowed | `configurable-offers-and-compatibility` | `app/api/offers/compatibility/route.test.ts` → "Server re-checks what the card allowed: an incompatible offer returns the reasons and no cart write function is called" and `lib/offers/errors.test.ts` → "Server re-checks what the card allowed: ruleErrorBody carries code OFFER_RULE_VIOLATION and the reasons" |
| Catalog edit changes behaviour | `configurable-offers-and-compatibility` | `lib/offers/compat.test.ts` → "Catalog edit changes behaviour: raising the router max speed from 300 to 1000 makes it allowed on Cable Gig with no code change" and `app/api/offers/compatibility/route.test.ts` → "Catalog edit changes behaviour: a second request after the mocked catalog changes returns the new verdict" (cache window itself: H `lib/ct/catalog.test.ts`) |
| Cart older than the rule | `configurable-offers-and-compatibility` | `lib/offers/compat.test.ts` → "Cart older than the rule: a router whose speed was reduced is reported as a blocking issue with resolution remove" |
| Compatible add on accepted | `offer-compatible-addons` | `lib/offers/compat.test.ts` → "Compatible add on accepted: Spotify on Cable 500 is allowed and attachmentFields names the plan line" (priced line and rendering: M and N, C-N-*) |
| Incompatible add on refused | `offer-compatible-addons` | `lib/offers/compat.test.ts` → "Incompatible add on refused: an add-on outside the plan family is FAMILY_MISMATCH, not a generic failure" (UI rendering verified in N (C-N-*)) |
| Included extra not charged again | `offer-compatible-addons` | `lib/offers/compat.test.ts` → "Included extra not charged again: the included add-on is reported included, never allowed" (UI rendering verified in N (C-N-*)) |
| Add ons follow their parent | `offer-compatible-addons` | `lib/offers/addons.test.ts` → "Add ons follow their parent: removalPlan of the plan line returns the plan and every dependent, requiresConfirmation true" (cascade write in M: C-M-*) |
| Same add on different offer | `offer-compatible-addons` | `lib/offers/compat.test.ts` → "Same add on different offer: with a phone plan and an internet plan in the cart a streaming add-on for internet only attaches to the internet line and the parent is unambiguous" |
| Compatibility changes after the cart was built | `offer-compatible-addons` | `lib/offers/compat.test.ts` → "Compatibility changes after the cart was built: a dependent line no longer in the plan's compatible set is reported before checkout" |

Supporting tests required by the tasks (not scenario-bound): refs, equipment defaults (D-025), orphans, ambiguity, route validation, lint. UI rendering verified in N (C-N-*) and cart integration in M (C-M-*).

## Chrome verification (run by Claude)
API-level only; the screens are checked in N and M. From any page of the running app (for example `http://localhost:3000/en-US`, after D/I), use `evaluate_script` with `fetch('/api/offers/compatibility', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({...}) }).then(r => r.json())`; console clean; network shows one `POST` per call with status as stated. Offer keys follow `malva-offer-<product key without malva->`; prices are read from H's dev window `/api/dev/catalog` where needed.
- C-J-1 (needs OA-02, G, H): `{ "offerKey": "malva-offer-router-ac1200", "planOfferKey": "malva-offer-cable-gig" }` → 200, `verdict.status` `unavailable`, first reason `SPEED_TOO_LOW`, `params.max` 300, `params.needed` 1000.
- C-J-2 (needs OA-02, G, H): same plan with `malva-offer-router-ax3000` and with `malva-offer-mesh-be9300` → both `allowed` (1000 ≥ 1000, 2500 ≥ 1000).
- C-J-3 (needs OA-02, G, H): `{ "offerKey": "malva-offer-modem-docsis31", "planOfferKey": "malva-offer-wireless-5g" }` → `unavailable`, `TECHNOLOGY_MISMATCH`; `{ "offerKey": "malva-offer-5g-gateway", "planOfferKey": "malva-offer-cable-500" }` → `TECHNOLOGY_MISMATCH`; `{ "offerKey": "malva-offer-5g-gateway", "planOfferKey": "malva-offer-wireless-5g-plus" }` → `included` (the plan includes its gateway).
- C-J-4 (needs OA-02, G, H): `{ "offerKey": "malva-offer-device-protect", "planOfferKey": "malva-offer-cable-gig" }` → `unavailable`, `FAMILY_MISMATCH`; `{ "offerKey": "malva-offer-appletv", "planOfferKey": "malva-offer-phone-unlimited" }` → `FAMILY_MISMATCH`; `{ "offerKey": "malva-offer-router-ax3000", "planOfferKey": "malva-offer-phone-unlimited" }` → `FAMILY_MISMATCH`; `{ "offerKey": "malva-offer-secure", "planOfferKey": "malva-offer-cable-500" }` → `allowed`.
- C-J-5 (needs OA-02, G, H): `{ "offerKey": "malva-offer-appletv", "planOfferKey": "malva-offer-cable-gig" }` → `status: "included"`, `ALREADY_INCLUDED`; `{ "offerKey": "malva-offer-appletv", "planOfferKey": "malva-offer-cable-500" }` → `allowed`; `{ "offerKey": "malva-offer-spotify", "planOfferKey": "malva-offer-phone-essential" }` → `allowed`; the same add-on on `malva-offer-phone-unlimited` → `included`; `malva-offer-netflix` on `malva-offer-phone-unlimited-max` → `allowed` (positive exception) and on `malva-offer-phone-unlimited` → `FAMILY_MISMATCH`.
- C-J-6 (needs OA-02, G, H): plan candidate in cart mode with an empty session cart: `{ "offerKey": "malva-offer-cable-500" }` → `mode: "cart"`, `allowed`, `verdict.requiredEquipment` is `[]` because live cable plans include the DOCSIS modem (required kind `modem`) and wireless plans include the 5G gateway; the defaults logic for non-included kinds is covered by unit tests.
- C-J-7 (needs OA-02, G, H): `{ "offerKey": "malva-offer-appletv" }` (cart mode, empty cart) → 200 `unavailable`, `PARENT_REQUIRED`.
- C-J-8 (needs OA-02, G, H): error shapes: body `{}` → 400 `VALIDATION`; `{ "offerKey": "malva-offer-nope" }` → 404 `NOT_FOUND` (error codes are E's `ApiError` codes); GET on the path → 405; body with `"override": true` and an incompatible pair → still `unavailable` (no override exists); a `"cartId": "x"` field changes nothing.
- C-J-9 (needs OA-02, G, H): `npm run lint:catalog` against the live project exits 0 and prints no `error` lines (warnings allowed); paste the output into `VERIFICATION-LOG.md`.
- C-J-10 (needs OA-02, G, H, M, N): cart-mode checks with a real cart (cable plan + router in the bundle, then POST `malva-offer-spotify` without `parentLineItemId` → `allowed` with `parentLineItemId` equal to the cable line id; with a phone plan and a cable plan in the cart, POST `malva-offer-spotify` without parent → `AMBIGUOUS_PARENT` and two `candidateParents`; with `parentLineItemId` of the phone line → `allowed`); verified together with C-M-* and C-N-*.

## Manual tests (owner only)
None.

## Excluded
- Rendering of the pickers, disabled states and reasons (N), cart line writes, cascade removal and the checkout block (M, U): the rules they call are built here; those scenarios are therefore tested here at rule level and the UI part is listed in N/M.
- API Extension (D-024) and agent override (D-022): not built; the spec's "agent" language is deferred with `agent-redemption-quota`.
- Held-services-aware compatibility (what the customer already holds) is built in K (D-021).
- `AttributeNestedType` (beta) is not used: compatibility is flat attributes plus key sets, as in the catalog model.

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] All 15 scenario rows above have passing tests; every `ReasonCode` J defines has en and de messages.
- [ ] `npm run lint:catalog` is clean on the seeded project (J-09) or the owner was told why not.
- [ ] C-J lines present; STATUS set to `Ready for review`.
- [ ] `lib/offers/**` has no I/O and no import from `lib/ct/**`; the compatibility route never writes a cart.

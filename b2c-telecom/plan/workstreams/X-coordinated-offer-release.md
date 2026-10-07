# X — Coordinated offer release

**Specs:** `coordinated-offer-release` (all requirements and scenarios; mechanism fixed by D-057)
**Depends on:** F, G, J, K · **Unblocks:** Y, Z · **Decisions:** D-005, D-011, D-016, D-054, D-057, D-058
**Owner prerequisites:** OA-03 · **Skill refs:** `commercetools-platform` (update actions, Custom Objects, optimistic concurrency), `commercetools-commerce-patterns` (price validity, cart discount validity, recurring-order price modes)

## Goal
A campaign (new offers, their prices, the promotion that funds it, the withdrawal of what it replaces) is written as one **release manifest**, previewed, applied all-or-nothing by `npm run release:apply`, and goes live for customers at one instant; before that instant nothing of it is purchasable, a failed apply leaves no trace, a scheduled release can be cancelled, and every release is recorded.

## Design

### The honest starting point (spec "Modeling notes")
commercetools has no transactional publish across products, prices and discounts. The mechanism (D-057) makes a campaign **look atomic** by combining three facts, each verified in the docs:
1. **Everything is written "dark".** Each created or changed element carries the release instant itself: offers get `start-time` (and `end-time` when they end), embedded prices get `validFrom`/`validUntil` ([PriceDraft](https://docs.commercetools.com/api/types#pricedraft)), cart discounts get `validFrom`/`validUntil` ([CartDiscountDraft](https://docs.commercetools.com/api/projects/cartDiscounts)). Before `releaseAt` none of them is effective; at `releaseAt` all become effective together because the platform and the storefront both compare against the clock.
2. **The storefront refuses unreleased offers** (read-side check below), so even a published offer is not listed, searched or added before its `start-time`. Because the new offer's prices are also `validFrom = releaseAt`, a reader that forgets the check still cannot sell it: price selection finds no valid price (defence in depth).
3. **All-or-nothing apply:** a validation phase (no writes), then ordered writes with an automatic **compensation** (restore of the pre-apply snapshot) if any write fails. A half-applied release is invisible because everything written is inert until `releaseAt`; apply refuses a `releaseAt` less than **10 minutes** away so the write phase always finishes before the instant (expedite path below).
Rollback is "apply the previous manifest" (D-057): the engine generates the inverse manifest from the recorded snapshot and applies it through the same path. There is no approval step (D-069) and no approval UI (D-057).

### Files (all new, X's area; names recorded here because ARCHITECTURE.md lists only `release.ts`)
```
site/scripts/seed/
  release.ts                      # CLI entry (npm run release:*)
  release/types.ts  parse.ts  validate.ts  snapshot.ts  plan.ts  preview.ts  apply.ts  store.ts  history.ts
  release/*.test.ts
  releases/<key>.release.json     # manifests (committed)
  releases/examples/malva-rel-example-summer-unlimited.release.json   # used by tests and the live run
  releases/.state/                # gitignored: <key>.before.json, <key>.previewed
  checks/releases.ts              # seed:verify checks for scheduled releases
site/lib/offers/release.ts        # read-side check (shared by server and client, pure)
site/lib/offers/release.test.ts
```
npm scripts (X appends to `site/package.json`): `release:validate`, `release:preview`, `release:apply`, `release:cancel`, `release:rollback`, `release:history`, `release:verify`; each is `tsx scripts/seed/release.ts <command>` and takes `<release-key>` as the first argument. Writes need `--confirm-project spec-test-b2c-telecom` (F's `assertTarget`; same allow-list). Exit codes: F's table plus **7** = apply failed **and** the compensation failed (needs a person; the record is `inconsistent`).

### Release manifest (`releases/<key>.release.json`, validated by `parseReleaseManifest`; no zod, hand-written checks)
```ts
export interface ReleaseManifest {
  schema: 1;
  key: string;                        // /^malva-rel-[a-z0-9-]{3,60}$/
  name: string;                       // human title shown in preview and history
  author: string;                     // free text: who wrote it
  releaseAt: string;                  // ISO-8601 UTC ending in Z, e.g. "2026-11-15T09:00:00Z"
  endsAt?: string;                    // optional end for a time-limited campaign (offers' end-time, prices' validUntil, discounts' validUntil)
  createOffers: OfferManifest[];      // full G manifests: new offers (all variants and prices); start-time forced to releaseAt
  patchOffers: OfferPatch[];          // changes to existing offers (new prices, new text, badge)
  withdrawOffers: string[];           // offer keys: end-time = releaseAt
  reinstateOffers: string[];          // offer keys: clear end-time and the closing validUntil (used by generated rollbacks)
  replaces: { old: string; new: string }[];   // a withdrawal paired with its successor (must appear in withdrawOffers/createOffers)
  createCartDiscounts: CartDiscountManifest[];   // G manifests; validFrom forced to releaseAt
  withdrawCartDiscounts: string[];    // discount keys: validUntil = releaseAt
  externalChecklist: string[];        // free text, e.g. "Policy v3 effective 2026-11-15 deployed on Netlify"
  expedite?: { reason: string };      // shortens the minimum lead time to 2 minutes; reason required (at least 20 characters), no identity involved
}
export interface OfferPatch {
  key: string;
  name?: LocalizedString; description?: LocalizedString;
  attributes?: Record<string, unknown>;                        // SameForAll attributes only (e.g. badge)
  prices?: { sku: string; prices: PriceSpec[] }[];             // new prices from releaseAt; the current ones are closed at releaseAt
}
```
`OfferManifest`, `CartDiscountManifest`, `PriceSpec`, `LocalizedString` are G's types (`scripts/seed/data/catalog-types.ts`). A release may not touch product types, categories, tax categories, zones or shipping (validation error: they trigger a full reindex or are not campaign data).

Operator: an optional `--operator <name>` flag (free text, default the OS user name) is recorded as `appliedBy`; it is not checked against any list (D-069).

### Commands
| Command | Writes? | What it does |
| --- | --- | --- |
| `release:validate <key>` | no | Phase 1 only: parse, validate (rules below), print `OK` or the error list; exit 0 or 3 |
| `release:preview <key> [--at <ISO>]` | **no** (the fake and the live test assert zero writes) | Prints the catalog **as customers would see it** at `T` (default `releaseAt`): purchasable offers (key, name, master variant monthly price USD and EUR, start/end), then the diff against now (offers added, withdrawn, price changes, discounts added or ended), then the external checklist. Writes nothing to the project; no marker file |
| `release:apply <key>` | **yes** | Requires target confirmation, `releaseAt` at least 10 minutes away (2 minutes with `expedite` and its reason), `--ack` when `externalChecklist` is non-empty; runs validation, snapshot, writes, verification, record. Idempotent: re-running a scheduled release changes nothing |
| `release:cancel <key>` | yes | Only before `releaseAt`: restores the snapshot, deletes resources the release created, record `withdrawn`. After `releaseAt` it refuses and points to `rollback` |
| `release:rollback <key>` | yes | Generates `releases/<key>-rollback.release.json` from the snapshot (inverse manifest) and prints it; it is applied as a normal release by the same engine; use `expedite` for emergencies |
| `release:history [--at <ISO>]` | no | Lists records; with `--at` lists the releases in effect at that moment and, for each touched offer, the price in effect then |
| `release:verify <key>` | no | Revalidates a scheduled release against the **current** catalog (see open question 3) |

### Validation phase (`validate.ts`, pure over a `CatalogIndex` read from the project; zero writes)
Errors (each has a code and names the key):
1. `DANGLING_KEY`: every offer key in `withdrawOffers`, `reinstateOffers`, `patchOffers`, `replaces`, `included-offers`, `conflicts-with`, `compatible-*` of created offers, every anchor, category, tax category, recurrence policy and SKU of created offers must exist in the project or in `createOffers`; every `withdrawCartDiscounts` key must exist.
2. `CONFLICT`: after applying the release, the resulting offer set must satisfy: `conflicts-with` symmetric (G's `relations` rule); no offer lists a key in both `included-offers` and `conflicts-with`; no offer in the resulting set lists an offer that is withdrawn **and** not replaced in `included-offers`/`compatible-*` (an included extra may not vanish).
3. `REPLACES_MISMATCH`: for every `replaces` pair the old offer is in `withdrawOffers`, the new one in `createOffers`, and both effective instants are the same `releaseAt` (this is how "withdrawn in step" is guaranteed).
4. `DUPLICATE_SKU`, `DUPLICATE_PRICE_KEY`, missing `en-US`/`de-DE` text, missing USD/US or EUR/DE price on any new or patched variant, recurring variant without a price tied to its policy, price `centAmount` ≤ 0, discount `sortOrder` already used.
5. `TIME`: `releaseAt` must be a future UTC instant; `endsAt` > `releaseAt`; `releaseAt` ≤ now + **90 days**; an offer's existing `start-time` must not be later than `releaseAt` (a release cannot make something purchasable earlier than its own schedule).
6. `FORBIDDEN_RESOURCE`: product types, categories, tax, zones, shipping, customers, orders.
7. `PREDICATE_ATTRIBUTE`: discount predicates reference only attributes with `savedToLineItem: true` (F's validator).
Validation runs again inside `apply` (the catalog may have moved since `release:validate`).

### Apply protocol (`apply.ts`, all writes through F's `CtApi`; every step is idempotent by key)
1. `assertTarget(write)`; read `CatalogIndex`; validate; refuse on any error (exit 3, nothing written).
2. **Snapshot** (reads only): for every offer, discount and price touched, store its current relevant state: attribute values `start-time`/`end-time`, the full `prices` array of each touched variant, discount `validFrom/validUntil/isActive`. Written to `releases/.state/<key>.before.json` and (step 3) into the record.
3. Write the record in Custom Object container `malva-releases`, key = release key (`POST /custom-objects`, upsert): `status: 'applying'`, the hash, author, appliedBy, `releaseAt`, the list of intended changes, the snapshot. (If this write fails nothing else has been written.)
4. Write in this order, each step recorded in memory for compensation: cart discounts (`createCartDiscounts` created with `validFrom = releaseAt`, `validUntil = endsAt?`, `isActive: true`; `withdrawCartDiscounts` get `setValidFromAndUntil` keeping `validFrom` and setting `validUntil = releaseAt`); created offers (product create **published**, every variant with `start-time = releaseAt`, `end-time = endsAt` if any, prices `validFrom = releaseAt`, `validUntil = endsAt?`); patched offers (new prices added with `validFrom = releaseAt`, the replaced price gets `validUntil = releaseAt` through `changePrice`; text or attribute changes only through the dark mechanism where possible: **text and attribute patches are applied at apply time and are therefore visible early**; the validator warns `EARLY_VISIBLE_PATCH` and the preview lists them, so campaigns should use new offers for anything customer-visible); withdrawn offers (`setAttributeInAllVariants` `end-time = releaseAt`; their prices get `validUntil = releaseAt`); reinstated offers (clear). Product writes end with `publish`.
5. **Verify** (reads): re-read every touched resource and assert the expected effective instants (`verifyApplied`, pure). Mismatch counts as a failure.
6. Update the record to `status: 'scheduled'`, `appliedAt = now`. Print `Release <key> scheduled for <releaseAt>. Nothing is purchasable before that instant.`
7. **On any failure in steps 3 to 5:** compensate in **reverse order** using the snapshot (restore prices/attributes/discounts, delete created offers via `unpublish` then `DELETE`, delete created discounts), each compensation retried 3 times with re-fetched versions; then set the record `rolled-back` with the error and exit 1. If a compensation step still fails: record `inconsistent` with the list of resources, exit 7 and print exactly which keys to inspect (`release:verify`). Because nothing written was effective before `releaseAt`, customers never saw the partial state.
Live-test hook: `--fail-after <n>` (accepted only together with `--confirm-project`) makes the engine throw after the n-th write, used by C-X-8 and by the unit test.

### Read side (`lib/offers/release.ts`, pure, server and client)
```ts
export interface ReleaseWindow { startTime?: string | null; endTime?: string | null }
export class ReleaseError extends Error { readonly code = 'OFFER_NOT_RELEASED' }
export function isOfferReleased(offer: ReleaseWindow, now: Date = new Date()): boolean;   // fails closed on malformed dates
export function filterReleased<T extends ReleaseWindow>(offers: T[], now?: Date): T[];
export function assertReleased(offer: ReleaseWindow & { key: string }, now?: Date): void; // throws ReleaseError
export const RELEASE_MIN_LEAD_MS = 10 * 60 * 1000;      // used by apply and by the cache test
```
Semantics: released iff (`startTime` unset or `startTime <= now`) and (`endTime` unset or `now < endTime`); a malformed date string means **not released**. The mapped `Offer` type is H's (`lib/types.ts`, fields `startTime` and `endTime` from the attributes `start-time` and `end-time`; if H named them differently X-07 adapts the call sites, the function takes only the structural `ReleaseWindow`).
Wiring (X appends to files owned by H, allowed by ARCHITECTURE.md as append-only): in `lib/ct/catalog.ts` and `lib/ct/search.ts` every exported function that returns mapped offers passes its result through `filterReleased(…, new Date())` **after** the cached read and **before** returning (the cache stores the raw offers including `startTime`, so an offer appears at the instant, not after the cache TTL). Contract for other workstreams (not enforceable from X, reported): M (`addLineItem`) must call `assertReleased` on the resolved offer; N and P must request the whole offer set (27 offers, `limit` 100) and paginate after filtering so pages are not short.
Cache interplay (pitfall): a **new** offer only reaches cached lists after H's catalog TTL expires; the 10-minute lead covers a catalog TTL of up to 5 minutes. Test `lib/offers/release-lead-vs-cache.test.ts` imports the TTL constants from `lib/config/cache.ts` (H) and asserts every catalog/search TTL is at most half of `RELEASE_MIN_LEAD_MS`; X-07 records the constant names it used in its commit message.

### Release record and history (`store.ts`, `history.ts`)
Custom Object container `malva-releases` (docs: <https://docs.commercetools.com/api/projects/custom-objects>), key = release key:
```ts
export interface ReleaseRecord {
  key: string; name: string; author: string; appliedBy: string;
  appliedAt: string; releaseAt: string; endsAt?: string;
  manifestSha256: string; expedited: boolean; expediteReason?: string; externalAck: boolean;
  status: 'applying' | 'scheduled' | 'withdrawn' | 'rolled-back' | 'inconsistent';
  changes: { resource: 'offer' | 'price' | 'cartDiscount'; key: string; field: string; before: unknown; after: unknown }[];
  before: unknown;                       // snapshot (same content as .state/<key>.before.json)
  rollbackOf?: string;
}
```
"Effective" is **derived** (`status === 'scheduled' && now >= releaseAt`), never stored, so there is no job to run (nothing in the platform fires when a date arrives; spec constraint). `release:history --at T` answers "what was in effect, when, by whom": records with `status: 'scheduled'` and `releaseAt <= T` (and no later release/rollback undoing them before `T`) plus, per touched offer, the price recorded in `changes` for that instant. This record is the answer to the dispute question "what was the price when order N was placed"; it needs the scope `manage_key_value_documents` (reported under OA-03).

### Answers to the spec's open questions (Planner defaults; owner may overrule)
1. **Rollback after a release took effect:** yes, `release:rollback` generates the inverse manifest and applies it as a normal release (`expedite` allowed). Orders already placed keep the prices they were placed at (orders are snapshots; recurring orders with price mode `Fixed`, D-013, keep theirs; `Dynamic` ones pick up the rolled-back catalog price on their next order, which is stated in the preview of every rollback).
2. **No approval (D-069), expedited path:** there is no approver and no second person. Expedited path for a correction that cannot wait: the manifest carries `expedite.reason` (at least 20 characters); the minimum lead time drops from 10 minutes to 2 minutes; the record shows `expedited: true` and the reason. `--expedite` is only that shortening.
3. **How far ahead, revalidation:** at most **90 days**. `release:verify <key>` revalidates against the current catalog (exit 3 if a referenced key vanished or a conflict appeared since); `seed:verify` runs it for every scheduled release (check in `checks/releases.ts`), and `release:apply` revalidates again on apply.
4. **Content and terms outside commercetools:** not covered by the atomic boundary. The manifest's `externalChecklist` lists them; preview prints them and apply requires `--ack`, a plain flag, which is stored in the record (`externalAck`). Static pages (`site/content/**`, workstream W) deploy with the site, not with the release.

### Pitfalls
- **No authoring/releasing separation (D-069):** one seed client holds all scopes and no identity is checked; `appliedBy` is free text for the record only.
- **Clock:** `validFrom` and `end-time` are compared against the platform clock and the BFF clock (UTC, ISO with `Z`); a skew of seconds is possible. Do not schedule releases that depend on sub-minute ordering.
- **Price selection with validity dates** prefers a price valid now over one without dates; both the old (closing) and the new (opening) price exist side by side until `releaseAt`; expired prices stay (history); a later `release:gc` is out of scope.
- **Search index:** creating offers and prices is an incremental index update ("a few minutes"); the 10-minute lead covers it. A release must not touch product types (full reindex, about 15 minutes).
- **Early-visible patches:** text and non-price attribute patches are not dark; the validator warns and the preview lists them.
- **Recurring orders:** new prices only apply to orders placed after `releaseAt`; existing recurring orders follow their price selection mode.
- **Never commit** `.state/`, any `.env*`, or operator passwords; `author` and `appliedBy` are free text; do not put personal data there.

### Planner defaults (owner may overrule)
1. Release manifests are JSON files in the repo; no approval step (D-069); no UI.
2. Everything is dark until `releaseAt` through `start-time`/`end-time`, price validity and discount validity; apply requires 10 minutes of lead time (2 with `expedite` and a reason).
3. `end-time` on offers (G adds the attribute) implements withdrawal and campaign end.
4. Release records are Custom Objects in container `malva-releases`.
5. Text and non-price attribute patches are allowed but flagged as early-visible.
6. The four open questions are answered as above.

## Tasks
- [x] X-01 Create `release/types.ts` (`ReleaseManifest`, `OfferPatch`, `ReleaseRecord`), `release/parse.ts` (`parseReleaseManifest`, `sha256OfManifest` over canonical JSON with sorted keys), `releases/examples/malva-rel-example-broken.release.json` (valid JSON naming the missing key `malva-offer-nope` in `withdrawOffers`, used by C-X-1 and the DANGLING_KEY test), `releases/examples/malva-rel-example-summer-unlimited.release.json` (a new offer `malva-offer-phone-unlimited-summer` anchored on `malva-phone-unlimited`, SKU `MLV-PHN-UNL-SUMMER-M2M` USD 4000 / EUR 4000 monthly under `malva-monthly`, `replaces` the offer `malva-offer-phone-online-only`, one cart discount `malva-cd-rel-example-5-off` 5 USD / 5 EUR off phone lines, `releaseAt` as a placeholder the test overrides), `.gitignore` entry `scripts/seed/releases/.state/`. [SKILL: commercetools-platform] Tests `release/parse.test.ts`: valid example parses, malformed `releaseAt` (no `Z`), bad key pattern and unknown fields are rejected, hash is stable across key order.
- [x] X-02 Create `release/validate.ts` (rules 1 to 7) and `release/catalogIndex.ts` (builds the index from reads through `CtApi`; the fake serves it). [SKILL: commercetools-commerce-patterns] Tests `release/validate.test.ts`: one test per rule code; "Replaced offer withdrawn in step: replaces pair with different effective instants fails, a matching pair passes"; dangling key names the key; symmetric-conflict failure; 90-day limit; forbidden resource.
- [x] X-03 Create `release/snapshot.ts` (read touched state), `release/plan.ts` (ordered write list from the manifest and `releaseAt`; generated rollback manifest from a snapshot), `release/preview.ts` (`catalogAt(index, manifest, T)` using `isOfferReleased` and price validity; renderer). [SKILL: commercetools-commerce-patterns] Tests `release/plan.test.ts` and `release/preview.test.ts`: "Preview before approval: …" (before `releaseAt` the preview at `releaseAt` shows the campaign while the live index at now still lacks it; preview performs zero writes), plan puts `validFrom`/`start-time` equal to `releaseAt` on every element, rollback manifest of a plan restores the snapshot when applied to the fake.
- [x] X-04 Create `release/store.ts` (record upsert/read in `malva-releases`), `release/history.ts` (`inEffectAt`; `appliedBy` from `--operator`, default OS user). [SKILL: commercetools-platform] Tests `release/store.test.ts`, `release/history.test.ts`: "Release recorded: …" (after apply the record has hash, author, appliedBy, `releaseAt`, changes; history at a past instant names it).
- [x] X-05 Create `release/apply.ts` (protocol steps 1 to 7, compensation, `--fail-after`, cancel, rollback generation command) using F's `CtApi` and `test/fake-ct.ts`. [SKILL: commercetools-platform] Tests `release/apply.test.ts`: "Nothing visible before the release: …" (after apply, evaluating the fake catalog at `releaseAt - 1 s` shows none of the new offers, prices, discounts, and the old offer still purchasable), "Everything visible after it: …" (at `releaseAt` all of them are effective together), failure at write n restores the fake exactly to the snapshot and records `rolled-back`, compensation failure exits 7 with `inconsistent`, re-apply of a scheduled release is a no-op, apply with lead time under 10 minutes refused, `expedite` allows 2 minutes only with a reason; `release/cancel.test.ts`: "Release withdrawn before its time: …" (cancel before `releaseAt`, then at and after `releaseAt` nothing from it is purchasable; cancel after `releaseAt` refused).
- [ ] X-06 Create `scripts/seed/release.ts` (command dispatch, flags `--confirm-project`, `--at`, `--ack`, `--operator`, `--expedite`, `--fail-after`, exit codes), npm scripts, `checks/releases.ts` (scheduled releases revalidate; record statuses are not `applying` or `inconsistent`), register the check. [SKILL: commercetools-platform] Tests `scripts/seed/release.test.ts`: dispatch table, target refusal exit 2, unknown command, `release:verify` exit 3 when a referenced key was deleted; `checks/releases.test.ts`.
- [ ] X-07 Create `lib/offers/release.ts` and its tests; append the `filterReleased` wiring to `lib/ct/catalog.ts` and `lib/ct/search.ts` (append-only, commit message lists the functions wrapped); add `lib/offers/release-usage.test.ts` (static check: both files import from `@/lib/offers/release` and every exported function returning offers references `filterReleased`) and `lib/offers/release-lead-vs-cache.test.ts`. Tests: `lib/offers/release.test.ts` → the scenario rows below plus malformed date fails closed, `endTime` boundary exclusive, `startTime` boundary inclusive.
- [ ] X-08 **Live (needs OA-03, F, G, J, K done):** run the example release end to end against `spec-test-b2c-telecom` as one operator: validate, preview, apply with `releaseAt` about 15 minutes ahead, wait, verify, rollback, history; run the failure-injection apply; delete the example artefacts afterwards through the rollback (the project ends in its pre-release state); record findings (timings, clock skew observed, search lag for the new offer) in `PROJECT-FINDINGS.md`; run `npm run verify`; report the C-X checks. [SKILL: commercetools-platform]

## Unit tests (scenario → test)
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Nothing visible before the release | `coordinated-offer-release` | `scripts/seed/release/apply.test.ts` → "Nothing visible before the release: offers, prices and discounts are inert until releaseAt" and `lib/offers/release.test.ts` → "Nothing visible before the release: isOfferReleased is false before startTime" |
| Everything visible after it | `coordinated-offer-release` | `scripts/seed/release/apply.test.ts` → "Everything visible after it: at releaseAt offers, prices and promotion are effective together" and `lib/offers/release.test.ts` → "Everything visible after it: released at and after startTime" |
| Preview before approval | `coordinated-offer-release` | `scripts/seed/release/preview.test.ts` → "Preview before approval: shows the campaign as customers would see it with zero writes" |
| Replaced offer withdrawn in step | `coordinated-offer-release` | `scripts/seed/release/validate.test.ts` → "Replaced offer withdrawn in step: the old offer ends at the instant its successor starts" |
| Release recorded | `coordinated-offer-release` | `scripts/seed/release/history.test.ts` → "Release recorded: history at a past moment names what was released, when and by whom" |
| Release withdrawn before its time | `coordinated-offer-release` | `scripts/seed/release/cancel.test.ts` → "Release withdrawn before its time: nothing becomes purchasable after the time passes" |

## Chrome verification (run by Claude)
Checks use the CLI, the commerce MCP read tools and, once the listing pages exist (N), the storefront. Release instants are `now + 15 minutes` for C-X-3 and C-X-4.
- C-X-1 (needs OA-03, F, G, J, K): `cd site && npm run release:validate -- malva-rel-example-broken` (a manifest naming `malva-offer-nope` in `withdrawOffers`) → exit 3 and the message `DANGLING_KEY malva-offer-nope`; `npm run release:validate -- malva-rel-example-summer-unlimited` → `OK`, exit 0.
- C-X-2 (needs OA-03, F, G, J, K): `npm run release:preview -- malva-rel-example-summer-unlimited` → prints the offer table (new `malva-offer-phone-unlimited-summer` at 4000 USD / 4000 EUR, `malva-offer-phone-online-only` ending at `releaseAt`), the diff and the checklist; MCP `read_products` key `malva-offer-phone-unlimited-summer` → not found (zero writes).
- C-X-3 (needs OA-03, F, G, J, K): run `release:apply -- malva-rel-example-summer-unlimited --confirm-project spec-test-b2c-telecom --operator claude`; MCP `read_products` → the new offer exists and is published, every variant has `start-time` equal to `releaseAt`, its prices carry `validFrom = releaseAt`; the old online-only offer has `end-time = releaseAt`; MCP `read_cart_discounts` key `malva-cd-rel-example-5-off` has `validFrom = releaseAt`; MCP `read_custom_objects` container `malva-releases` key `malva-rel-example-summer-unlimited` → `status: scheduled` and `appliedBy: claude`.
- C-X-4 (needs OA-03, F, G, J, K, N): before `releaseAt`, Chrome navigate `http://localhost:3000/en-US/shop/phone-plans` → the new offer is **absent**, "Unlimited, online only" present, console clean, no failed network request; at 375 px the same; after `releaseAt` plus the catalog cache TTL (reload) → the new offer present with its price `$40.00`, the old one absent; `http://localhost:3000/de-DE/shop/phone-plans` → new offer with German text and `40,00 €` formatting.
- C-X-5 (needs OA-03, F, G, J, K): schedule a second release (copy of the example with another key and a new SKU), then `release:cancel` before its time → MCP shows the created offer and discount deleted, record `withdrawn`; after its `releaseAt` passes nothing of it exists.
- C-X-6 (needs OA-03, F, G, J, K): after the first release is effective, `release:rollback` writes `releases/malva-rel-example-summer-unlimited-rollback.release.json`; apply it with `--expedite` (manifest `expedite.reason` present) → after the 2-minute lead the new offer is absent from the listing and the online-only offer is back (`end-time` cleared); MCP prices of the project equal the pre-release snapshot.
- C-X-7 (needs OA-03, F, G, J, K): `npm run release:history -- --at <a moment between releaseAt and the rollback>` → lists `malva-rel-example-summer-unlimited` with author, `appliedBy` and the new price; `--at <a moment before releaseAt>` → lists nothing for that offer.
- C-X-8 (needs OA-03, F, G, J, K): `release:apply … --fail-after 2` → exit 1, record `rolled-back`; MCP shows no created offer, no created discount and the old offer unchanged; `release:apply` again without the flag then succeeds.
- C-X-9 (needs OA-03, F, G, J, K): `npm run seed:verify` → the release check passes with a scheduled release present and fails with the message naming the key if the referenced anchor offer is deleted in a scratch fake (unit-covered; live only the pass case).

## Manual tests (owner only)
None.

## Excluded
- Approval or preview **UI**: D-057 (no approval UI); the preview is a CLI report.
- Release by attaching a Product Selection to a Store (spec modeling note, first approach): D-058 (no Stores, no Product Selections).
- Releasing product types, categories, tax, shipping, customers and orders: not campaign data (validation rejects them).
- Releasing content held outside commercetools atomically: only the checklist and acknowledgement are provided (open question 4).
- Real permission separation through two API clients: noted in Pitfalls, not built.
- Scenario "Authoring and releasing are separate": D-069 (no approver list, no second-person approval, no operator identity gate; authoring and releasing are not separated).

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] Every scenario row above has a passing test.
- [ ] C- lines present; STATUS set to `Ready for review`.
- [ ] The live example release ran end to end (validate, preview, apply, effective, rollback) and the project is back in its pre-release state; findings recorded.
- [ ] `lib/offers/release.ts` is wired into the catalog and search reads (static test green); the owner has been told that M must call `assertReleased` in `addLineItem` and that the OA-03 scope list needs `manage_key_value_documents`.

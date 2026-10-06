# U — Substitutions (Order Edits)

**Specs:** `grocery-storefront-features` → `substitution-experience` (all); existing behavior `out-of-stock-substitutions`
**Depends on:** F, J, R · **Unblocks:** — · **Decisions:** D-031, D-032 · **Owner prerequisites:** OA-07 · **Sign-off:** SO-04

## Goal
Shoppers set a per-line substitution preference in the cart; on order detail they see pending substitution proposals (Order Edits) and accept (apply) or decline them.

## Design

### Preference (cart)
- Endpoint `PATCH /api/cart/line-items/[lineId]/substitution` `{ preference: 'allow-similar' | 'none' }` → `setLineItemCustomField` (`name: 'substitutionPreference'`) with `withCartRetry`; returns the cart. Invalid value → 400.
- `components/cart/SubstitutionControl.tsx` **(client)** (J's extension point): a `Segmented` control "Allow similar" / "No substitution" under each line; optimistic update with rollback; `aria-label` includes the product name.
- The preference is already copied to the order by commercetools (line custom fields are copied on order creation) — R displays it. Verify in M-U-1.

### Proposals (order detail)
- **Data model (from F):** Order Edit custom type `substitution-proposal` fields `originalLineItemId`, `substituteSku`, `status` (`pending|declined|applied`), `note`.
- `lib/ct/order-edits.ts` (`server-only`) — **verify exact SDK/OAS names first (U-01)** with `node scripts/openApi-schemata.mjs --resource-name api-OrderEdit-write` and `api-Order-write` from the storefront skill folder:
  - `getProposalsForOrder(orderId): Promise<Proposal[]>` — `apiRoot.orders().edits().get({ queryArgs: { where: 'resource(id="<orderId>")', expand: [] } })`, keep those with custom type key `substitution-proposal`, `status = 'pending'`, and `result.type === 'NotProcessed'`; map each with a **preview** (`apiRoot.orders().edits().withId({ID}).get()` exposes `result`/staged actions; compute price difference from the edit's preview if available, else from `stagedActions` + product prices via `getProductsByIds`).
  - `acceptProposal(editId, customerId)` — fetch edit + order, check ownership (order.customerId), eligibility (order `inventoryMode === 'None'`, `orderState` not Cancelled/Complete, shipment not Shipped/Delivered), then `apiRoot.orders().edits().withId({ ID }).apply().post({ body: { editVersion: edit.version, resourceVersion: order.version } })`, then set `status = 'applied'` (`setCustomField`). Conflict (409) → throw `ProposalConflictError`.
  - `declineProposal(editId, customerId)` — same ownership checks; `setCustomField status = 'declined'` only (**the edit is not applied**).
- Type `Proposal = { editId: string; originalLineItemId: string; originalName: string; substituteSku: string; substituteName: string; priceDifference: Money; newTotal?: Money; note?: string; editable: boolean }`.
- Routes (401 anonymous; `privateJson()`; ownership enforced in `lib/ct/order-edits.ts`): `GET /api/account/orders/[orderId]/proposals`, `POST /api/account/proposals/[editId]/accept`, `POST /api/account/proposals/[editId]/decline`. `accept` errors: 403/404 not owner, 409 `{ error:'STALE' }` on conflict, 422 `{ error:'NOT_EDITABLE' }`.
- UI `components/account/OrderSubstitutions.tsx` **(client)** (fills R's slot): per proposal a notice `Card` (accent-100): "We couldn't find {original}. Proposed: {substitute} ({+/- price})" with new total preview; actions **Accept** (primary) / **Decline** (ghost); after decline the line shows `Tag` "Removal requested"; not editable → read-only text + "Contact us" link. After accept: refetch order (`mutate(keyOrder(id))`) and the line shows the substitute.
- **Test recipe (no dev route in the app):** `plan/recipes/create-substitution-proposal.md` (created in U-08) explains how testers create a proposal via API/Postman/MC; OA-07 confirms the path.

## Tasks
- [x] U-01 **Spike (docs/OAS):** confirm SDK call names for listing/getting/applying Order Edits, staged actions available (`addLineItem`, `removeLineItem`/quantity change), custom type on edits, and whether Merchant Center can create them. Write findings in `PROJECT-FINDINGS.md` §13 and adjust this file's design if names differ (then tell the owner).
- [x] U-02 Write `PATCH /api/cart/line-items/[lineId]/substitution` + `SubstitutionControl` + tests (400 invalid value; optimistic update and rollback; accessible name; default shown from line).
- [x] U-03 Write `lib/ct/order-edits.ts` `getProposalsForOrder` + tests with fixtures: pending proposal included; declined/applied excluded; non-proposal edits excluded; price difference computed.
- [x] U-04 Write `acceptProposal`/`declineProposal` + tests: apply called with both versions; not owner rejected; order not editable → `NOT_EDITABLE`; conflict → `ProposalConflictError`; decline sets status and does **not** call apply.
- [x] U-05 Write the three proposal routes + tests (status codes above; ownership).
- [x] U-06 Write `OrderSubstitutions` + hook `useProposals(orderId)` + tests: shows notice with price difference; Accept calls endpoint then refetches; Decline shows "Removal requested"; stale error shows explanation and refetch; read-only when not editable.
- [x] U-07 Wire into order detail (R slot) and cart line (J slot); messages (both locales).
- [x] U-08 Write `plan/recipes/create-substitution-proposal.md` (exact HTTP requests, no secrets) and report manual tests M-U-1…M-U-4, sign-off SO-04.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Change preference / Preference on order | U-02, M-U-1, R-07 |
| Proposal exists | U-03, U-06 |
| Accept / Stale version | U-04, U-06 |
| Decline | U-04, U-06 |
| Order already shipped (not editable) | U-04, U-06 |

## Manual tests to report
- M-U-1: Place a test order with a line set to "No substitution" (cart: switch the line, reload: it stays; place the order, e.g. `npx tsx scripts/seed/create-qa-order.ts` has lines with both preferences): order detail shows it (preference copied).
- M-U-2 (OA-07): Create a proposal with `plan/recipes/create-substitution-proposal.md` (script `create-qa-substitution.ts` or the HTTP request) on that order: the notice appears above the items with the substitute, the price difference and the new total.
- M-U-3: Accept: the line shows the substitute and the total changes; Merchant Center shows the edit applied (result `Applied`, custom `status = applied`).
- M-U-4: Create another proposal and Decline: the line shows "Removal requested" (also after reload); the edit is not applied in Merchant Center (result `NotProcessed`, `status = declined`).
- M-U-5: Create a proposal, open the order page, then change the order in Merchant Center (any update), press Accept: the page explains the order changed and refreshes. Also: a proposal on a shipped order (set shipment state Shipped) shows read-only text with "Contact us" and no buttons.

## Definition of done
No substitution logic bypasses Order Edits; ownership checks tested; recipe written; `verify` passes; SO-04 requested.

## Implementation notes (deviations, recorded by the developer)
- **No live commercetools check was possible** (`site/.env.seed` was not used by the agent): the Order Edit calls follow the OAS and docs (PROJECT-FINDINGS section 18) and are unit-tested against fixtures only. `scripts/seed/create-qa-substitution.ts` is unit-tested for its pure parts (arguments, draft, call order against a mocked client) but **has not been run against the project** (Q-U-1). The first person with `.env.seed` should run it once and report differences in PROJECT-FINDINGS section 18.
- Combination of custom types (D-051): the order keeps its single custom type `cart-delivery`; the line items carry `line-substitution`; the edit carries `substitution-proposal` (`resourceTypeIds: order-edit`). They live on different resources, so nothing conflicts. The substitute line added by the edit gets `line-substitution` (`none`) from the staged `addLineItem`.
- `getProposalsForOrder(orderId, customerId, locale)` (plan: `(orderId)`) enforces ownership itself and returns `{ proposals, removalRequested }`: `removalRequested` are the original line ids of **declined** proposals so the "Removal requested" tag survives a reload (the plan listed only pending ones, which would lose the state). `Proposal` and `ProposalsResponse` are in `lib/types.ts`.
- Unapplied edits: the plan said keep `result.type === 'NotProcessed'`. A GET by id returns `PreviewSuccess`/`PreviewFailure` instead, so the code treats every result except `Applied` as unapplied; the list answer is used only to find candidates, the preview comes from a GET by id per pending edit. The price difference is `preview.totalPrice - order.totalPrice`, the substitute name comes from the preview line (no product read). A failed preview shows the proposal read-only without price.
- A proposal edit is recognised by the custom type key (the list is requested with `expand: ['custom.type']`) and by its fields; edits of another type are ignored.
- Decline also requires an editable order (spec: Accept and Decline are not offered otherwise). Accept sets `status = applied` after a successful apply; if that write fails the accept still succeeds (the edit result `Applied` hides it).
- Routes: errors are `PROPOSAL_NOT_FOUND` (404, also for a foreign order or edit), `NOT_EDITABLE` (422), `STALE` (409), `PROPOSALS_ERROR` (500) via `lib/api/proposal-failure.ts`. All routes use `privateJson`/`unauthenticated` and call `getSession()` (the scan test covers them).
- After Accept the order is refetched (`mutate(keyOrder(id))`): the original line is gone and the substitute appears as a normal new line (the mapper's `OrderLine.substitute` is not used, because the edit replaces the line). `LineRemovalTag` (exported from `OrderSubstitutions.tsx`) is rendered in the order table row and reads the same SWR cache (`keyProposals(id)` = `order:<id>:proposals`, cleared on sign-out by the existing `order:` prefix rule).
- Cart: `PATCH /api/cart/line-items/[lineId]/substitution` answers 400 `INVALID_PREFERENCE`; a line without a custom type gets `setLineItemCustomType` (type + field) instead of `setLineItemCustomField`. `setSubstitution` was added to `useCartMutations` and `CartContext` (additive). `SubstitutionControl` rolls back and shows the existing `cart.updateFailed` toast.
- Messages: `cart.substitution.*` and `account.order.substitution.*` (both locales; German is a faithful machine translation, see IDEAS).
- Test helper `lib/ct/order-edits.test-helpers.ts` (not a test file; fixtures and a fluent fake of `orders().edits()`).
- `cleanup-qa.ts` now deletes the Order Edits of a QA order before the order.
- Sign-off SO-04 is owner-only; not set. OA-07: the API recipe is the proposed answer (Merchant Center cannot create proposals with a custom type).

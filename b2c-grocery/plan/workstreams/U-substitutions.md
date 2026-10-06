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
- [ ] U-02 Write `PATCH /api/cart/line-items/[lineId]/substitution` + `SubstitutionControl` + tests (400 invalid value; optimistic update and rollback; accessible name; default shown from line).
- [ ] U-03 Write `lib/ct/order-edits.ts` `getProposalsForOrder` + tests with fixtures: pending proposal included; declined/applied excluded; non-proposal edits excluded; price difference computed.
- [ ] U-04 Write `acceptProposal`/`declineProposal` + tests: apply called with both versions; not owner rejected; order not editable → `NOT_EDITABLE`; conflict → `ProposalConflictError`; decline sets status and does **not** call apply.
- [ ] U-05 Write the three proposal routes + tests (status codes above; ownership).
- [ ] U-06 Write `OrderSubstitutions` + hook `useProposals(orderId)` + tests: shows notice with price difference; Accept calls endpoint then refetches; Decline shows "Removal requested"; stale error shows explanation and refetch; read-only when not editable.
- [ ] U-07 Wire into order detail (R slot) and cart line (J slot); messages (both locales).
- [ ] U-08 Write `plan/recipes/create-substitution-proposal.md` (exact HTTP requests, no secrets) and report manual tests M-U-1…M-U-4, sign-off SO-04.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Change preference / Preference on order | U-02, M-U-1, R-07 |
| Proposal exists | U-03, U-06 |
| Accept / Stale version | U-04, U-06 |
| Decline | U-04, U-06 |
| Order already shipped (not editable) | U-04, U-06 |

## Manual tests to report
- M-U-1: Place a test order with a line set to "No substitution": order detail shows it (preference copied).
- M-U-2 (OA-07): Create a proposal with the recipe on that order: notice appears with price difference.
- M-U-3: Accept: line shows the substitute and total changes; Merchant Center shows the edit applied.
- M-U-4: Create another proposal and Decline: "Removal requested"; the edit is not applied in Merchant Center.

## Definition of done
No substitution logic bypasses Order Edits; ownership checks tested; recipe written; `verify` passes; SO-04 requested.

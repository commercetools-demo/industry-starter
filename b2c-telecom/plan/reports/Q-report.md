# Workstream Q report: devices and acquisition modes

Branch `ws/q-devices-and-acquisition-modes`. Live work ran against `spec-test-b2c-telecom` only (seed client for `npm run seed`, storefront client for the spike and a dev-server smoke).

## Done
Q-01 … Q-13 (all ticked). `npm run verify` passes. All six `device-acquisition-mode` scenarios and the `telecom-catalog-model` handset scenario have tests named after them.

Live smoke (dev server, anonymous session, real project): `/en-US/shop/phones-and-devices` renders "From $20.00/mo", "or $720.00 outright" (Nova 5G) and "From $28.00/mo", "or $1,008.00 outright" (Nova Pro), lease disabled with "Not available for Nova 5G"; POST `/api/cart/devices` installments 24 gave a line priced 4200 with policy `malva-device-installment-24`, `priceSelectionMode Fixed` and the custom fields; lease on Nova 5G -> 409 `MODE_UNAVAILABLE` (available outright, installments); Nova 5G 256 Silver 36 months -> 409 `TERM_UNAVAILABLE` (12, 24); PATCH to lease -> 3300 with `malva-device-lease-24`; mixed with an outright line; the financing decision answered `sign-in-required` for a guest. The cart was emptied afterwards (an empty anonymous cart remains, 90-day auto delete). Chrome checks C-Q-* were not run (owner/orchestrator).

## Not done / blocked
Nothing blocked. Not run: Chrome checks, signed-in financing checks C-Q-9 (needs R login and `npm run seed:financing-customers`), a real order with device lines (needs OA-05 for U).

## Questions for the owner
1. G's handset prices were placeholders; I replaced them with the plan's table (Nova 5G has no lease; the Nova 5G 256 GB Silver variant has no 36-month price on purpose). M-Q-2: are these demo prices and the stub limit (USD 2,500 / EUR 2,300) acceptable?
2. A plan and a device in one order become ONE Recurring Order (see Findings). The device end date is therefore stored on the line (`acquisitionEndDate`), and the platform expiry is only set for device-only Recurring Orders. Is that billing hand-over acceptable?

## Missed features and deviations
- No `seed:devices` / `scripts/seed/devices.ts`: G had already created the policies and prices; Q changed G's data files (`prices.ts`, `offers/devices.ts`, `custom-types/line-item.ts`) and used `npm run seed`. Tests are in `scripts/seed/data/{prices,devices}.test.ts` and `custom-types.test.ts`.
- Spike is `scripts/spike/device-recurrence.ts` (the existing folder name), script `spike:device-recurrence`. Results are not written to PROJECT-FINDINGS.md (orchestrator to move them from here).
- Credit flag uses G's existing `creditApproved` boolean (false = decline) instead of a new `creditCheck` enum.
- `assertDeviceCartIntegrity` is exported from `lib/ct/devices.ts` (async, reads the policy map) and the pure version from `lib/devices/cart-actions.ts`.
- Changes to other workstreams' files: `lib/config/cart.ts` (device quantity max 3), `lib/ct/bundle.ts` (devices refused on the generic add route with `USE_DEVICE_ROUTE`; policy map passed to the mapper when a device is in the cart), `lib/mappers/cart.ts` (`acquisition`, `device`, no `malva-monthly` recurrence for device lines, lines ordered by `addedAt`), `lib/mappers/offer.ts` + `price.ts` (`financedOptions` with policy ids), `hooks/useCart.ts` (`useCartRequest` extracted), `components/bundle/BundleView.tsx` (Devices section; the "Plans" heading only when there is a plan), `components/offers/OfferGrid.tsx` (devices branch; `DeviceListingSlot` deleted), `app/[locale]/shop/[slug]/page.tsx`, `messages/parity.test.ts` (new namespace `devices`), `package.json` scripts.
- Lease card text, term chips: lease has a fixed 24 months and no term chips.

## TODOs for other workstreams
- U: after creating the order call `applyDeviceRecurringExpiry(order.id)` (never throws); before creating the checkout session call `assertDeviceCartIntegrity(cart)` and `evaluateFinancing(session, market)` (approved -> continue; declined -> render `FinancingDecisionNotice` with the financed lines; sign-in-required -> `/login?returnTo=/bundle/checkout`). A device-only or any financed cart needs a customer (G finding), so guests can only buy outright.
- V: device return window is `RETURN_WINDOW_DAYS` (30); the return-by date for leases is on the line (`acquisitionEndDate`).
- S: order lines carry `acquisitionMode`, `acquisitionTermMonths`, `acquisitionEndOfTerm`, `acquisitionEndDate`, `financingDecisionId`.

## Findings
Measured 2026-10-07 by `npm run spike:device-recurrence` (all resources deleted afterwards):
- (a) `addLineItem` with a device recurrence policy key and `priceSelectionMode: Fixed` is accepted.
- (f) The resolved line price carries `recurrencePolicy` = the policy of the term; an outright line has no `recurrenceInfo` and a price without policy.
- (e) The same SKU in different modes (custom fields differ) stays separate lines; an identical second add merges into quantity 2.
- (g) The price-fallback trap is real: Nova 5G 256 Silver with installments 36 resolved to 82800 (the one-time price), price without policy, line still carries `recurrenceInfo`, HTTP 200, no error.
- (b) An order with a `malva-monthly` plan line, an installments line and an outright line produced ONE Recurring Order (schedule standard 1 Months) holding the plan and the device line (grouping is by schedule, not by policy). A device-only cart with installments 24 + lease 24 also gives one Recurring Order holding both. So the plan's separate Recurring Orders are not possible with one-month policies; fallback applied.
- (c) `startsAt` = order creation time, `nextOrderAt` = `startsAt` + 1 month. `FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER = 1` (payment 1 is the initial order at `startsAt`; the last payment N is at `startsAt` + (N - 1) months).
- (d) `setExpiresAt` is accepted. It would end the plan together with the device in a merged Recurring Order, so `applyDeviceRecurringExpiry` sets it only when every line is a device line of one term.
- A cart line re-added with `addedAt` keeps the old `addedAt` but the API returns lines in insertion order; the cart mapper sorts by `addedAt`.
- `recurringOrderState` of a Recurring Order is a plain string (`Active`), not an object.
- Seed: `npm run seed` changed only the three custom type fields and the 2 device offers' prices; a second run changed nothing; `seed:verify` passes.

## Manual tests added
M-Q-2 (already in the workstream file). C-Q-1 … C-Q-12 are in the workstream file; C-Q-8 policy names are G's ("Installment, 12 months"). C-Q-9 needs `npm run seed:financing-customers -- --confirm-project spec-test-b2c-telecom` (creates `qa-fin-ok-*` and `qa-fin-declined-*`, passwords printed once; `seed:reset --demo` removes them).

## Junior design choices
Device card (brand header with the lowest prices, native radio pills for color, memory and term, radio cards for the mode with a description, tinted summary panel, quantity stepper 1 to 3, full-width pill CTA); disabled modes and terms stay visible with a text reason; bundle "Devices" section with `AcquisitionLine` (change picker inline, Update/Cancel) and `AcquisitionTotals`; `FinancingDecisionNotice` as a bordered alert with a "Pay in full instead" button per line; defaults: first choice is the master variant with installments over 24 months; a mode or term the new variant lacks moves to installments / the preferred term. Date shown as a long date with the estimate label before the order.

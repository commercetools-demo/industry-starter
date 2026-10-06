# Q — Delivery slots and the cart delivery step

**Specs:** `grocery-storefront-features` → `delivery-slot-experience` (all except Handoff validation's session creation, which V completes); `cart-design` (Pre-checkout delivery step); existing behavior `delivery-slot-booking`
**Depends on:** F, J, O · **Unblocks:** R, S, V · **Decisions:** D-033, D-036, **D-042 (deviation, SO-12)** · **Sign-off:** SO-02, SO-12

## Goal
In the cart, a shopper enters a delivery address, picks a slot with remaining capacity (stub service), and the choice lives on the cart.

## Design

### `lib/slots/` (server-only except types)
```ts
export interface Slot { id: string /* YYYYMMDD-HH, e.g. 20261012-10 = 10:00–12:00 */; start: string /* ISO */; end: string; remaining: number }
export interface SlotService {
  listSlots(a: { country: string; postalCode: string; fromDate: Date; days: number }): Promise<Slot[]>;   // only remaining > 0
  holdSlot(slotId: string, cartId: string, ttlMinutes: number): Promise<{ ok: true; expires: Date } | { ok: false; reason: 'FULL' | 'UNKNOWN' }>;
  releaseHold(cartId: string): Promise<void>;
  confirmBooking(slotId: string, orderId: string): Promise<void>;       // idempotent; converts the hold of that slot into a booking
  nextAvailableDate(a: {country; postalCode; fromDate: Date}): Promise<Date | null>;
}
```
- `lib/slots/stub-service.ts`: in-memory (module singleton) implementation seeded **lazily** for the next 7 days; windows 08–10, 10–12, 12–14, 14–16, 16–18, 18–20; capacity 10 per window (`lib/config/slots.ts`: `{ days: 7, windows: [8,10,12,14,16,18], windowHours: 2, capacity: 10, holdMinutes: 15 }`); `now` injectable (`createStubSlotService({ now: () => Date })`) for tests; expired holds are released on every call; one hold per cart (a new hold replaces the old one); `remaining = capacity − holds − bookings`; windows already started today are excluded.
- **No slot charge in v1 (D-046):** delivery cost is the commercetools shipping method rate (free above the threshold stored in the rate); slots carry no price.
- `lib/slots/index.ts`: `getSlotService(): SlotService` returns the singleton (replaceable in tests).
- **Deliverability stub** `lib/slots/deliverable.ts`: `isDeliverable(country, postalCode)` → US/DE postcodes matching `^\d{5}$` (US also `^\d{5}-\d{4}$`) and **not** starting with `00` or `99`.
- Limitation to document in `site/README.md`: in-memory state resets on cold start/redeploy (Netlify serverless) — acceptable stub (SO-12).

### Cart custom fields (`cart-delivery`, from F)
`lib/ct/cart-delivery.ts`: `setShippingAddress(cartId, version, address)`; `setSlot(cartId, version, slot | null)` → `setCustomType` (key `cart-delivery`) when the cart has no custom type, then `setCustomField` for `slotId, slotStart, slotEnd, slotHoldExpires`; `clearSlot`; `ensureShippingMethod(cartId, version)` → `apiRoot.shippingMethods().matchingCart()` for the cart, pick key `standard`, `setShippingMethod` (so cart totals include delivery and the free-above threshold from the rate). Uses `withCartRetry` (J).

### Routes
- `PUT /api/cart/address` `{ firstName, lastName, streetName, additionalStreetInfo?, postalCode, city, country, phone? }` → validates (country in COUNTRY_CONFIG; postcode pattern), not deliverable → 422 `{ error: 'UNDELIVERABLE' }`; sets address, calls `ensureShippingMethod`; **revalidates an existing slot** (`isDeliverable`) and clears it when no longer valid (`slotCleared: true` in the response); returns `{ cart, slotCleared }`.
- `GET /api/slots` → uses the cart address; no address → 400 `{ error: 'NO_ADDRESS' }`; returns `{ days: [{ date, slots: Slot[] }], nextAvailableDate? }` (the latter only when no slot has capacity).
- `PUT /api/cart/slot` `{ slotId }` → `holdSlot` (15 min) then `setSlot`; `FULL` → 409 `{ error: 'SLOT_FULL' }` with fresh `days`.
- `DELETE /api/cart/slot` → `releaseHold` + `clearSlot`.

### UI in the cart (`components/cart/CartDeliveryStep.tsx`, client; replaces J's extension point)
Card "Delivery": address form (`Field`s: first name, last name, street, additional line, postcode, city, country select US/DE (default session country), phone) — signed-in saved-address picker is added by S; after a deliverable address is saved, `SlotPicker`: day tabs (7 days; `Segmented`), time list as radio cards (window label "10:00–12:00", selected = accent border + `accent-100` fill, no price); no capacity → message `cart.noSlots` + "Next available: {date}". Summary shows the delivery line = shipping method price ("Included" when free) and the chosen slot under it. Messages: address change that clears the slot shows notice `cart.slotCleared`.

## Tasks
- [x] Q-01 Write `lib/config/slots.ts`, `Slot`/`SlotService` types and `lib/slots/deliverable.ts` + tests (US/DE patterns; `00…` and `99…` undeliverable).
- [x] Q-02 Write `stub-service.ts` + tests with injected clock: only slots with capacity listed; started windows excluded; 11th hold on a window fails `FULL`; hold expires after 15 min and capacity returns; new hold for the same cart releases the previous; `confirmBooking` idempotent; `nextAvailableDate` when day full.
- [x] Q-03 Write `lib/ct/cart-delivery.ts` + tests (custom type set once; fields written; clear removes fields; uses retry).
- [x] Q-04 Write `PUT /api/cart/address` + tests: undeliverable 422; valid address sets the address and the `standard` shipping method (cart `shipping` present; `free` follows the rate threshold) and returns the cart; slot cleared when address becomes undeliverable (`slotCleared: true`); unchanged-valid address keeps slot.
- [x] Q-05 Write `lib/slots/days.ts` `getSlotDays(cart)` (groups slots by day; used by the route and by V) and `GET /api/slots` + tests (400 without address; days grouping; nextAvailableDate only when none).
- [x] Q-06 Write `PUT/DELETE /api/cart/slot` + tests (success writes fields; `FULL` → 409 with fresh days; delete releases hold).
- [ ] Q-07 Write `CartDeliveryStep` (address form + `SlotPicker`) + hooks (`useDelivery`) + tests: invalid postcode shows inline error; selecting a slot calls the endpoint and shows it in the summary; no-capacity message; slot cleared notice.
- [ ] Q-08 Wire the summary (delivery line from the shipping method + slot line) and the "Checkout disabled until address + slot" rule in J's cart page (`canCheckout(cart)` helper in `lib/cart-rules.ts` + tests: needs address, deliverable, slot, no out-of-stock lines).
- [ ] Q-09 Messages (both locales); report manual tests M-Q-1…M-Q-4 and sign-offs SO-02, SO-12.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Full slot hidden / Hold expires | Q-02 |
| Pick a slot / No capacity | Q-06, Q-07 |
| New address outside area | Q-04 |
| Slot filled before handoff / Confirmation | V (uses `holdSlot`/`confirmBooking`) |
| Order with slot | R |

## Manual tests to report
- M-Q-1: With items in the bag, enter a valid US address: slots for 7 days appear; pick one: summary shows the slot and the delivery price ("Included" when above the free threshold).
- M-Q-2: Change postcode to `99999`: error "not deliverable"; the picked slot is cleared with a notice.
- M-Q-3: Fill a window (pick the same slot from 11 browsers/sessions or temporarily lower capacity in `lib/config/slots.ts` to 1): the next shopper does not see it.
- M-Q-4: Reload after a redeploy/dev restart: slot hold may be gone (documented limitation) — confirm the cart shows "choose a slot".

## Definition of done
Stub service fully tested with an injected clock; deviation SO-12 requested; `verify` passes.

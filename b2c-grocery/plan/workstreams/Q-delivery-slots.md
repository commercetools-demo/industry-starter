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
- [x] Q-07 Write `CartDeliveryStep` (address form + `SlotPicker`) + hooks (`useDelivery`) + tests: invalid postcode shows inline error; selecting a slot calls the endpoint and shows it in the summary; no-capacity message; slot cleared notice.
- [x] Q-08 Wire the summary (delivery line from the shipping method + slot line) and the "Checkout disabled until address + slot" rule in J's cart page (`canCheckout(cart)` helper in `lib/cart-rules.ts` + tests: needs address, deliverable, slot, no out-of-stock lines).
- [x] Q-09 Messages (both locales); report manual tests M-Q-1…M-Q-4 and sign-offs SO-02, SO-12.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Full slot hidden / Hold expires | Q-02 |
| Pick a slot / No capacity | Q-06, Q-07 |
| New address outside area | Q-04 |
| Slot filled before handoff / Confirmation | V (uses `holdSlot`/`confirmBooking`) |
| Order with slot | R |

## Manual tests to report
- M-Q-1: In a fresh private window open `/en-US/shop`, add Whole milk 1 L (about 1.99) and open `/en-US/cart` at 1280 px and 390 px wide. In the new "Delivery" card enter First name `Ada`, Last name `Lovelace`, Street `1 Main St`, Postcode `10001`, City `New York`, Country `United States`, press "Save address" → "Address saved.", a "Delivery slot" section with 7 day tabs (Segmented pills) appears; today's tab only lists windows that have not started and a day without capacity is disabled; choose a day and click the radio card "10:00–12:00" → the card gets the accent border and light fill, no price is shown on cards. The summary now shows Delivery **$5.00** (commercetools shipping method `standard`, free above $50.00) and under it "Delivery slot: <day>, 10:00–12:00"; Checkout is still disabled with "Checkout opens soon..." (V enables it). Add products until the subtotal exceeds $50.00 → Delivery reads "Included" and the total drops by $5.00. Merchant Center → Carts: the cart has the shipping address, shipping method "Standard delivery" and custom fields `slotId`, `slotStart`, `slotEnd`, `slotHoldExpires`. Also try "Remove slot" → the slot line disappears and the Checkout note says "Choose a delivery slot to continue.". Repeat once on `/de-DE/cart` (Country defaults to Deutschland, postcode `10115`): same behaviour, Delivery shows EUR. Then review SO-02.
- M-Q-2: On `/en-US/cart` with an address and a chosen slot (M-Q-1) change the Postcode to `99999` and press "Save address" → the field shows "We do not deliver to this postcode yet.", the slot picker disappears, a notice "Your delivery slot was removed because the address changed..." shows, the summary has no slot line and the Checkout note says "We do not deliver to this postcode yet."; also try `00501` and `1234` (invalid shape: "Enter a valid postcode." before any request, DevTools → Network shows no PUT to `/api/cart/address`) and an empty form ("This field is required." under 5 fields). Change back to `10001` and save → slots appear again, you must choose a slot again. Choose Country `Deutschland` with `10115` on the US store → "Delivery to this country needs the other store. Switch the region in the header." (HTTP 422 `COUNTRY_MISMATCH`, nothing changes on the cart; see Q-Q-1).
- M-Q-3: Temporarily set `capacity: 1` in `site/lib/config/slots.ts` and restart `npm run dev`. Window A: open `/en-US/cart` with items, save a US address (`10001`) and pick tomorrow's "10:00–12:00". Window B (private window, other session): add an item, save an address, open the slot list → tomorrow's "10:00–12:00" is **not listed**; the other windows are. Then in window A press "Remove slot" and in window B reload the page → the window is listed again. Race: keep a stale list open in window B before A picks, then pick the window in B → the message "That slot was just taken. Please pick another." appears (HTTP 409 `SLOT_FULL` in Network) and the list refreshes without that window. Restore `capacity: 10` afterwards.
- M-Q-4: Stub limits: (a) choose a slot, stop `npm run dev` and start it again, reload `/en-US/cart` → the slot still shows as chosen (it is stored on the cart in commercetools) but the capacity count was reset (documented limitation, SO-12; V re-holds the slot when the checkout session is created). (b) Choose a slot and wait 15 minutes without touching the page (or set `holdMinutes: 1` in `site/lib/config/slots.ts`, restart, pick a slot and wait one minute) → without reloading, the card is unselected, "Your slot reservation ran out. Please choose a slot again." shows, the summary slot line disappears and the Checkout note says "Choose a delivery slot to continue.". Restore `holdMinutes: 15`.

## Definition of done
Stub service fully tested with an injected clock; deviation SO-12 requested; `verify` passes.

## Implementation notes (deviations, recorded by the developer)
- **Live findings (`PROJECT-FINDINGS.md` §16):** `standard` costs 5.00 USD and is free above 50.00 USD; re-applying `setCustomType` resets the fields, so it is sent only when the cart has no custom type; removing an unset custom field is a 400, so `clearSlot` removes only fields that are present; a DE address on a USD cart fails (see Q-Q-1).
- `lib/ct/cart-delivery.ts` functions take no `version` argument: they run inside J's `withCartRetry(cartId, fn)`, which supplies the fresh cart and version (`setShippingAddress(cartId, address)`, `setSlot(cartId, slot | null)`, `clearSlot(cartId)`, `ensureShippingMethod(cartId)`; the last throws `ShippingMethodUnavailableError` when `standard` does not match the cart and is a no-op when it is already selected). `lib/ct/cart.ts` now exports `updateCart(cartId, version, actions)` (was private `update`).
- `SlotService.confirmBooking(slotId, orderId, cartId?)` has an optional third argument: V should pass the cart id so that cart's hold becomes the booking (without it the oldest hold on that slot is converted). The stub ignores country and postcode (capacity is global) and uses UTC.
- `lib/slots/window.ts` (`slotWindow`, `parseSlotId`, `slotIdOf`) is shared by the stub and the slot route; `SlotDay`/`SlotDaysBody` types are in `lib/slots/types.ts` (client safe); `lib/slots/index.ts` also exports `setSlotService()` as a test seam.
- `getSlotDays(cart, { service?, now? })` returns `{ ok: true, days, nextAvailableDate? } | { ok: false, error: 'NO_ADDRESS' | 'UNDELIVERABLE' }` and lists all 7 days (days without capacity have `slots: []`, the UI disables those tabs). V should use it for the "slot filled before handoff" check.
- Routes: `PUT /api/cart/address` (400 `INVALID_ADDRESS` + `fields`, 422 `COUNTRY_MISMATCH`, 422 `SHIPPING_UNAVAILABLE`, 422 `UNDELIVERABLE` with `{ cart, slotCleared }` and the address saved but no shipping method, 200 `{ cart, slotCleared }`), `GET /api/slots` (400 `NO_ADDRESS`, 422 `UNDELIVERABLE`), `PUT /api/cart/slot` (400 `INVALID_SLOT|UNKNOWN_SLOT|NO_ADDRESS`, 422 `UNDELIVERABLE`, 409 `SLOT_FULL` with `days`), `DELETE /api/cart/slot`. See Q-Q-1 and Q-Q-2. `lib/cart-api.ts` gained `getSessionCart()`, `cartSlotId(cart)` and an options argument on `cartJson(cart, market, patch, { extra, status })`.
- A slot counts as chosen only while `slotHoldExpires` is in the future (`isSlotActive` in `lib/cart-rules.ts`); an expired slot is shown as not chosen with `cart.slotExpired` and `canCheckout` is false (Q-Q-3).
- `lib/cart-rules.ts`: `canCheckout(cart, now?)` and `checkoutBlock(cart, now?)` (`EMPTY | OUT_OF_STOCK | NO_ADDRESS | UNDELIVERABLE | NO_SLOT`). `CartSummary` takes an optional `onCheckout`: the button is enabled only when `canCheckout` is true **and** `onCheckout` is given, so V passes the handler (J's "checkout opens soon" text remains until then). The J test that expected that text for an address-less bag now expects "Add a delivery address to continue.".
- UI files: `components/cart/{CartDeliveryStep,AddressForm,SlotPicker}.tsx`, `hooks/useDelivery.ts` (`useSlots`, `useDeliveryMutations`: `saveAddress`, `pickSlot`, `clearSlot`, which never throw on API errors and write the returned cart into `KEY_CART`), `keySlots()` in `lib/cache-keys.ts`. The saved-address picker for signed-in shoppers is left to S: `AddressForm` takes `address` and `onSave`.
- Messages (Q-09 content) were added with Q-07 under `cart.step.*` and flat `cart.{slotCleared,noSlots,nextAvailable,slotTaken,slotExpired,chooseSlot,addAddress,slotLine}` (`cart.delivery` already exists as a string). German uses the informal "du" like the rest of the file; marked for review in `IDEAS.md`.
- Sign-offs: SO-12 is already APPROVED; SO-02 (delivery step design, not drawn) awaits the owner after M-Q-1.

## ADDED Requirements

### Requirement: Slot capacity service (stub)

The app SHALL define a `SlotService` interface in `lib/slots/` with `listSlots(address, fromDate, days)`, `holdSlot(slotId, cartId, ttlMinutes)`, `releaseHold(cartId)` and `confirmBooking(slotId, orderId)`, and a JSON/in-memory implementation seeded with the next 7 days of 2-hour windows between 08:00 and 20:00 and a capacity of 10 per window. The implementation SHALL be replaceable without changes to callers.

#### Scenario: Full slot hidden
- **WHEN** a slot's remaining capacity is 0
- **THEN** `listSlots` omits it

#### Scenario: Hold expires
- **WHEN** a hold is older than its TTL
- **THEN** its capacity is released

### Requirement: Cart pre-checkout step

The cart page SHALL show, above the summary, a delivery step with the delivery address form (or saved address for signed-in customers) and, after a deliverable address is set, a slot picker grouped by day with times and charges. The selected slot SHALL be written to the cart `cart-delivery` custom fields.

#### Scenario: Pick a slot
- **WHEN** a shopper with a deliverable address selects Tuesday 10:00–12:00
- **THEN** the cart stores the slot fields and the summary shows the slot and its charge

#### Scenario: No capacity
- **WHEN** no slot has capacity for the address
- **THEN** the picker states that nothing is available and shows the next date with capacity

### Requirement: Address change revalidates

Changing the delivery address SHALL revalidate the selected slot and clear it, with a notice, when it no longer applies.

#### Scenario: New address outside area
- **WHEN** the address changes to one the stub marks undeliverable
- **THEN** the slot is cleared and the shopper is prompted to choose again

### Requirement: Handoff validation and booking

Starting checkout SHALL require a selected slot, SHALL re-check capacity and hold the slot for 15 minutes when the checkout session is created, and SHALL refuse with the reason and a fresh slot list if the slot filled. The confirmation page SHALL confirm the booking for the order id. (Placement-time rejection is not possible with hosted Checkout — D-042.)

#### Scenario: Slot filled before handoff
- **WHEN** the selected slot filled while the shopper browsed
- **THEN** checkout does not start, the selection is cleared and current slots are offered

#### Scenario: Confirmation
- **WHEN** the order completes
- **THEN** the hold becomes a booking tied to the order id and the confirmation shows the slot

### Requirement: Slot display on orders

Order detail SHALL show the booked slot and its charge.

#### Scenario: Order with slot
- **WHEN** an order carries slot fields
- **THEN** order detail displays them

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Delivery slot selection with finite capacity

## Purpose

Grocery fulfillment capacity is finite per slot per location, and a slot sold twice becomes a failed delivery rather than a late one. Capacity therefore has to be checked at selection and again at order placement, because slots fill while a shopper is still in checkout.

## Requirements

### Requirement: Delivery slot selection with finite capacity

The system SHALL offer only delivery slots with remaining capacity for the shopper's address, and reject an order placed against a slot whose capacity is exhausted at the moment of placement.

#### Scenario: Slot selected and priced
- **GIVEN** a cart with a deliverable address
- **WHEN** the shopper opens the slot picker
- **THEN** only slots with remaining capacity for that address are offered, each with its delivery charge

#### Scenario: Slot exhausted before placement
- **GIVEN** the shopper selected a slot that has since filled
- **WHEN** the shopper submits the order
- **THEN** placement is refused with the reason, the slot selection is cleared, and current slots are offered again

#### Scenario: Address change revalidates
- **GIVEN** a cart with a selected slot
- **WHEN** the shopper changes the delivery address
- **THEN** the slot selection is revalidated against the new address and cleared if it no longer applies

#### Scenario: No capacity at all
- **GIVEN** no slot has remaining capacity for the shopper's address
- **WHEN** the shopper opens the slot picker
- **THEN** the absence of availability is stated explicitly, with the next date that has capacity

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Slot picker with remaining availability | `[MIDDLEWARE]` | Capacity is external state, queried per cart address |
| Slot price or premium-slot surcharge | `[MIDDLEWARE]` | ShippingMethod zoneRates; recalculated on every change |
| Slot held on the cart until placement | `[MIDDLEWARE]` | Cart custom field; revalidated at placement |

## commercetools

**Entities:** `ShippingMethod`, `Zone`, `Cart`, `Order`, `Type`, `Channel`, `Store`

**Verified API surface**

- (rest) GET shipping-methods matching-cart returns only the methods valid for the current cart, given its address, contents and the project's Zones - use it rather than filtering the full list client-side — [docs](https://docs.commercetools.com/api/projects/shippingMethods)
- (update-action) Cart setShippingMethod sets the chosen method; the API rejects a method that does not match the cart's conditions, and the cart returns recalculated shippingInfo.price and taxedPrice — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/shipping)
- (concept) ShippingMethod predicates on cart fields (for example store.key, or a cart custom field set by the BFF or an API Extension) are how slot eligibility narrower than a Zone's country/state pair is expressed — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/apply-stores-and-channels)

**Constraints that change the design**

- commercetools has no delivery-slot resource. Slot capacity is external state; commercetools carries the shopper's selection and the charge, not the capacity ledger — [docs](https://docs.commercetools.com/api/shipping-delivery-overview)
- Setting the shipping address or method triggers automatic recalculation of shipping cost, taxes and available options - the storefront must re-read the cart after each, or it will show mismatched totals — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/shipping)

**Modeling notes**

Model the slot as a ShippingMethod only where the set of slots is small and stable; otherwise keep slots in the capacity service and carry the booked slot as a cart custom field, using a single ShippingMethod for the delivery type. Zones only express country and state pairs, so any finer geography (postcode, metro area) needs a predicate over a cart custom field that the BFF or an API Extension maintains. Capacity must be re-checked at placement, not only at selection.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Who owns slot capacity, and can it be queried synchronously within checkout latency budget?
- Is a slot held on selection, or only checked - and if held, for how long?

---

_Excluded for B2C: Recurring slot for a standing order; Slot capacity scoped to the fulfilling seller._

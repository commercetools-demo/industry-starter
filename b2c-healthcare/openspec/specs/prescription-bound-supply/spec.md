<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Supply bound to an authorization, and to what is left on it

## Purpose

An authorization to supply — a prescription, a referral, a plan approval — is not a discount code and not a permission flag. It is a quantity that depletes and a window that closes, issued for one recipient and one set of parameters, and the commerce system is usually the only place that knows how much of it has been used. Model it as a flag and the same authorization can be redeemed indefinitely; model it as a one-shot voucher and a patient authorized for six months of supply can collect it once. The parameters matter as much as the count: what was supplied has to be readable from the order afterwards, because the authorization itself may be amended or withdrawn, and an order that only holds a pointer to it can no longer say what was actually dispensed or on what basis. The timing of the decrement is the subtle part. Consume the authorization when the item enters the basket and every abandoned cart quietly eats a patient's entitlement; consume it after fulfillment and two concurrent orders can each pass the check.

## Requirements

### Requirement: Supply bound to an authorization, and to what is left on it

The system SHALL supply a product that requires a patient authorization only against an authorization that is within its validity window and has enough remaining quantity for the amount requested, reducing what remains by the amount actually ordered.

#### Scenario: Supply within the authorization
- **GIVEN** an authorization in date with remaining quantity
- **WHEN** an order is placed for no more than what remains
- **THEN** the order is accepted and the remaining quantity is reduced by the amount ordered

#### Scenario: Request exceeds what remains
- **GIVEN** an authorization with less remaining than the amount requested
- **WHEN** the order is submitted
- **THEN** the excess is not supplied, and the amount still available is stated

#### Scenario: Authorization outside its window
- **GIVEN** an authorization whose validity window has closed
- **WHEN** supply is attempted against it
- **THEN** the supply is refused, and expiry is given as the reason rather than exhaustion

#### Scenario: Parameters readable from the order
- **GIVEN** a supplied line placed against an authorization
- **WHEN** the authorization is later amended or withdrawn
- **THEN** the order still states the parameters and quantity that were supplied at the time

#### Scenario: Abandoned cart consumes nothing
- **GIVEN** a cart holding an authorized line
- **WHEN** the cart is abandoned or the line removed
- **THEN** the remaining quantity is unchanged

#### Scenario: Standing replenishment stops at the window
- **GIVEN** a repeating supply running against an authorization
- **WHEN** the authorization lapses or is exhausted between runs
- **THEN** the next run does not place an order, and the reason is recorded

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Authorization held against the recipient | `[MIDDLEWARE]` | Its parameters, the quantity it permits and the window it is valid in |
| Authorization requirement declared on the product | `[CACHED]` | A fact about the goods, resolved before the basket is priced |
| Remaining quantity derived from what has already been supplied | `[MIDDLEWARE]` | Issued quantity minus everything previously dispensed against it |
| Validity window compared with the supply date | `[MIDDLEWARE]` | Not the date the authorization was issued or the cart created |
| Parameters copied onto the line | `[MIDDLEWARE]` | Readable from the order without re-reading the authorization |
| Single decrement at order placement | `[MIDDLEWARE]` | Late enough that abandonment costs nothing, early enough to stop a double claim |
| Repeat supply stopped when exhausted or lapsed | `[MIDDLEWARE]` | A standing replenishment is not a standing entitlement |

## commercetools

**Entities:** `Product`, `ProductType`, `Cart`, `LineItem`, `Order`, `Type`, `CustomObject`, `RecurrencePolicy`, `RecurringOrder`, `Extension`

**Verified API surface**

- (concept) A Recurring Order defines the schedule and configuration for automatically creating and placing future Orders at regular, predefined intervals on behalf of a customer, and acts as the base for generating new Orders according to the specified recurrence schedule — [docs](https://docs.commercetools.com/api/recurring-orders-overview)

**Constraints that change the design**

- A Recurrence Policy offers exactly two schedule shapes — StandardSchedule of daily, weekly or monthly intervals, and DayOfMonthSchedule for a specific date each month — so the schedule is the whole of the condition, and a supply that must stop when an authorization lapses has to be stopped from outside the policy — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- Every customizable resource can be extended with only one Type at a time, though that Type may contain any number of fields — so the authorization fields on a Line Item share their Type with every other custom field that line needs — [docs](https://docs.commercetools.com/learning-model-your-business-structure/extensibility/data-model-extensions)
- Custom Fields cannot be assigned to Products; a Product's data is extended through Product Types and their Attribute definitions instead, so the marker that says a product needs an authorization is a Product Type Attribute, not a Custom Field — [docs](https://docs.commercetools.com/learning-model-your-business-structure/extensibility/data-model-extensions)
- An API Extension can validate a Cart update and reject it with a 400 and an errors array, which is where a remaining-quantity check has to sit if it is to survive a request made directly against the API rather than through the storefront — [docs](https://docs.commercetools.com/guides/extensions)

**Modeling notes**

The authorization itself does not belong in commercetools. It is clinical data with its own lifecycle, its own author and its own retention rules, and putting it here creates a second system of record that will disagree with the first. What belongs here is the consumption ledger: which order consumed how much of which authorization, and when. Keep the authorization reference plus the parameters as they stood in Custom Fields on the Line Item, and hold the running total either in the owning clinical system or in a Custom Object keyed by authorization reference. Decrement on order creation, in the same API Extension that validates it, and make the decrement idempotent on the order id — retries and concurrent submissions are the realistic failure, not malice. For repeating supply, a Recurrence Policy will schedule the runs but will not stop them: the schedule is the only condition it expresses, so a gate that checks the authorization before each generated order is not optional, and the run that is blocked needs somewhere to record why or it looks like an outage. Mark the product with a Product Type Attribute rather than a Custom Field — Products cannot carry Custom Fields at all — and make it searchable, because the storefront needs to know before the basket is priced.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system owns the remaining quantity, and what happens when the commerce ledger and the clinical record disagree?
- May a partial amount be supplied when less remains than was requested, or is the whole line refused?
- When an order is canceled or returned, is the consumed quantity restored, and after which step?
- How long after the window closes may an already-placed order still be fulfilled?

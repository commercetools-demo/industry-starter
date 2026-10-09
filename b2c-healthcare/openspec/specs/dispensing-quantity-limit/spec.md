<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Quantity ceilings that hold across a period, not just a basket

## Purpose

Quantity control here is not anti-hoarding merchandising. Ceilings exist because a clinical product is rationed by a payer, allocated during shortage, or unsafe above a certain supply interval, and the consequence of exceeding one is a claim rejection, a stockout somewhere else, or a patient with more of something than they should have. That changes two things about how it must work. First the period: a limit of thirty per order is not a limit at all if the same buyer can place four orders in an afternoon, so the count that matters is cumulative across orders within a window, which is a very different computation from anything a basket can do on its own. Second the enforcement point: every organization that has had this requirement has also had the experience of a limit implemented in the storefront and promptly routed around, either deliberately or by an integration that never saw the storefront at all. A ceiling that only exists in the page is a reporting artefact. The refusal also has to be informative — a buyer told only "too many" will retry with a smaller number until something sticks, which is a worse use of everybody's time than saying what remains.

## Requirements

### Requirement: Quantity ceilings that hold across a period, not just a basket

The system SHALL enforce a per-item quantity ceiling for a party over a defined period, counting what that party has already ordered within the period and refusing the excess wherever the request arrives from.

#### Scenario: Order within the ceiling
- **GIVEN** a party whose ceiling for an item has not been reached in the current period
- **WHEN** they order up to what remains
- **THEN** the order is accepted

#### Scenario: Single request exceeding the ceiling
- **GIVEN** an item with a ceiling
- **WHEN** a quantity above it is requested in one go
- **THEN** the excess is refused, and the ceiling and the quantity still available are both stated

#### Scenario: Second order inside the same period
- **GIVEN** a party who has already ordered up to the ceiling earlier in the period
- **WHEN** they place another order for the same item
- **THEN** it is refused on the cumulative count, not treated as a fresh basket

#### Scenario: Request arriving outside the storefront
- **GIVEN** a quantity above the ceiling submitted directly against the commerce API
- **WHEN** the cart is updated or the order created
- **THEN** it is refused on the same terms as a request made through the storefront

#### Scenario: Period rolls over
- **GIVEN** a party who reached the ceiling in the previous period
- **WHEN** the period rolls over
- **THEN** the full ceiling is available again

#### Scenario: Ceiling lowered while a cart is open
- **GIVEN** an open cart whose quantity was legal when it was built
- **WHEN** the ceiling is lowered and the cart is next updated
- **THEN** the line is brought within the new ceiling or reported, and is not orderable above it

#### Scenario: Override where permitted
- **GIVEN** an account permitted to exceed a ceiling with authorization
- **WHEN** an authorized override is applied
- **THEN** the order proceeds and records the override, its approver and its reason

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Ceiling defined per item and per party | `[MIDDLEWARE]` | Two accounts buying the same product may hold different ceilings |
| Period the ceiling is measured over | `[MIDDLEWARE]` | Rolling or calendar, but stated, not implied by the basket |
| Consumption counted from orders already placed | `[MIDDLEWARE]` | Placed orders in the period, not lines in the current cart |
| Enforcement below the storefront | `[MIDDLEWARE]` | A rule only the page applies is not a rule |
| Refusal stating the ceiling and the remainder | `[MIDDLEWARE]` | So the buyer can order what they are allowed to, first time |
| Ceiling changes reaching open baskets | `[MIDDLEWARE]` | A lowered ceiling must not be escaped by an old cart |

## commercetools

**Entities:** `InventoryEntry`, `Cart`, `LineItem`, `Order`, `CustomObject`, `Type`, `Extension`, `BusinessUnit`, `Customer`

**Verified API surface**

- (concept) Cart quantity boundaries, minCartQuantity and maxCartQuantity on the InventoryEntry, can restrict how many units a Customer can add — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)
- (update-action) setInventoryLimits on an inventory entry takes minCartQuantity and maxCartQuantity, and the limits are enforced by the platform whenever a Line Item is added or updated, returning errors such as LineItemQuantityBelowLimit — [docs](https://docs.commercetools.com/certifications/composable-commerce-functional-refresher-2026/carts-and-orders)

**Constraints that change the design**

- Native quantity limits are set per inventory entry and evaluated per Cart, so they cannot express a ceiling that belongs to one buying party, and they cannot accumulate across separate orders or across a period — both of those have to be computed outside the platform — [docs](https://docs.commercetools.com/certifications/composable-commerce-functional-refresher-2026/carts-and-orders)
- Introducing or changing quantity limits can impact existing Line Items in Carts: the next time a Cart is updated after a limit change, any Line Item quantity that is now too high or too low will be removed, and a Cart update that would violate the new limits is rejected in its entirety — [docs](https://docs.commercetools.com/certifications/composable-commerce-functional-refresher-2026/carts-and-orders)
- An API Extension validates a Cart update by responding 400 with an errors array and the platform attributes the failure through errorByExtension, which is the enforcement point that a request made directly against the API cannot avoid — [docs](https://docs.commercetools.com/guides/extensions)

**Modeling notes**

Use both mechanisms and know which does what. Native inventory limits are free, enforced by the platform on every add and update, and impossible to route around — use them for any ceiling that is genuinely a property of the product rather than of the buyer, such as a maximum per basket during an allocation. They will not do the real job here, because they sit on the inventory entry and are evaluated within one cart: they know nothing about who is buying or what that party ordered last week. The per-party, per-period ceiling belongs in an API Extension on cart update and order creation, reading a running total held outside the cart. Keep that total as a Custom Object keyed by party and item and period, written when the order is created, and make the write idempotent on the order id — the realistic failure is a retry, not an attack. Note the native limits' side effect before you enable them: lowering a limit silently removes offending Line Items from carts on next update, and rejects the whole update if the change would violate it, so a limit change during a busy period will look to buyers like their basket emptied itself. Decide whether the period is rolling or calendar before writing any of it; the two produce different answers on the same data, and the choice is a policy question the implementation cannot make.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Is the period rolling from the last order or fixed to a calendar boundary, and who decides per item?
- Does a canceled or returned order restore the consumed quantity, and at which step?
- Does the ceiling belong to the ordering account, the receiving patient, or the delivery destination?
- Who may authorize an override, and does an override consume the next period's allowance?

---

_Excluded for B2C: Permitted override recorded with its reason._

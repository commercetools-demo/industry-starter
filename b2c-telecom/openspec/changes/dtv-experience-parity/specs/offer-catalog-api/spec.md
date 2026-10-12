## ADDED Requirements

### Requirement: Filtered offer list

The system SHALL provide `GET /api/offers` returning the offers visible to the buyer context, filtered by `kind` (`base-package`, `addon`, `equipment`, `device`, `bundle`), `family` (`phone`, `home-wireless`, `cable`), `customerType`, `existingCustomer` (`true`, `false`), `postalCode`, and paging (`limit`, `offset`). Filtering SHALL use the shared eligibility resolution, never a second predicate list, and prices SHALL be those of the buyer's customer group and channel.

#### Scenario: Base packages
- **WHEN** `GET /api/offers?kind=base-package&family=cable` is called
- **THEN** it returns the cable plans the buyer may buy, each with key, name, kind, family, price for the market, charge kind, the first-month promotion flag and the keys of its included offers

#### Scenario: Existing customer filter
- **WHEN** `existingCustomer=true` is passed by an anonymous caller
- **THEN** offers restricted to new customers are absent and offers restricted to existing customers are present

#### Scenario: Invalid filter value
- **WHEN** `kind=unicorn` or `existingCustomer=maybe` is passed
- **THEN** the response is 400 `INVALID_FILTER` naming the field; an unknown value is never silently dropped

#### Scenario: Location filter
- **WHEN** `postalCode=94105` is passed
- **THEN** only offers served at that ZIP by technology and allowed in that state are returned, and the response says whether the ZIP was in the serviceability table or a default rule applied

#### Scenario: Paging envelope
- **WHEN** more offers exist than `limit`
- **THEN** the response includes `total`, `limit`, `offset` and `count`, and each offer appears exactly once across pages

#### Scenario: Never cached across buyers
- **WHEN** two buyers with different contexts call the same URL
- **THEN** each gets their own result and `Cache-Control` is `private, no-store`

### Requirement: Offer detail with resolved relations

The system SHALL provide `GET /api/offers/[key]` returning one offer with three resolved groups, `included`, `compatibleAddons` and `compatibleEquipment`. Every item SHALL carry its offer data, its price for the buyer and its verdict from the shared compatibility evaluation (`allowed`, `included`, or `unavailable` with a reason code and text).

#### Scenario: Detail groups
- **GIVEN** the Cable 500 plan
- **WHEN** its detail is requested
- **THEN** `included` lists the modem, `compatibleAddons` lists each add-on with its verdict, and `compatibleEquipment` lists each equipment item with its verdict, including those unavailable with reasons

#### Scenario: Ineligible offer is absent
- **GIVEN** an offer the buyer is not eligible for
- **WHEN** its detail is requested
- **THEN** the response is 404 `OFFER_NOT_FOUND`, the same as for a key that does not exist

#### Scenario: Group contents match the cards
- **GIVEN** the same plan on a listing card and in the detail response
- **WHEN** both are compared
- **THEN** every item has the same verdict and the same price, because both call the same evaluation and price selection

### Requirement: Pricing preview

The system SHALL provide `POST /api/pricing/preview` that accepts a plan, extras and quantities, prices them in one throwaway cart through the commercetools engine for the buyer context, deletes the cart, and returns `dueToday`, `thenMonthly`, `lines`, `promotions` and `issues`. `dueToday` is what the engine would charge for the order placed now; `thenMonthly` is the sum of the engine-selected recurring prices of the recurring lines before first-order promotions, which is what recurring orders will charge. It SHALL NOT create any persistent cart or order and SHALL NOT change the buyer's own cart.

#### Scenario: Preview returns both figures
- **GIVEN** a request with Cable 100 and a router rental
- **WHEN** it is posted
- **THEN** `dueToday` excludes the free first month, `thenMonthly` is the plan's standing price plus the rental, each line has its engine total, and `promotions` names the first-month promotion with its amount off

#### Scenario: No side effects
- **GIVEN** any preview request
- **WHEN** it completes, including when it fails
- **THEN** the probe cart has been deleted and the buyer's session cart is unchanged

#### Scenario: Refused candidate returns issues
- **GIVEN** a request including an extra the rules refuse
- **WHEN** it is posted
- **THEN** the response is 200, the extra is listed in `issues` with its reason, and the figures cover the accepted items only

#### Scenario: Validation
- **GIVEN** an unknown plan key or a non-positive quantity
- **WHEN** it is posted
- **THEN** the response is 400 with a typed code and nothing is created

#### Scenario: Same origin and rate limit
- **GIVEN** a request from another origin, or above the configured rate
- **WHEN** it arrives
- **THEN** it is refused with 403 or 429 before any commercetools call

#### Scenario: Cleanup under failure
- **GIVEN** a failure after the probe cart was created
- **WHEN** the request ends
- **THEN** the cart is still deleted, and a leftover probe cart is identifiable by its key prefix (`preview-probe-`) and expires on its own (`deleteDaysAfterLastModification`), so that a sweep can remove it

#### Scenario: Preview agrees with the bundle
- **GIVEN** the same plan and extras added to the real cart
- **WHEN** `/bundle` shows its totals
- **THEN** "Due today" and "Then monthly" equal `dueToday` and `thenMonthly` of the preview

### Requirement: Stable, typed errors

The offer and preview APIs SHALL use the existing error body `{ error: { code, message, details? } }` and the existing origin-check conventions, and SHALL NOT leak commercetools error text.

#### Scenario: Upstream failure
- **GIVEN** commercetools is unreachable
- **WHEN** any of the three routes is called
- **THEN** the response is 502 `UPSTREAM_UNAVAILABLE` with a generic message

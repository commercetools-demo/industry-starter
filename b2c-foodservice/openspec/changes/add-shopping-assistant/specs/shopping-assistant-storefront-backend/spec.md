## ADDED Requirements

### Requirement: The storefront's own modules are the only commerce data source
The assistant backend SHALL read the catalogue, the shopper's bag and the shopper's own orders only through the storefront's server modules (`lib/ct/*` and `lib/mappers/*`), built by the route layer with the shopper's cookie session and market. Code under `lib/agent/**` SHALL NOT import `lib/ct/*`, `lib/mappers/*`, `lib/session` or any `@commercetools/*` package; the backend reaches the agent only through the `StorefrontBackend` interface. (Workstream T2, decision D-055; the Shopper MCP is removed.)

#### Scenario: Boundary enforced
- **WHEN** a file under `lib/agent/` imports `@commercetools/platform-sdk` or `@/lib/ct/*`
- **THEN** lint fails

#### Scenario: Only scoped capabilities exist
- **WHEN** the tool list is built
- **THEN** it contains no tool that places an order, sets an address, shipping method, payment or discount code, and no policy, fulfilment or memory-writing capability

### Requirement: The shopper's session and market scope every call
Every backend call SHALL use the session the signed cookie carries and the market from `getMarket()`. No request body, tool argument or model output SHALL choose a customer, cart, market or locale.

#### Scenario: Body values ignored
- **WHEN** a turn body carries a cart id or a customer id
- **THEN** the backend still acts for the cookie's shopper only

#### Scenario: Guest
- **GIVEN** a guest session
- **WHEN** an order is asked for
- **THEN** the backend answers `SignInRequired`

### Requirement: Storefront failures are interpreted, never leaked
The backend SHALL map a storefront `not_found` to an unknown result, a rejected line or a `validation_failed` to an `Unavailable` that names ids only, and any other failure to one generic temporary-failure error. The original storefront message, a token or a project key SHALL NOT appear in any value the agent receives.

#### Scenario: Index down
- **WHEN** the search cannot run
- **THEN** the call throws, the tool reports itself unavailable and the model does not claim the store sells nothing

#### Scenario: Genuinely empty
- **WHEN** the search runs and matches nothing
- **THEN** the result is an empty list meaning "nothing matched"

### Requirement: Search covers both brands and says what it dropped
Search SHALL run over all products (no brand in the search context). The agent's sort maps to a listing sort the shop supports. A price, rating or attribute filter the backend cannot apply SHALL be dropped and a note SHALL be appended to the tool result saying so. A family SHALL appear once.

#### Scenario: Dropped price ceiling
- **WHEN** the model passes a price filter
- **THEN** the result says the price limit could not be applied

#### Scenario: Both brands
- **WHEN** a search runs in a session that has switched brand
- **THEN** products of both brands can appear

### Requirement: Ids
A plain product and a variant are addressed by SKU. A product with more than one variant is a family addressed by `fam:<defaultSku>`, which no cart write accepts. Decoding SHALL never throw; an unknown string is a SKU.

#### Scenario: Family id refused for the cart
- **WHEN** `add_to_cart` receives a `fam:` id
- **THEN** the call is held with the options hold, listing the variant SKUs

#### Scenario: Unknown string
- **WHEN** a string matching no form is decoded
- **THEN** it is treated as a SKU and the catalogue returns null for it

### Requirement: Stock is read once per search, and says when it could not be read
Search results SHALL carry stock from one inventory read for the page (not the eventually consistent variant availability). If that read fails, results stay in with a note that stock could not be checked.

#### Scenario: Out of stock
- **WHEN** a result's default SKU has no online stock
- **THEN** the result is marked not in stock

### Requirement: Money crosses one boundary
Storefront integer minor-unit amounts SHALL be converted to major units in exactly one module (`lib/agent/shopping/money.ts`) using the currency's fraction digits. A cart line's unit price SHALL be the line total divided by the quantity, computed in minor units; zero quantity yields 0. The checkout card totals SHALL stay in minor units and come from the storefront's cart read.

#### Scenario: Magnitude
- **WHEN** a 34900 USD amount arrives
- **THEN** the card shows $349.00, never $3.49

#### Scenario: Line with a discount
- **GIVEN** a line whose total differs from unit price × quantity
- **THEN** the derived line total equals the storefront line total to the minor unit

### Requirement: Absent means absent
A rating, review count, image, stock level, delivery estimate or tracking URL the storefront did not supply SHALL be omitted from serialized payloads and cards, never zero or a placeholder fact. A product with no price in the market is not offered.

#### Scenario: No rating
- **WHEN** a product has no rating
- **THEN** its card shows no stars

### Requirement: The assistant's bag is the shopper's bag
Cart reads and writes SHALL go through the storefront cart module with the shopper's session. There is no second cart and no adopt step. A bag is created only when the assistant session starts and the shopper has none, before the session cookie is written. If the bag is lost during a turn, a cart write answers that the bag was reset and the shopper should reload; no bag is created in the turn.

#### Scenario: Add shows at once
- **WHEN** the assistant adds a variant
- **THEN** the header badge and the bag page show the line without an adopt step

#### Scenario: Lost bag
- **WHEN** the session's bag is gone during a turn and the model adds a product
- **THEN** the add answers that the bag was reset and creates nothing

#### Scenario: Out-of-stock variant
- **WHEN** the add targets an out-of-stock variant
- **THEN** the message names the variant SKU and the in-stock sibling SKUs and nothing else

### Requirement: Fenced payload cap
The widest model-facing product payload for the real catalogue SHALL stay under the fenced character cap, checked by a script that fails over the cap and prints the widest product (workstream T, T-17).

#### Scenario: Large family
- **WHEN** the script runs against the catalogue
- **THEN** it prints the widest payload size and exits non-zero above the cap

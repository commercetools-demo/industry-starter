## ADDED Requirements

### Requirement: Brand registry
The system SHALL define each brand (`malva-coffee`, `malva-drinks`) in one registry holding its product selection key, inventory channel key, pickup flag, theme, home and PDP variants and display name. No other file SHALL hard-code a brand rule.

#### Scenario: Unknown brand
- **WHEN** a request path starts with a segment that is neither a brand nor a legacy locale
- **THEN** the system responds with the not-found page

### Requirement: Brand and locale URL scheme
The system SHALL serve storefront pages at `/{brand}/{locale}/...` where locale is `en-US` or `en-CA`. `/api/*` SHALL stay unprefixed and shared by both brands.

#### Scenario: Brand page
- **WHEN** a visitor opens `/malva-drinks/en-US`
- **THEN** the Malva Drinks home page renders in the US market

### Requirement: Default brand redirect
The system SHALL redirect `/` and `/{locale}/...` to `/malva-coffee/{locale}/...`, preserving path and query. When no locale is given, the market cookie or the default locale SHALL be used.

#### Scenario: Root
- **WHEN** a visitor opens `/` with no cookies
- **THEN** the response is a redirect to `/malva-coffee/en-US`

#### Scenario: Legacy product link
- **WHEN** a visitor opens `/en-CA/p/some-product?x=1`
- **THEN** the response is a redirect to `/malva-coffee/en-CA/p/some-product?x=1`

### Requirement: Brand switcher
The system SHALL show a tab-style brand switcher above the header on every page. The current brand SHALL be the first tab and marked as selected; the other brand follows. Choosing a tab SHALL navigate to the home page of that brand in the current locale.

#### Scenario: Drinks active
- **WHEN** the visitor is on `/malva-drinks/en-US/c/sparkling`
- **THEN** the tabs read "Malva Drinks" (selected), "Malva Coffee", and the second tab links to `/malva-coffee/en-US`

### Requirement: Shared pages keep the brand
Cart, checkout, account and order pages SHALL live under the brand the visitor came from, show the same shared content, and keep the brand in all internal links.

#### Scenario: Cart from drinks
- **WHEN** the visitor opens the cart from `/malva-drinks/en-US`
- **THEN** the URL is `/malva-drinks/en-US/cart` and the cart lists lines of both brands

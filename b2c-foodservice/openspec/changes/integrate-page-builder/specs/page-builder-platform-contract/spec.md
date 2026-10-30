## ADDED Requirements

### Requirement: Single renderer mount
The storefront SHALL render page-builder pages through one shared renderer built on `@commercetools-labs/page-builder`. The home route, the category listing route, the product route and the `[...rest]` catch-all SHALL all call it. The storefront SHALL NOT hold a commercetools client, data resolver or page cache for page-builder content.

#### Scenario: Routes share one renderer
- **WHEN** a shopper opens `/en-US`, `/en-US/category/pods`, a product page or `/en-US/about`
- **THEN** each route obtains its page from the same renderer module

#### Scenario: No page content cache in the client
- **WHEN** the same path is requested twice
- **THEN** the storefront issues a render call each time and keeps no framework cache of the response

### Requirement: Request context
For every render call the storefront SHALL send the path without its locale segment, plus `locale`, `currency` and `country` taken from the market configuration (`COUNTRY_CONFIG`) of the URL locale. It SHALL NOT send `store`. It SHALL forward the raw query string unchanged as `search`.

#### Scenario: Locale segment removed from the path
- **WHEN** the shopper opens `/en-CA/category/pods`
- **THEN** the render call carries path `/category/pods`, locale `en-CA`, currency `CAD`, country `CA` and no `store`

#### Scenario: Home path
- **WHEN** the shopper opens `/en-US`
- **THEN** the render call carries path `/`

#### Scenario: Query string forwarded
- **WHEN** the shopper opens `/en-US/category/pods?sort=price-asc&facet.roast=dark`
- **THEN** the render call carries `search=sort%3Dprice-asc%26facet.roast%3Ddark`

### Requirement: Authentication and wire version
Render calls SHALL be made server-side with the render key and the storefront's public origin, and SHALL declare wire version `1`. The render key SHALL NOT appear in any client bundle or response.

#### Scenario: Credentials stay on the server
- **WHEN** the production build is produced
- **THEN** the bundle secret check finds neither the render key, the preview token nor the admin secret

### Requirement: Outcome classification
The renderer SHALL classify every render call as exactly one of ok, no page, or failure. Only a 404 with code `page_not_found` SHALL count as no page. A timeout, network error, 401, 403, 426, 5xx, unparsable body or a 404 with any other code SHALL count as failure and SHALL be logged with its reason. The render timeout SHALL default to 2000 ms.

#### Scenario: No page
- **WHEN** the service answers 404 with code `page_not_found`
- **THEN** the route shows the outcome defined by its own spec for no page and nothing is logged as an error

#### Scenario: Wrong URL is a failure
- **WHEN** the service answers 404 with code `not_found`
- **THEN** the storefront treats it as failure and logs a misconfiguration, not as a missing page

#### Scenario: Service slow
- **WHEN** the service does not answer within the timeout
- **THEN** the storefront treats it as failure and the page degrades instead of blocking

### Requirement: Failure degrades, never claims the page is missing
On failure the storefront SHALL keep the shell (header, navigation, footer) and SHALL show a usable degraded page. Routes that have a native implementation SHALL render it on failure.

#### Scenario: Service down on a content path
- **WHEN** the service is unreachable for `/en-US/about`
- **THEN** the shopper sees the degraded or native page inside the shell, with a 200 or 503 status and not a not-found page

### Requirement: Unknown component types fail soft
A component type in a render tree that the storefront does not implement SHALL be skipped and logged. It SHALL NOT break the rest of the page.

#### Scenario: Unmapped type
- **WHEN** a tree contains the type `promo-countdown` that has no component
- **THEN** the other components render and the log names `promo-countdown`

### Requirement: Configuration
The storefront SHALL read `PB_SERVICE_URL` (including the `/service` path), `PB_RENDER_KEY`, `PB_ORIGIN` and `PB_TIMEOUT_MS` from the environment, and SHALL document them in `.env.example` without values. An invalid value SHALL throw in development and, in production, log and use the failure behavior.

#### Scenario: Missing service URL in production
- **WHEN** `PB_SERVICE_URL` is absent in a production build
- **THEN** every page-builder route logs the configuration problem and renders its failure behavior

### Requirement: Markets
Page-builder content SHALL be rendered for both markets, `en-US` and `en-CA`, and SHALL use the URL locale as the single source of market for the call.

#### Scenario: Canada has no pickup content
- **WHEN** a page contains a component bound to pickup-location data and the market is `en-CA`
- **THEN** the component renders its empty state or nothing, without error

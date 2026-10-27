## ADDED Requirements

### Requirement: Catch-all renders authored pages
`app/[locale]/[...rest]` SHALL ask the service for the remaining path and render the page when one is published. It SHALL show the localized not-found only for the service's no-page answer.

#### Scenario: Landing page
- **WHEN** an author publishes a page at `/spring-collection` and the shopper opens `/en-US/spring-collection`
- **THEN** the page renders inside the shell

#### Scenario: Unknown path
- **WHEN** no page exists for `/en-US/nothing-here`
- **THEN** the localized not-found page is shown

### Requirement: Native content routes take precedence
Routes that exist natively (`about`, `contact`, `faq`, `policies`, `journal`, `account`, `cart`, `checkout`, `p`, `category`, `shop`, `search`) SHALL keep their own route. Authored pages SHALL NOT shadow them, and the authoring guidance SHALL say which paths are reserved.

#### Scenario: Reserved path
- **WHEN** an author publishes a page at `/cart`
- **THEN** `/en-US/cart` still shows the native cart

### Requirement: Failure on content paths
When the render call fails for a catch-all path, the route SHALL show the degraded page, not the not-found page.

#### Scenario: Outage
- **WHEN** the service is down
- **THEN** `/en-US/spring-collection` shows the degraded page inside the shell and the failure is logged

### Requirement: Authorable content components
The catalog SHALL provide content components for editorial pages, at least hero, banner, rich text, image, product strip and a call-to-action, each using the storefront's link component, design tokens and accessibility rules (headings, alt text from image fields).

#### Scenario: Link navigation
- **WHEN** an author sets a link to `/category/pods`
- **THEN** the rendered link keeps the shopper's locale and navigates natively without a full reload

#### Scenario: Image alt text
- **WHEN** an image field has alt text
- **THEN** the rendered image carries it, and an image without alt text is rendered as decorative

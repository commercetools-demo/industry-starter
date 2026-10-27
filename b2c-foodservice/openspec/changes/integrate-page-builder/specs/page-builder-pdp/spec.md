## ADDED Requirements

### Requirement: Placeable product slices
The catalog SHALL expose the parts of the product page as placeable components: at least gallery, title, price, variant selector, add to bag, description, rating and availability. They have no authored fields; an author only places or omits them. Each SHALL be implemented by the existing native PDP component and SHALL render with the storefront's own product data (`loadProductPage`), not with data from the render tree. The catalog entries SHALL NOT ask the service to resolve product data.

#### Scenario: Same data as the native page
- **WHEN** an authored product page places the gallery, price and variant selector
- **THEN** they show the product, variants, price and stock exactly as the native product page does for that SKU and market

#### Scenario: Component omitted
- **WHEN** a product page template does not place the availability slice
- **THEN** the page renders without it and without error

#### Scenario: Add to bag still native
- **WHEN** the shopper uses the add to bag slice
- **THEN** the existing cart flow runs, with the same session, market and cart behaviour as the native PDP

### Requirement: Configurable product content blocks
The catalog SHALL provide configurable blocks that an author can place around the slices, at least a banner, a rich-text block, and a product strip bound to a data source (related or recommended products).

#### Scenario: Banner on a product page
- **WHEN** an author adds a banner above the gallery in the global product template
- **THEN** every product page shows it

#### Scenario: Related products strip
- **WHEN** a product strip is bound to a related-products data source
- **THEN** it renders product cards for the current product in canonical shape

### Requirement: Global product template
A single page for the product route template SHALL apply to every product; there SHALL be no per-product page required. The product comes from the URL, and the preview sample product comes from the preview settings.

#### Scenario: One template, any product
- **WHEN** the shopper opens any `/en-US/p/<slug>/<sku>`
- **THEN** the global template is drawn with that product's data

### Requirement: PDP behaviour preserved
Product page metadata, structured data, reviews, subscription options, substitutions for out-of-stock items, weight-based pricing and the store/availability behaviour SHALL be unchanged for the shopper. Anything the service slices cannot supply SHALL keep the native PDP in place.

#### Scenario: Unknown product
- **WHEN** the sku matches no product
- **THEN** the storefront shows the localized not-found page, as the native product page does, whatever the page builder holds

#### Scenario: Failure
- **WHEN** the render call fails
- **THEN** the native PDP renders

### Requirement: PDP is a later phase
Product detail SHALL be released after home, content pages and listing are verified. The native PDP SHALL remain the live route until the slices are proven against real products in both markets.

#### Scenario: Native until released
- **WHEN** no product template is published
- **THEN** the native PDP renders for every product

## ADDED Requirements

### Requirement: Two kinds of listing component
The category listing catalog SHALL distinguish **placeable** components from **configurable** ones. Placeable components are the parts of the listing the page already renders: filters, sort, pagination, result header, breadcrumbs and subcategories. They have no authored fields; an author only places or omits them. Configurable components have authored fields.

#### Scenario: Placeable component has no settings
- **WHEN** an author selects the filters component in the editor
- **THEN** it offers no content fields, only placement and visibility

#### Scenario: Component omitted
- **WHEN** a published category page contains no pagination component
- **THEN** the storefront renders the listing without pagination controls

### Requirement: Configurable listing components
The catalog SHALL provide at least a banner (image, heading, text, link) and a product grid. The product grid SHALL show the products of the category being viewed and SHALL be configurable for items per row, whether price is shown on each tile, and whether variant swatches are shown.

#### Scenario: Items per row
- **WHEN** an author sets the grid to 3 items per row on desktop
- **THEN** the storefront renders three tiles per row at desktop width and honors the smaller counts on narrower breakpoints

#### Scenario: Price hidden
- **WHEN** an author turns off price on tiles
- **THEN** no tile shows a price

#### Scenario: Swatches
- **WHEN** swatches are on and a product has variants with a colour
- **THEN** the tile shows one swatch per colour, and when swatches are off it shows none

### Requirement: Native data, native components
The listing components SHALL render with the storefront's own listing data and components (`loadListing`, `FilterSidebar`/`FilterSheet`, `SortSelect`, `Pagination`, `ResultHeader`, `Breadcrumbs`, `ProductCard`). The page builder SHALL decide only which components are placed, in what order and with which settings. The catalog entries for these components SHALL NOT ask the service to resolve listing data, and the storefront SHALL NOT read listing data from the render tree.

#### Scenario: Same results as the native listing
- **WHEN** the shopper opens `/en-US/category/pods?f_roast=dark&sort=price-asc&page=2` on an authored page
- **THEN** the products, facets, counts and availability are exactly those the native listing shows for that URL

#### Scenario: One load per request
- **WHEN** an authored category page places filters, grid, sort and pagination
- **THEN** the listing is loaded once for the request and shared by those components

#### Scenario: Component placed on a non-listing page
- **WHEN** a listing component appears in a tree for a path that is not a category
- **THEN** it renders nothing and the rest of the page is unaffected

### Requirement: Listing URLs unchanged
The public listing URLs and query parameters (`f_<facet>`, `sort`, `page`, `avail`) SHALL NOT change, and filtering, sorting and paging SHALL behave as on the native listing. The query string SHALL still be forwarded to the service untouched, because it carries the editor's preview flags.

#### Scenario: Filter through the URL
- **WHEN** the shopper selects a facet value
- **THEN** the URL gains the `f_` parameter and the grid updates from the natively loaded results

#### Scenario: Editor flags reach the service
- **WHEN** the editor frames the listing with `pb_preview` and `pb_page_id`
- **THEN** both reach the service unchanged

### Requirement: Category route outcomes
`/<locale>/category/<slug>` SHALL render the page for that category if one is published, otherwise the global category fallback page, otherwise the native listing. A category slug unknown to commercetools SHALL show the real not-found. `/shop` and `/search` SHALL stay native.

#### Scenario: Specific page beats the fallback
- **WHEN** a page is published for `/category/coffee` and a fallback exists
- **THEN** `/en-US/category/coffee` shows the specific page and `/en-US/category/pods` shows the fallback

#### Scenario: Nothing published
- **WHEN** neither a specific page nor a fallback exists
- **THEN** the native listing renders

#### Scenario: Unknown category
- **WHEN** the shopper opens a category that does not exist
- **THEN** the localized not-found page is shown, whether or not a fallback page exists

#### Scenario: Service failure
- **WHEN** the render call fails
- **THEN** the native listing renders and the failure is logged

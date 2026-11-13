## ADDED Requirements

### Requirement: Coffee selection seed
The seed SHALL create `mcf-selection-malva-coffee` and add all existing coffee products to it, idempotently.

#### Scenario: Re-run
- **WHEN** the seed runs twice
- **THEN** the selection holds each coffee product exactly once and no error occurs

### Requirement: Drinks catalogue seed
The seed SHALL create the drinks product type, categories, products (French Kiss, Unflavored water, Flavored forever, Chic lines) with US and CA prices, the drinks product selection, the drinks inventory channel and stock entries on that channel. Keys SHALL use the `mcf-` prefix.

#### Scenario: Drinks present
- **WHEN** the seed completes
- **THEN** every drinks product is published, in the drinks selection and has stock in the drinks channel

### Requirement: Brand custom field without new types
The seed SHALL add a `brand` enum field to the existing type `mcf-line-fulfilment` and SHALL NOT create any new custom type.

#### Scenario: Type update
- **WHEN** the seed runs against a project whose line type lacks `brand`
- **THEN** the type gains the field and the set of type keys is unchanged

### Requirement: Reduced drinks source data
A script SHALL reduce the scraped Maison Perrier JSON to one line per distinct (name, size) pair. Each line SHALL hold `sku`, `category`, `name`, `size`, `description` and `images`, where `images` lists every distinct non-empty `Image_URL` of that pair in first-appearance order. `name` and `size` SHALL be plain fields with no combined key field. Each `sku` SHALL be an arbitrary number-only string, unique and stable across runs. Rows with an empty name or category SHALL be dropped.

#### Scenario: Reduction
- **WHEN** the script runs on the 841-row source
- **THEN** it writes 28 lines (16 distinct names), drops the 6 junk rows, and no line repeats an image URL

#### Scenario: Stable skus
- **WHEN** the script runs twice on the same input
- **THEN** both outputs are identical

#### Scenario: Missing image
- **WHEN** a pair has only empty `Image_URL` values
- **THEN** its line has an empty `images` array

### Requirement: Images from scraped URLs
The seed SHALL use the image URLs in the reduced data as they are and SHALL NOT call an image source or record images for drinks.

#### Scenario: Seeding images
- **WHEN** the drinks catalogue is seeded
- **THEN** each variant's images equal its line's `images` list and no network call to an image source is made

### Requirement: Reset and verify cover brands
`reset`, `cleanup` and `verify` SHALL know the new selections, channel and products.

#### Scenario: Verify
- **WHEN** `seed:verify` runs after seeding
- **THEN** it reports both selections, the channel and the `brand` field as present

## ADDED Requirements

### Requirement: Search entry

The header SHALL show a 190px pill "Search the shop" that opens `/[locale]/search`; the search page SHALL show H1 "Find it", a 58px input and, with no query, suggested terms as outline tags (Fresh, Vegan, Bakery, Under $5 in en-US / unter 5 € in de-DE, Organic, Gifts) read from messages.

#### Scenario: Empty search
- **WHEN** the search page opens with no query
- **THEN** the suggested tags are shown

### Requirement: Results

A query SHALL show "N found for “query”" and a three-column grid of product tiles from the Product Search API for the active locale and currency, paginated at 24 per page via `?q=…&page=N`.

#### Scenario: Matching query
- **WHEN** the shopper searches "milk"
- **THEN** matching products are listed with count and prices in the session currency

#### Scenario: No match
- **WHEN** nothing matches
- **THEN** a message says so and suggests browsing categories

### Requirement: URL state

The query and page SHALL live in the URL, and the input SHALL update the URL with debounce of 300 ms.

#### Scenario: Shared link
- **WHEN** a URL with `q=milk` is opened
- **THEN** results for "milk" are shown immediately

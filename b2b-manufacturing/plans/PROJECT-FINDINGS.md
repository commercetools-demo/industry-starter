# Project findings

Facts discovered about the commercetools project, the platform and the environment. Juniors append when a response differs from a workstream (JUNIOR-GUIDE §8). Never record secrets.

## Verified platform facts (docs, 2026-10-08)
| # | Fact | Impact |
| --- | --- | --- |
| F-1 | A line item needs a Price matching the cart currency; a variant with no selected price cannot be added to a cart | D12: hidden 0 price per service and currency (USD, EUR) |
| F-2 | A Quote Request cannot be created from an anonymous Cart, a Cart with `shippingMode: Multiple`, or a Cart with Discount Codes; the Cart must have a `shippingAddress`; the buyer needs `CreateMyQuoteRequestsFromMyCarts` | D11; `malva-request-a-quote` |
| F-3 | Quote lifecycle: Cart → Quote Request (Submitted) → seller accepts → Staged Quote → Quote (Sent/Pending) → buyer accepts/declines/renegotiates or creates an Order from the Quote | `malva-client-portal` quotes |
| F-4 | My Business Units API: unit is `Inactive` by default; cannot change status, manage stores or assign associates; project setting `changeMyBusinessUnitStatusOnCreation` and `setMyBusinessUnitAssociateRoleOnCreation` exist | D18 |
| F-5 | There are no predefined associate roles; the seller creates them from the `Permission` enum | D19, seed |
| F-6 | Associate Business Unit ops go through `asAssociate().withAssociateIdValue().inBusinessUnitKeyWithBusinessUnitKeyValue()` | `malva-bff-and-session` |
| F-7 | Product Search (`apiRoot.products().search()`) requires `searchIndexing.productsSearch` Activated; `productProjections().search()` is the older API | D17 |

## Environment (2026-10-08)
| # | Fact |
| --- | --- |
| F-10 | The `spec-b2c-health` MCP points at project `spec-test-b2c-healthcare` (GB, DE, US; EUR, GBP, USD; en-GB, de-DE, en-US). It held only untouched furniture sample data (29 categories, 3 product types, 2 shipping methods, 1 tax category, 1 store `b2c-retail-store`, 2 zones, no business units, no associate roles). `productsSearch` Activated, `countryTaxRateFallbackEnabled` true. **It is the healthcare project; Malva does not use it (D10).** |
| F-11 | The `spec-b2b-manufacturing` MCP was not connected in the planning session. |
| F-12 | The Chrome DevTools connector disconnected during planning. |
| F-13 | The commercetools `commerce-mcp` plugin server failed to connect (cached failure). The knowledge MCP works. |
| F-14 | Zone locations are unique per project: the sample zones `europe` (DE) and `north-america` (US) block `mpw-service-area`. The live MCP seed reused them for shipping method `mpw-on-site-service`; the scripts expect sample data to be cleaned first (`cleanup-sample`), then create `mpw-service-area`. | MCP seeding 2026-10-08 |
| F-15 | The custom Type resource id for Quote Requests is `quote` (it covers Quote, QuoteRequest and StagedQuote; fields are copied request → staged quote → quote). `quote-request` is rejected by the API ("Request body does not contain valid JSON"). | API schema `ResourceTypeId`, 2026-10-09 |
| F-16 | The MCP has no delete tools, so the sample data (72 products, 5 stores, 6 business units, …) can only be removed by `cleanup-sample` with an API client (OA-01). | MCP 2026-10-08 |
| F-17 | The MCP-seeded roles `mpw-admin`, `mpw-site-contact`, `mpw-finance` were typed by hand: compare them with `seed/src/data/roles.ts` when the script runs (it creates only what is missing). | MCP seeding 2026-10-08 |

## F-18 Store and Business Unit behaviour (seen live, 2026-10-09)
- Store `mpw-web` has no distribution or supply channels (the seed creates none): `distributionChannelId` and `supplyChannelId` are optional in the session and `getStoreChannelData` leaves them undefined. Its ProductSelection is active and resolves to `productSelectionId`.
- `demo.admin@example.com` is an associate of exactly one unit, `mpw-demo-co` (Company, Active, `storeMode` Explicit, store `mpw-web`). `other.admin@example.com` exists in a second company. The project-level query `associates(customer(id="…"))` returns the unit; only Active units are offered at sign-in.

## F-19 Product Search facts (live, 2026-10-09)
- `storeProjection: 'mpw-web'` in `productProjectionParameters` scopes results to the store's Product Selection; `categoriesSubTree` filters by category; an enum attribute is filtered with field `variants.attributes.<name>.key` and `fieldType: 'enum'` (plain `variants.attributes.<name>` is rejected).
- Sorting by `display-order` fails (`No mapping found`) because the attribute is not marked searchable, so services are sorted in code by `display-order`. Fine for 12 services.

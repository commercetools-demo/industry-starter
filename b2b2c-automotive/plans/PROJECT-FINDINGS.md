<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Project findings

Facts discovered about the commercetools project, the platform and the environment. Juniors append when a response differs from a workstream (JUNIOR-GUIDE section 8) as the next `F-nn`, with date and how it was seen. Never record secrets or personal data.

## Environment (2026-10-12)
| # | Fact |
| --- | --- |
| F-1 | MCP server `b2b2c-automotive` is connected and a read succeeded on 2026-10-12. It points at project `spec-test-b2b2c-automotive` and exposes read, create and update tools but **no delete tool**, so deleting or bulk-changing resources needs a seed script with an API client (OA-01). |
| F-2 | The project already holds sample data: 3 product types, categories and 2 shipping methods. Zone locations are unique per project, so sample zones can block seeded zones; clean up before creating the seeded ones (lesson from the sibling plumbing project, where sample zones `europe` and `north-america` blocked a seeded zone). |
| F-3 | Project countries `GB`, `DE`, `US`, `ES`, `FR`; currencies `EUR`, `GBP`, `USD`; languages must include `de-DE` and `en-US` (check and add in the seed configuration step). |
| F-4 | `searchIndexing.productsSearch` is **Deactivated**. Product Search (`products().search()`) needs it Activated, and indexing takes time after activation: run the config step early (D-022, workstream D) and poll before depending on search (gate G3). |
| F-5 | `changeCountryTaxRateFallbackEnabled` (`countryTaxRateFallbackEnabled`) is already `true`; keep it true so prices without a matching country tax rate still resolve. |
| F-6 | No API credentials are present in the planning environment (OA-01). |
| F-7 | The commercetools `commerce-mcp` plugin server failed to connect in the planning session (cached failure); the knowledge MCP works. The project MCP `b2b2c-automotive` is the one to use. |
| F-8 | Contentools source lives outside this repository; its service routes (`configuration.route.ts`, `puck-page.route.ts`, `puck-content.route.ts`) define the storage contract in `design.md` section 2. |

## Pexels (images)
| # | Fact |
| --- | --- |
| F-10 | The sibling Pexels image script is recoverable from git history: `git show c4c4e40^:b2c-grocery/site/scripts/seed/update-images.ts` (the commit `c4c4e40` removed it from the grocery project). Other sibling projects removed Pexels later. Use it as a reference for the request shape, search query handling and `cleanUrl()`; do not copy dependencies. |
| F-11 | The script reads Pexels' internal Next.js data route `GET https://www.pexels.com/_next/data/<buildId>/en-US/search/<query>.json?query=<query>`. The `buildId` changes whenever Pexels deploys, so it must be discovered at run time (fetch the search HTML and read `buildId`) or supplied (OA-03). |
| F-12 | From the planning environment this GET returns **HTTP 403 with a Cloudflare challenge page**. It is not an auth problem we can fix in code; run from a machine that reaches Pexels or supply the data (OA-03, Q-011). |
| F-13 | Licensing caveat: the Pexels licence allows free use, but the internal `_next/data` route is not a public API, hotlinked URLs can break when Pexels changes, and the owner should decide whether hotlinking is acceptable beyond a demo (Q-011). Store clean URLs only (D-021); apply width or compression parameters at render time. |

## Platform facts to verify early (carried over from the sibling projects, re-check here)
| # | Fact | Where it matters |
| --- | --- | --- |
| F-20 | A line item needs a price matching the cart currency (and country, channel or customer group if the price is scoped); a variant with no selected price cannot enter a cart. | Seed prices (E), cart (N) |
| F-21 | Associate roles are created from the `Permission` enum only; there are no predefined roles. | Seed roles (F) |
| F-22 | Business unit operations as an associate go through `asAssociate().withAssociateIdValue().inBusinessUnitKeyWithBusinessUnitKeyValue()`. | BFF (G), portal (R to W) |
| F-23 | Product Selections scope a store's assortment; `storeProjection` in Product Search scopes results to the store's selection. | Listing (L), assortment (T) |

Record anything these turn out to differ on as a new finding below.

## New findings
*(none yet)*

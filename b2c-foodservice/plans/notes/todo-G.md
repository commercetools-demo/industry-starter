<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items draft, workstream G

Row format from JUNIOR-GUIDE section 5. The lead numbers the OA and SO placeholders and consolidates into `plans/TODO-MANUAL-TESTING.md`. Only the owner sets DONE, PASS, FAIL or WAIVED.

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x2 | Owner | Before images appear on cards (G works without) | 1. Provide IMAGE_SOURCE_URL as in OA-03. 2. Run cd seed && npm run seed:images. | Cards show photos; until then the labelled placeholder | TODO |
| SO-x1 | Owner | Before release | 1. Read plp.* and card.* strings in messages/en-US.json. 2. Decide what 'Featured' sort means (Q-G-04). 3. Approve the no-results fallback and the copy. | Copy approved or edited | TODO |
| M-G-01 | Owner | After G is Ready for review | 1. Open /en-US/category/<pods> on desktop and a real phone. 2. Compare with design/export/.../screenshots/plp-filters.png and 01-plp-applied.png. | Visual fidelity acceptable | TODO |
| M-G-02 | Owner | After G | 1. On a real phone apply filters via the sheet, rotate the phone, press Back. | Filters and scroll restored, sheet usable | TODO |
| OA-G-a | Owner | When the seed has been run live (needs OA-01 and the seed run) | 1. In `storefront/`, run `npm run test:live` if a G live probe exists, otherwise open `/en-US/shop`, `/en-US/category/pods` and `/en-US/search?q=<a seeded SKU>`. 2. With the commercetools MCP `read_product_search` check: `exact variants.attributes.badge.key = bestseller` (count must equal the Bestsellers facet), a `limit: 0` request (must not be rejected), `exact currencyCode USD and country US` plus `range centAmount` in one `and` (counts must match the Price facet), and a `set_enum` facet on `variants.attributes.brewMethods.key`. 3. Record the results in `plans/evidence/G/mcp-checks.md`. | The five gates of G-00 pass; any failure goes to `plans/PROJECT-FINDINGS.md` with the stated fallback | TODO |
| M-G-03 | Owner | After the seed and images exist | 1. Open `/en-US/shop` and compare the count with `seed` verify output (41 products). 2. Pick two seeded SKUs, one in stock and one at 0 in the chosen store, and compare the card line with the inventory in the Merchant Center. 3. Sort by price, low to high, in `/en-US` and `/en-CA` and compare the first five cards with the Merchant Center prices. | Counts, availability lines and price order equal the project data | TODO |
| M-G-04 | Owner | After G is Ready for review | 1. On `/en-US/category/pods` tab through the page with the keyboard. 2. Check that sidebar, toolbar and each card get one tab stop, Quick add and the heart appear on focus, Enter on a facet option applies it. | Order and visibility as described | TODO |

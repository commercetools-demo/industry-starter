<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# MCP checks for workstream M

Not run. The brief for this pass forbade live commercetools calls; the checks of plan section 7.1 are owed as row **M-M-2** in `plans/TODO-MANUAL-TESTING.md` (Claude, after OA-01 and the seed). From reading the seed instead of the project:

- `seed/src/data/extras.ts` defines `mau-rp-monthly` (1 month), `mau-rp-quarterly` (3 months), `mau-rp-half-yearly` (6 months); names "Monthly", "Every 3 months", "Every 6 months".
- `seed/src/data/product-types.ts` `mau-pt-part` has `part-number`, `brand`, `quality-tier`, `position`, `warranty-months`, `oem-numbers`, `fitment-keys`, `universal-fit`, `recurring-eligible`, `popularity-rank` and `related-skus` (the page reads all of them from the master projection), `size-spec` among them (the "Size" row appears only for products that carry a value).
- `seed/src/data/reviews.ts`: 22 plain reviews (no state, no store) on 9 parts; they show in every store and count in `reviewRatingStatistics`.
- Reviews written through the shop use state `review-published` and type `malva-review` once workstream V creates them; until then a plain review is written (see Q-M06).

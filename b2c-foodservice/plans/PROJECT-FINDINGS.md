<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Project findings

Verified platform and environment facts. Add a dated row whenever a commercetools response or tool differs from a plan.

| Date | Finding | Source | Effect |
| --- | --- | --- | --- |
| 2026-10-19 | The Claude Design MCP (`DesignSync`) returns HTTP 403 for this organization (zero data retention policy). The design came from an exported handoff zip. | Tool response | Design is read from `design/export/`; do not re-read the Claude Design project |
| 2026-10-19 | The commercetools commerce MCP did not connect (`CONNECTION_CLOSED`) | Session start | No live project reads yet; see OA-06 |
| 2026-10-19 | `sample-data/image.json` is truncated (cut inside an object) and is not valid JSON | Parse error at line 223 | Seed image code is tested against a complete fixture of the same shape |
| 2026-10-19 | Latest npm: next 16.4.2, next-intl 4.14.9, tailwindcss 4.3.3, `@commercetools/platform-sdk` 9.7.0, `ts-client` 5.1.1. The skill's gates are SDK ^8 and ts-client ^4 | `npm view` | D-006 keeps ^8 and ^4 |
| 2026-10-19 | Product reviews: `reviewRatingStatistics` (`averageRating`, `count`, `ratingsDistribution`) on the product; query reviews with `where=target(typeId="product" and id="...") and includedInStatistics=true` | docs.commercetools.com/guides/review-ratings | `reviews-and-ratings` |
| 2026-10-19 | Skill rule: Product Search API only; `recurrencePrices[]` is an embedded variant field; recurring order state value is `canceled` (one l) | Skill references | D-017, D-023 |

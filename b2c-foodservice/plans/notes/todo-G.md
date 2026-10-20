<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items draft, workstream G

Row format from JUNIOR-GUIDE section 5. The lead numbers the OA and SO placeholders and consolidates into `plans/TODO-MANUAL-TESTING.md`. Only the owner sets DONE, PASS, FAIL or WAIVED.

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x2 | Owner | Before images appear on cards (G works without) | 1. Provide IMAGE_SOURCE_URL as in OA-03. 2. Run cd seed && npm run seed:images. | Cards show photos; until then the labelled placeholder | TODO |
| SO-x1 | Owner | Before release | 1. Read plp.* and card.* strings in messages/en-US.json. 2. Decide what 'Featured' sort means (Q-G-04). 3. Approve the no-results fallback and the German copy. | Copy approved or edited | TODO |
| M-G-01 | Owner | After G is Ready for review | 1. Open /en-US/category/<pods> on desktop and a real phone. 2. Compare with design/export/.../screenshots/plp-filters.png and 01-plp-applied.png. | Visual fidelity acceptable | TODO |
| M-G-02 | Owner | After G | 1. On a real phone apply filters via the sheet, rotate the phone, press Back. | Filters and scroll restored, sheet usable | TODO |

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items draft, workstream F

Row format from JUNIOR-GUIDE section 5. The lead numbers the OA and SO placeholders and consolidates into `plans/TODO-MANUAL-TESTING.md`. Only the owner sets DONE, PASS, FAIL or WAIVED.

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x1 | Owner | Before the live browser recipe of F (the build and tests need nothing) | 1. Confirm storefront/.env.local holds the Frontend API client (names in .env.example). 2. Confirm its scopes cover channels, inventory, shipping methods and project read (lib/scopes.ts). | /api/health is ok and /api/channels returns stores | TODO |
| SO-x1 | Owner | Before release; F ships with default copy | 1. Open messages/en-US.json and en-CA.json keys under shell, store, locale. 2. Mark corrections. 3. Approve footer column link lists and tagline. | Copy reads naturally; link lists approved | TODO |
| M-F-01 | Owner | After F is Ready for review | 1. On a real phone open /en-US and /en-CA (Canada shows no store pill). 2. Open the menu, the store picker (allow location), the locale drawer. 3. Compare with design/export/.../screenshots/mega-open.png and 01-locale-open.png. | Visual fidelity acceptable; distances plausible | TODO |
| M-F-02 | Owner | After F | 1. On a real phone deny location in the store picker. 2. Search a town. | Hint shown, list still usable | TODO |
| M-F-03 | Owner | After OA-x1 | 1. With live credentials run `npm run dev`. 2. Open /en-US and /en-CA, open the store picker, switch country. 3. Compare the six stores, hours and the free-shipping figure (75 USD, 99 CAD) with the Merchant Center. | Live data matches the mock-driven evidence in plans/evidence/F/ | TODO |

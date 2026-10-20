<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items draft, workstream F

Row format from JUNIOR-GUIDE section 5. The lead numbers the OA and SO placeholders and consolidates into `plans/TODO-MANUAL-TESTING.md`. Only the owner sets DONE, PASS, FAIL or WAIVED.

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x1 | Owner | Before the live browser recipe of F (the build and tests need nothing) | 1. Confirm storefront/.env.local holds the Frontend API client (names in .env.example). 2. Confirm its scopes cover channels, inventory, shipping methods and project read (lib/scopes.ts). | /api/health is ok and /api/channels returns stores | TODO |
| SO-x1 | Owner | Before release; F ships with default copy | 1. Open messages/de-DE.json keys under shell, store, locale. 2. Mark corrections. 3. Approve footer column link lists and tagline. | German reads naturally; link lists approved | TODO |
| M-F-01 | Owner | After F is Ready for review | 1. On a real phone open /de-DE. 2. Open the menu, the store picker (allow location), the locale drawer. 3. Compare with design/export/.../screenshots/mega-open.png and 01-locale-open.png. | Visual fidelity acceptable; distances plausible | TODO |
| M-F-02 | Owner | After F | 1. On a real phone deny location in the store picker. 2. Search a town. | Hint shown, list still usable | TODO |

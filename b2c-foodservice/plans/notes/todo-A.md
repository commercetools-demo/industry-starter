<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream A (draft for `plans/TODO-MANUAL-TESTING.md`)

New rows only (OA-A-b records the live project settings owner action); existing OA-01 (API clients) and OA-06 (MCP) are referenced by workstream A, not redefined.

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| M-A-01 | Owner | Optional, after workstream A is `Ready for review`. Blocks nothing | 1. On your own machine run `node -v` (must be 22.x). 2. `git clone` the repository, `cd storefront`. 3. `cp .env.example .env.local` and fill the values (OA-01). 4. `npm ci && npm run check && npm run build`. 5. `npm run dev`, open `http://localhost:3000/` in a browser and `http://localhost:3000/api/health`. | Check and build pass; `/` redirects to `/en-US`; `/api/health` returns `{"ok":true,"projectKey":"<your key>"}` with no secret | TODO |
| M-A-02 | Owner | Optional | Open `storefront/AGENTS.md` and `CLAUDE.md` and confirm the rules read correctly for your team (BFF boundary, token-only styling, where manual items go). | Approval or a corrections list | TODO |
| OA-A-b | Owner | Before the first live run of B and A-12 | The commerce MCP server `food-service` is connected and can read project `spec-test-b2c-food`, but writes through it (`mcp__food-service__update_project`) were blocked by the permission classifier. The live project settings are still to be applied: (a) enable Product Search indexing; (b) `changeCountryTaxRateFallbackEnabled` (already true on the project, nothing to do); (c) add country CA, currency CAD and language en-CA. Do ONE of: 1. add a permission rule allowing `mcp__food-service__update_project` and tell the lead, or 2. run `cd seed && npm run seed:settings -- --dry-run` and then `npm run seed:settings` (needs `seed/.env.local`, OA-01). | `mcp__food-service__read_project` shows search indexing activated, countries include US and CA, currencies USD and CAD, languages en-US and en-CA, and the tax fallback true | TODO |

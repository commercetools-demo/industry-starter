<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Status

Updated 2026-10-21 (owner answers D-030 to D-039 applied to every plan). States: `Not started`, `In progress`, `Ready for review`, `Done`, `Blocked: <row>`.

| ID | Workstream | Wave | State | Notes |
| --- | --- | --- | --- | --- |
| A | Bootstrap | 1 | Ready for review | A-01 to A-13 done offline; live health check blocked on OA-01 (OA-A-c); see plans/evidence/A/README.md |
| B | Seed foundation | 1 | Ready for review (offline) | Seed package built offline; being updated for US and Canada, six NYC stores, no review states (D-030 to D-037); never run live (needs OA-01) |
| C | Seed catalogue | 2 | Ready for review (offline) | Same package as B; live run and images pending (OA-01, OA-03) |
| D | Server core | 2 | Not started | |
| E | Design system | 2 | Ready for review | E-01 to E-12 done; browser recipe run (plans/evidence/E/); owner rows SO-x, M-E-01 to M-E-03 |
| F | Shell and pickers | 3 | Not started | |
| G | Browse | 4 | Not started | |
| H | Product detail | 5 | Not started | |
| I | Cart | 6 | Not started | |
| J | Auth and session | 7 | Not started | |
| K | Checkout and confirmation | 8 | Not started | |
| L | Account area | 9 | Not started | |
| M | Reviews and ratings | 9 | Not started | |
| N | Subscriptions | 10 | Not started | |
| O | Home page | 10 | Not started | |
| P | Content and error pages | 10 | Not started | |
| Q | Quality and release | 11 | Not started | |

## Environment

| Item | State |
| --- | --- |
| commercetools project and API clients | Project `spec-test-b2c-food`; the owner provides API clients in `seed/.env.local` and `storefront/.env.local` (OA-01) |
| commercetools commerce MCP | Server `food-service` is connected and can read the project; writes via the MCP were blocked by the permission classifier (OA-08) |
| Chrome DevTools MCP | Available |
| Image endpoint | Not provided (OA-03) |
| Full hosted Checkout application and Stripe connector | Not set up (OA-04) |
| Hosting | Netlify (D-038, OA-05); not set up |
| Live project settings | `changeCountryTaxRateFallbackEnabled` is already true. **Not yet applied:** Product Search indexing, and CA / CAD / en-CA. **Owner action (OA-08):** either add a permission rule for `mcp__food-service__update_project` so the team can apply them through the MCP, or run `cd seed && npm run seed:settings` |

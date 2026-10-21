<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Status

Updated 2026-10-21 (owner answers D-030 to D-039 applied to every plan). States: `Not started`, `In progress`, `Ready for review`, `Done`, `Blocked: <row>`.

| ID | Workstream | Wave | State | Notes |
| --- | --- | --- | --- | --- |
| A | Bootstrap | 1 | Ready for review | A-01 to A-13 done offline; live health check blocked on OA-01 (OA-A-c); see plans/evidence/A/README.md |
| B | Seed foundation | 1 | Ready for review (offline) | Seed package built offline; being updated for US and Canada, six NYC stores, no review states (D-030 to D-037); never run live (needs OA-01) |
| C | Seed catalogue | 2 | Ready for review (offline) | Same package as B; live run and images pending (OA-01, OA-03) |
| D | Server core | 2 | Ready for review (offline) | D-01 to D-09, D-11 done; D-10 live probe code done, run blocked: OA-01; browser recipe done offline with dummy env, step 8 blocked: OA-01; Q-A-17 `collection` flag done; see plans/evidence/D/README.md |
| E | Design system | 2 | Ready for review | E-01 to E-12 done; browser recipe run (plans/evidence/E/); owner rows SO-x, M-E-01 to M-E-03 |
| F | Shell and pickers | 3 | Ready for review (offline) | F-01 to F-12 done; browser recipe run against a local mock upstream (plans/evidence/F/), live re-run blocked: OA-x1; owner rows OA-x1, SO-x1, M-F-01 to M-F-03; questions Q-F-01 to Q-F-18 |
| G | Browse | 4 | Ready for review (offline) | G-00 to G-13 done against a mock upstream serving the seed data; build passes, three listing routes dynamic; live gates (a), (c), (e) and `limit: 0` pending the seed run: OA-G-a; owner rows OA-x2, SO-x1, M-G-01 to M-G-04; questions Q-G-01 to Q-G-22; see plans/evidence/G/README.md |
| H | Product detail | 5 | Ready for review (offline) | H-00 to H-10 done against the mock upstream; build passes, route dynamic; live checks pending: OA-H-a; browser recipe not driven (browser busy): M-H-03; owner rows OA-x2, SO-x1, SO-x2, M-H-01 to M-H-04; questions Q-H-01 to Q-H-21; see plans/evidence/H/README.md |
| I | Cart | 6 | Not started | |
| J | Auth and session | 7 | Ready for review (offline) | J-01 to J-08 and J-07b done; browser recipe run against the mock (plans/evidence/J/); J-09 probes blocked: OA-J-c; cart merge uses `AuthCart`, follow-up for I (Q-J-15); owner rows OA-J-a to OA-J-c, SO-J-a, M-J-01 to M-J-03 |
| K | Checkout and confirmation | 8 | Not started | |
| L | Account area | 9 | Not started | |
| M | Reviews and ratings | 9 | Not started | |
| N | Subscriptions | 10 | Not started | |
| O | Home page | 10 | Ready for review | O-00 to O-10 done against the mock catalogue; FIX-1 header overflow and FIX-2 URL market rule done; live read-back is OA-O-1; see plans/evidence/O/README.md |
| P | Content and error pages | 10 | Ready for review (partial) | P-00 to P-11, P-13 to P-15 done; P-12 consent-link half blocked on K; scenario "Expired session is not a refusal" blocked on L; evidence plans/evidence/P/; owner rows SO-P1 to SO-P5, OA-P1, M-P-01, M-P-02, M-P-04, OA-P2, OA-P3 |
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

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions to the owner

The owner may overrule any default at any time; **nobody waits for an answer**: build to the default, and rework if the owner decides otherwise. Status: `Open` (default in force), `Answered (date)`. Letters A to K in the first column are the open questions of `openspec/changes/b2b2c-automotive-design/design.md` section 8 (H is resolved).

**Owner interview of 2026-10-12.** The owner answered the questions below; the verbatim answers are in `notes/owner-answers.md` and the resulting decisions are `DECISIONS.md` D-028 to D-049. Every other question keeps the default taken in its plan.

## Seeded from design.md section 8
| ID | Question | Default taken | Blocks | Status |
| --- | --- | --- | --- | --- |
| Q-001 (A) | Where are the store logo and favicon files stored? | **Answer: uploaded through Contentools `upload-file`; the clean URL is stored in store settings** (D-044, same as Q-U01). The portal stores the URL returned by the upload; seeded resellers use clean URLs to files under the app's `/public` | U, I | Answered (2026-10-12, owner interview; default confirmed) |
| Q-002 (B) | Which plate and VIN decoding provider, with which country coverage? | **Answer: mock provider only** (D-043). The finder supports make, model, year and engine from seeded fitment data; plate and VIN inputs sit behind a `VehicleLookupProvider` interface with a mock provider (fixed demo plates and VINs, DE and US formats validated, clear "not found" error). OA-04 is waived | E, J | Answered (2026-10-12, owner interview) |
| Q-003 (C) | Price model: embedded or standalone prices for reseller channel prices (affects price facets)? | **Answer: all prices are standalone prices, Malva's base price too** (D-038). The seed no longer embeds prices in variants; reseller prices are standalone prices on the store's distribution channel (and branch channels, Q-005). Price facets are checked against Product Search on standalone prices when L is built | E, F, L, T | Answered (2026-10-12, owner interview; the earlier default "embedded for Malva" is replaced) |
| Q-004 (D) | Does Malva review reseller themes and pages the way it reviews tailored product text? | **Answer: no review gate for themes and pages** (D-033, publish at once). Tailored text is no longer reviewed either (Q-T06, D-032) | T, U | Answered (2026-10-12, owner interview) |
| Q-005 (E) | One store per reseller, with branches as channels or inventory locations within it? | **Answer: one store per reseller; branches are channels that carry both inventory and prices** (D-039). Also answers Q-I04: a branch can change price as well as stock | F, I | Answered (2026-10-12, owner interview) |
| Q-006 (F) | Which Malva-side (Supplier) screens are in scope for this phase? | **Answer: none.** No Malva-side screens (D-043). Master catalog, campaigns and reseller onboarding approval happen in the Merchant Center and by seed data. SO-01 lists the other missing screens | R to W | Answered (2026-10-12, owner interview) |
| Q-007 (G) | Earnings were read as "no commission, margin only". Confirm. | **Confirmed by the owner's note (resellers earn margin)**; the Earnings page stays dropped (D-009). Kept open only for the written record | W | Answered (2026-10-12, owner note) |
| Q-008 (I) | Do the Contentools managers accept a placeholder `jwtToken` while the portal proxy attaches the real JWT server-side? | Build the proxy with a placeholder token. If a manager refuses it, fall back to the skill's design (JWT passed to the browser) **plus** the store-key rewrite, and record the finding in `PROJECT-FINDINGS.md` | H, U | Open |
| Q-009 (J) | Stay on `platform-sdk` ^8 and `ts-client` ^4 while npm latest is 9.7.0 and 5.1.1? | **Stay** (D-018); upgrade in a follow-up change | A | Open |
| Q-010 (K) | What does `en-US` mean: US, USD, US tax and shipping, or English text with EUR and DE? | **Answer: USD and US for `en-US`; EUR and DE for `de-DE`** (D-042). The seed carries EUR and USD prices, a US tax placeholder (0%) and US shipping on the south reseller (Q-S02, Q-S06); the north reseller sells to DE only. Apps are `storefront/` and `portal/` (decided) | C, D to F, N, O | Answered (2026-10-12, owner interview) |

## Added by the plan
| ID | Question | Default taken | Blocks | Status |
| --- | --- | --- | --- | --- |
| Q-011 | **Pexels access.** From this environment `GET https://www.pexels.com/_next/data/<buildId>/en-US/search/<query>.json` returns HTTP 403 (Cloudflare challenge) and the build id changes on every Pexels deploy. Can the owner run `seed:images` once from a machine that reaches Pexels, or supply the current build id and the response JSON (OA-03)? Also: hotlinking Pexels photos is allowed by their licence only with attribution care, so is hotlinking acceptable for a demo? | Seed with neutral placeholder images (clean URLs to files under `storefront/public/seed/`) so nothing is blocked; `seed:images` (Pexels) is a separate idempotent step that overwrites them when OA-03 is done | E | Open |
| Q-012 | **Payment approach for checkout.** Real PSP connector (Stripe or Adyen test mode through the commercetools Checkout or a Connect connector), or no PSP? | **Answer: "Commercetools full checkout and Stripe behind it"** (D-036): hosted commercetools Checkout (full flow) with the Stripe connector, test mode. Refunds (V) go through the payment and the connector; subscriptions use recurring orders through the same Checkout. **OA-05 is a real owner action** (Stripe test account, connector, Checkout application). The pay-at-pickup and invoice default is dropped | O, P, Q, V | Answered (2026-10-12, owner interview) |
| Q-013 | **Portal naming.** The brief says Supplier and Seller portals, the design says "Partner Portal" (design.md conflict 7). | **"Malva Partner Portal"** in the UI; Supplier and Seller are audience names in specs and plans only | R | Open |
| Q-014 | **Reseller business units and customers.** Which demo accounts exist? | Seed 2 resellers (`mau-reseller-north`, `mau-reseller-south`), each with 2 branches, associates **Admin and Buyer** (Approver dropped, D-028), plus 3 synthetic shopper customers; one shared demo password in `seed/.env.local` (never committed). No wholesale store, contract groups or approval rules | F | Open (default narrowed 2026-10-12) |

## Answered in the owner interview, without a row above
These Q-ids live in the per-workstream notes; the owner's answers are recorded in `notes/owner-answers.md` and `DECISIONS.md`.

| Q | Answer | Decision |
| --- | --- | --- |
| Q-P01 | No email is sent at all (no mail connector, no outbox, OA-06 deleted); the portal keeps Marketing and Email screens that never send | D-034, D-035 |
| Q-T03 | No MAP floor | D-030 |
| Q-O03 | No territory blocking at checkout (design.md decision 10 void) | D-031 |
| Q-T06 | Tailored text needs no approval; tailoring also supports images | D-032 |
| Q-V01 | Wholesale buying from Malva is out of scope; four specs dropped; roles Admin and Buyer | D-028 |
| Q-Q06 | Subscriptions are sold fully | D-037 |
| Q-I02 | OpenStreetMap with Leaflet (storefront picker and portal branch screens) | D-040 |
| Q-J03 | Fitment as year ranges | D-041 |
| Q-J04, Q-M02, Q-L02 | Garage as customer field (max 5) or cookie; non-fitting part can be added with a warning; exact part number search bypasses fit-only | D-047 |
| Q-U01, Q-Q01, Q-W01 | Logo through Contentools upload; 30-day returns; shop-as Admin only | D-044, D-045, D-046 |
| Q-H02, Q-L01 | Puck SSR may fall back to client-only; Popular seeded rank, Top rated from review statistics | D-048 |
| Q-Z01 | Project stays in labs; gate 0 not applicable | D-049 |

## Per-workstream questions
Writers (workstream juniors) append their questions to `plans/notes/questions-<LETTER>.md` using the format `Q-<LETTER>-<n> | question | default taken | blocks | status`. The lead consolidates them into this file and gives them a `Q-nnn` id; until then they are valid and juniors build to the stated default.

### Consolidated index (2026-10-12, after the owner interview)
Every per-workstream question has a default already used in its plan, so nothing blocks the build. Answer by editing the Status cell in the note file. Counts include rows marked Answered or Obsolete (kept as history).

| File | Workstreams | Count |
| --- | --- | --- |
| `notes/questions-seed.md` | D, E, F | 13 (Q-S01 to Q-S13) |
| `notes/questions-ABCGH.md` | A, B, C, G, H | 9 (2 answered: Q-C01, Q-H02) |
| `notes/questions-IJKLM.md` | I to M | 16 |
| `notes/questions-NOPQ.md` | N to Q | 20 |
| `notes/questions-RSTU.md` | R to U | 33 (9 answered or changed, 5 obsolete, 1 new: Q-U11) |
| `notes/questions-VWXYZ.md` | V to Z | 22 (6 answered, Q-X01 obsolete, 9 old Q-V rows deleted, 3 new: Q-W11, Q-W12, Q-X04) |

The seed, IJKLM and NOPQ notes belong to other editors on the same day; their rows answered by the interview (for example Q-I02, Q-I04, Q-J03, Q-J04, Q-M02, Q-L01, Q-L02, Q-O03, Q-P01, Q-Q01, Q-Q06, Q-S11 approval rules, floor and territory seed questions) are marked in those files and listed in `notes/owner-answers.md`.

Cross-workstream gaps found while consolidating (juniors close them, no owner needed):
- Custom types and fields assumed by plans but not yet in the seed: `reseller-company`, `portal-customer`, `portal-order`, `portal-cart`, `store-settings` location fields, `malva-checkout`, `malva-customer`, `malva-return-item`, `malva-store`, `malva-review`, `malva-line`, `malva-order-audit`, `malva-customer-consent`, `branch-info`, order state `ready-for-pickup`. Add them to `seed/src/data/custom-types.ts` in workstream D, E or F before the workstream that needs them. **Removed by the interview:** custom object `malva-rules/map-floor`, cost-centre and wholesale fields, approval rules, `mau-malva-wholesale`.
- Owner-action and manual rows named inside workstream files were merged into `TODO-MANUAL-TESTING.md` on 2026-10-12 with unique ids (mapping table at its end: OA-A1 is OA-07, OA-G1 to G3 are OA-08 to OA-10, OA-R-1 is OA-11, OA-T-1 is OA-12, OA-U-1 and U-2 are OA-13 and OA-14, new OA-15).
- Seed rewrite needed by the interview (workstreams D, E, F; not edited here): all prices standalone including the Malva base price (D-038), recurrence policies on selected parts (D-037), branch channels with inventory and optional prices (D-039), no `map-floor` attribute or object, no store-countries territory rule, no wholesale store, contract groups, approval rules or purchase-order data, associate roles only Admin and Buyer.

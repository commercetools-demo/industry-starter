# TODO for the owner

Everything here is something **only the owner** can do. Claude runs all other verification (browser via the Chrome DevTools connector, project data via the `spec-b2c-health` MCP, unit/lint/build gates). Juniors add rows here (JUNIOR-GUIDE §5); only the owner sets `PASS`/`FAIL`/`DONE`.

## 1. Owner actions (OA)
| ID | Needed by | Action | Status |
| --- | --- | --- | --- |
| OA-01 | E | In Merchant Center for project `spec-test-b2c-healthcare` create an **admin API client for seeding** (scopes: `manage_project` or the per-resource manage scopes for products, categories, product types, types, states, shipping methods, tax categories, zones, customers, orders, carts, inventory, custom objects, reviews, stores, project settings). Put its values in `site/.env.seed.local` (git-ignored) as `SEED_CTP_PROJECT_KEY`, `SEED_CTP_AUTH_URL`, `SEED_CTP_API_URL`, `SEED_CTP_CLIENT_ID`, `SEED_CTP_CLIENT_SECRET`, `SEED_CTP_SCOPES`, `SEED_PATIENT_PASSWORD`. **Do not paste secrets in chat.** | TODO |
| OA-02 | D | Create the **Frontend API client** (B2C template + `manage_sessions`, `manage_orders`; no admin scopes) and put `CTP_*` in `site/.env.local` | TODO |
| OA-03 | D | Generate `SESSION_SECRET` (≥ 32 random chars, e.g. `openssl rand -base64 48`) into `site/.env.local` | TODO |
| OA-04 | Q, T, U | commercetools Checkout application + **Stripe sandbox** connector (Q-007 = A): create the Checkout app in Merchant Center, connect Stripe test keys, enable stored payment methods for T | TODO |
| OA-05 | – | ~~Email provider~~ not needed (Q-008: no email) | N/A |
| OA-06 | Y | Hosting account and site for deployment (depends on Q-009) | TODO |

## 2. Sign-offs (SO)
| ID | Needed by | What to approve | Status |
| --- | --- | --- | --- |
| SO-01 | B | D4: label colour on the azure primary button (white fails AA at ~2.6:1; plan builds navy-900 labels) — Claude supplies a screenshot pair | TODO |
| SO-02 | H | Mobile header menu (not designed) | TODO |
| SO-03 | I, P, V, J | Undesigned screens built from the specs: error pages, address book, registration/verification/reset, FAQ/contact/about/policies/journal, empty and error states | TODO |
| SO-04 | L, X | Consent / retention wording on the booking form and the health-data policy copy (legal) | TODO |

## 3. Manual tests (M)
Only for what a machine cannot do (real card in the PSP sandbox, real inbox, legal wording, visual fidelity judgement). Added by juniors per workstream; none yet.

| ID | Workstream | What to do | Expected | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| *(none yet)* | | | | | |

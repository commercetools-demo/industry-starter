# TODO for the owner

Everything here is something **only the owner** can do. Claude runs all other verification (browser through the Chrome DevTools connector, project data through the `spec-b2b-manufacturing` Merchant Center MCP, unit/lint/build gates). Juniors add rows here (JUNIOR-GUIDE §5); only the owner sets `PASS`/`FAIL`/`DONE`.

## 1. Owner actions (OA)
| ID | Needed by | Action | Status |
| --- | --- | --- | --- |
| OA-01 | E | (MCP now connected, catalog seeded through it on 2026-10-08; still open: the API client for `cleanup-sample`, `quote-request` type, images.) Connect the **`spec-b2b-manufacturing`** MCP server in Claude Code (it was not available in the planning session; `/mcp` to check, restart the session after adding it) and tell Claude the project key. Create an **admin API client for seeding** in that project (scopes per `SEED-PLAN.md`) and put its values in `seed/.env.local` (git-ignored) as `SEED_CTP_PROJECT_KEY`, `SEED_CTP_AUTH_URL`, `SEED_CTP_API_URL`, `SEED_CTP_CLIENT_ID`, `SEED_CTP_CLIENT_SECRET`, `SEED_CTP_SCOPES`, `SEED_DEMO_PASSWORD`. **Do not paste secrets in chat.** | TODO |
| OA-02 | D | Create the **Frontend API client** for the storefront (B2B template scopes; no admin scopes) and put `CTP_*` in `site/.env.local` | TODO (before deploy). Local dev already works with the seed client (`site/.env.local`, D25), which hides missing-scope bugs: create the real client with the scopes in `site/lib/scopes.ts` and test with it |
| OA-03 | D | Generate `SESSION_SECRET` (≥ 32 random chars, e.g. `openssl rand -base64 48`) into `site/.env.local` | Done for local dev (generated, git-ignored). Generate a fresh one for Netlify |
| OA-04 | F, N | Create the **provisioning API client** (server-only; scopes: manage business units, view/manage customers, view stores, view associate roles — the minimum, no `manage_project`) and put `CTP_PROV_*` in `site/.env.local` (Q-019) | TODO (before deploy). Local registration already works with the seed client standing in for it (D25) |
| OA-05 | Y | Netlify account and site for deployment (Q-024) | TODO |
| OA-06 | all browser checks | Reconnect the **Chrome DevTools connector** (it disconnected during planning) so Claude can verify in a real browser | Done (connector works) |

## 2. Sign-offs (SO)
| ID | Needed by | What to approve | Status |
| --- | --- | --- | --- |
| SO-01 | H | Mobile navigation (not designed; built from the nav spec) | TODO |
| SO-02 | M, N, O, Q, V | Undesigned screens built from the specs: privacy notice, registration, sign-in page, portal screens, quote list, empty and error states | TODO |
| SO-03 | L | Optional: read the realistic en-US and de-DE long-form copy of the 12 services (included items, steps, records, FAQ) and edit what you want changed (not flagged as sample, Q-011) | TODO |
| SO-04 | X, Z | Real proof content (stats, accreditations, registration number, phone numbers, email, testimonials) replacing the "Sample content" items | TODO |

## 3. Manual tests (M)
Only for what a machine cannot do (visual fidelity judgement, real phone, legal wording). Added by juniors per workstream.

| ID | Workstream | What to do | Expected | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| M-V-1 | V | 1) Open the deployed or local site at 375 px, 768 px and 1440 px. 2) Compare Home, Plumbing, Waste, About and Request a quote with `design/malva/source/Malva.html` opened in a browser. | Layout, type and colour match the prototype except the documented changes (mobile menu, sample markers, registration step) | G8 or dev server | TODO |
| M-Y-1 | Y | 1) On a real phone open the deployed URL. 2) Add a service to the quote list, register through Request a quote. 3) Sign out and in again. | Works with touch, no horizontal scroll, request visible to the team | OA-05 done | TODO |

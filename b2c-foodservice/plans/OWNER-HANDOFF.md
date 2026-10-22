<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Owner handoff: everything that is left, in order

Written by workstream Q on 2026-10-22. Every storefront workstream is built and checked against a local mock of commercetools (`storefront/scripts/mock-ct-server.mjs`); the checks that need your credentials, your Merchant Center or a real device are listed here in the order that unblocks the most work. Each item names its row in `plans/TODO-MANUAL-TESTING.md` (the full steps and the expected result are in that row; this page does not repeat them). **Never paste a secret into chat, an issue or a file in git:** values go into the git-ignored `.env.local` files and into Netlify's settings.

What the team can say today (details in `plans/evidence/Q/FINAL-REPORT.md`): the unit tests, lint and types pass (storefront and seed), a clean clone builds, all 15 journeys were walked against the mock at 375 and 1440 px except the hosted payment (J15), the security review has no open high finding, accessibility and SEO score 100 on the audited pages, and 42 defects found on the way are fixed. What nobody has seen yet is the real thing: the real project data, the hosted Checkout with Stripe, real recurring orders and a real phone.

## At a glance

| Step | You do | Rows | Unlocks |
| --- | --- | --- | --- |
| 1 | Give the repository its API clients and scopes | OA-01, OA-S-01, OA-02, OA-J-a, OA-L-a, OA-M-a, OA-J-b | every live run |
| 2 | Clean the sample data out of the project, then seed it | OA-08 (done, see below), OA-07, OA-S-02, OA-S-04, OA-S-05 | the real catalogue |
| 3 | Give the image endpoint and run the image step | OA-03, OA-S-03, OA-x2 | real product pictures, the mobile speed figure |
| 4 | Set up the Checkout application with Stripe | OA-04, OA-K-a, OA-K-b, OA-K-d, OA-K-g, OA-L-b | paying, J15, the order journeys |
| 5 | Run the live journeys with Claude | OA-K-f, M-Q-03, M-Q-08, M-Q-09, M-K-01 to M-K-04, M-K-06 | the money path is proven |
| 6 | Check recurring orders live | OA-N1, M-N-04, M-N-01, M-N-03, OA-S-05 | subscriptions are proven |
| 7 | Decide content, legal text and demo accounts | SO-01, SO-Q2, SO-P3 to SO-P5, the other SO rows | the words on the site are yours |
| 8 | Set up Netlify and deploy | OA-05, OA-N-Q1, OA-P1, `plans/DEPLOY-NETLIFY.md` | a URL |
| 9 | After the deploy | M-Q-07, M-Q-10, M-P-01, Q-17 | release |
| 10 | Real devices, a screen reader, acceptances | M-Q-01, M-Q-02, M-Q-04 to M-Q-06 and the phone rows | sign-off |

## 1. Credentials and scopes (no code involved)

Everything uses the project `spec-test-b2c-food` (D-031). The commerce MCP of this session can read it (OA-06, done).

1. **OA-01**: create `seed/.env.local` and `storefront/.env.local` from their `.env.example` files. `SEED_CTP_PROJECT_KEY`, `EXPECTED_PROJECT_KEY` and `CTP_PROJECT_KEY` hold the same key; the guards refuse to run otherwise.
2. **OA-S-01**: the seed's admin client (manage scopes for the catalogue, orders view, customers and so on, listed in `seed/.env.example`) and `SEED_DEMO_PASSWORD` (10 characters or more). This client stays on your machine; it never goes to Netlify.
3. **The storefront client** (Frontend, **no** admin scope): the scopes of `storefront/.env.example`, including `manage_recurring_orders` and `view_recurrence_policies` (**OA-02**, also listed under OA-02 (extend)), `manage_sessions` and `manage_orders` (**OA-K-a**), `manage_customers` (**OA-J-a**, **OA-J-c**) and the account scopes (**OA-L-a**). The deploy gate fails if any admin scope is present.
4. **OA-M-a**: a second client with `manage_products` only for review writes (`CTP_REVIEWS_CLIENT_ID`, `CTP_REVIEWS_CLIENT_SECRET`).
5. **OA-J-b**: `DEMO_LOGIN_ENABLED=true` and `DEMO_LOGIN_PASSWORD` equal to `SEED_DEMO_PASSWORD`, for the demo sign-in locally (**OA-x (C1)** is the row that tells you how to read that password on your own machine).
6. **OA-A-b, OA-A-c, OA-x1**: the checks that `storefront/.env.local` works against the project (`npm run dev`, the health check, the shell). **OA-08 and OA-A-b (settings):** on 2026-10-22 a read-only `read_project` showed Product Search indexing activated, countries US and CA, currencies USD and CAD, languages en-US and en-CA and the tax fallback on, so those settings are in place: mark them DONE (`plans/evidence/Q/data-sweep.md`).

Check: `cd seed && npm run seed:settings -- --dry-run` connects and prints the plan; `cd storefront && npm run dev` opens `/en-US` without an error.

## 2. Clean the sample data, then seed

The project still holds the commercetools sample catalogue (117 products such as `Bruno Chair`, no `mcf-` key; `plans/evidence/Q/data-sweep.md`).

1. **OA-S-02 and OA-07**: `cd seed && npm run seed:inventory` (reads only), open `seed/cleanup-manifest.json`, delete the lines of anything that must stay, then `npm run seed:cleanup -- --manifest cleanup-manifest.json --dry-run`, then the same with `--confirm <projectKey>` within 24 hours. Orders and carts cannot be deleted by the API and stay.
2. **OA-S-04**, in this order: `npm run seed:settings`, `npm run seed -- --dry-run` (read the plan), `npm run seed`, `npm run seed` again (must print `0 change(s)`), `npm run verify` (must print `verify: OK`). If a step fails, write the message into `plans/notes/seed-findings.md` and stop.
3. **OA-S-05**: after the seed, open one pod product in the Merchant Center and check that its recurring prices (embedded recurrence prices) exist; this is question Q-S-2.
4. Then Claude (or you) walks the read-only checks: **M-B-01**, **M-C-01**, **M-S-01** (stores), **OA-H-a**, **OA-G-a**, **OA-I-a**, **OA-O-1** and the data sweep of `plans/evidence/Q/data-sweep.md` (its live column), **M-Q-03** (inventory at order time, the state helper, the second seed). The review statistics may lag a minute after seeding (Q-C-12).

## 3. Images

**OA-03 / OA-S-03 / OA-x2** are the same request: the URL of the JSON endpoint that answers like `sample-data/image.json`, put into `seed/.env.local` as `IMAGE_SOURCE_URL`, then `cd seed && npm run seed:images`. Until then every product shows a placeholder (`placehold.co`, 1200 x 1440 PNG), which is also why the mobile speed figure in `plans/evidence/Q/perf.md` misses the budget; Claude measures again after this step (Q-Q-20). **SO-02** approves the photography source and the wordmark.

## 4. Checkout application and Stripe

1. **OA-04 and OA-K-a**: in the Merchant Center create a Checkout application of type **Complete Checkout**, install the Stripe connector in **test mode**, connect it, set countries US and CA, the standard carrier only, and the allowed origins (localhost now, the Netlify origin later). Note the Stripe test card and a declined test card; they are never written into the repository.
2. **OA-K-b**: the payment return URL `http://localhost:3000/checkout/return` (and the Netlify URL after the deploy) and the same origins.
3. **OA-K-d**: pay button text `Place order`, the discount-code function off (codes live on the cart page), card method on, terms and privacy user agreements (they open the policy pages in a new tab).
4. **OA-K-g**: `CTP_CHECKOUT_APP_KEY` in `storefront/.env.local`; leave `CTP_SESSION_URL` empty (it is for the mock only and the deploy gate fails when it is set).
5. **OA-L-b**: enable Stored Payment Methods in the application if you want the account's saved cards (**M-L-03**).

## 5. Live journeys with Claude (the money path)

Tell Claude when step 4 is done. Claude runs `plans/E2E-JOURNEYS.md` against the project with the Chrome DevTools MCP and the read-backs, and these rows come back to you:

- **OA-K-f** (the probe script for the hosted flow), **M-K-01** (a real phone, a US collect order and a Canada delivery order), **M-K-02** (3-D Secure), **M-K-03** (declined card, retry; also journey J15), **M-K-04** (wallets, if offered), **M-K-05** (change an order's state in the Merchant Center and watch the storefront follow), **M-K-06** (a mixed order: machine to ship, pods to collect, a subscribed coffee), **M-K-07** (the checkout browser recipe).
- **M-Q-08 (new)**: the first run with `CSP_REPORT_ONLY=true` to list the real origins of the hosted Checkout and Stripe; Claude then puts exactly those into `storefront/lib/security-headers.ts` and turns enforcement on. Do this **before** the deploy.
- **M-Q-09 (new)**: the discount code on a mixed bag. In the mock, the review total and the two payments disagree because the code is on the first payment only (question Q-Q-16, K's rule Q-K-02c). The live project says what the code does on the second payment; workstream K then decides. **This is the one open defect-in-waiting that touches money: do not launch before it is answered.**
- Also live: **OA-L-c** and **OA-L-d** (the account browser recipe and `npm run verify:build` on a machine with internet), **OA-I-b** (cart browser recipe), **M-K-06**, **M-L-02**, **M-L-04**.

## 6. Recurring orders live

1. **OA-02 and OA-02 (extend)**: the scopes (step 1).
2. **OA-N1**: decide what a renewal does: no payment collection (demo), Checkout recurring payments (public beta), or leave renewals out. Write it under Q-N-5 in `plans/QUESTIONS.md`.
3. **M-N-04** (the five live steps in `plans/evidence/N/spike.md`: what a recurring order looks like, when the next order date is, what skip, pause and cancel do), **M-N-01** (the daily test policy, check the next day), **M-N-03** (the locked price when the recurring price changes), **M-N-02** and **M-N-06** (look and feel on a phone).

## 7. Words, rules and decisions only you can make

- **SO-01 and SO-01 (extend)**: privacy, terms of sale, cookie statement and returns text for the US and Canada (the policy pages show a draft banner until then).
- **SO-Q2**: the six demo customers share one known password. Keep them on a public demo site (and say so in the README) or rotate the password and hide the demo sign-in. Question Q-Q-8.
- **SO-P3** (customer-care email, phone, hours, reply time), **SO-P4** (cookie banner: none is needed while there is no analytics or third-party script), **SO-P5** (replace the three drafted journal articles), **SO-P1**, **SO-P2** (read the About and FAQ text).
- Copy and look to approve: **SO-x1** (shell, listing, product, cart strings), **SO-x2** (delivery estimate rule, minimum order), **SO-J-a**, **SO-K-a**, **SO-K-b**, **SO-L-a**, **SO-L-b** (the returns window), **SO-M-a**, **SO-N1**, **SO-N2**, **SO-O1**, **SO-O2**, **SO-S-01**, **SO-04**, **SO-x (B1)** (tax table), **SO-x (B2)** (the six store addresses and hours), **SO-x (C1)** (pod wording), **SO-x (E1)** (icons), **M-E-02** (the colour value changes for contrast, decided by E, written down here for your yes).
- **OA-x (D1)**: confirm the decision that reviews are written by a separate client.

## 8. Netlify and the deploy

Follow `plans/DEPLOY-NETLIFY.md`. In short:

1. **OA-05**: create the Netlify site, connect the repository, set the variable names listed there.
2. **OA-N-Q1**: the production storefront client and a new `SESSION_SECRET` (`openssl rand -base64 48`), values only in Netlify and in an untracked `.env.production` for the dry run.
3. **OA-P1**: where contact messages go (a helpdesk, Slack or Teams incoming webhook): `CONTACT_WEBHOOK_URL`, optionally `CONTACT_WEBHOOK_TOKEN`, `FEEDBACK_WEBHOOK_URL`.
4. Tell Claude when the hand tests are finished: **delete the dev routes** (`app/api/health/route.ts`, `app/api/dev`, `app/[locale]/dev`; section 3 of the runbook), run `npm run predeploy` until it prints `predeploy: ok`, then `/commercetools:nextjs-deploy-netlify`. Deploy a preview first (Q-Q-14).

## 9. After the deploy

Give Claude the URL. Claude runs section E of `plans/RELEASE-CHECKLIST.md` and writes `plans/evidence/Q/deployed/` (task Q-17); you do **M-Q-07** (your own device: home, a product, the cart, sign-in; the demo account decision is applied), **M-Q-10** (headers, `/api/health` is 404, a host rate-limit rule) and **M-P-01** (a real enquiry reaches the receiver). **M-J-03**: confirm `DEMO_LOGIN_ENABLED` is what you decided.

## 10. Real devices, a screen reader and sign-offs

- **M-Q-01** (J1 US collect, the Canada delivery journey and J3 on a real phone with the test card), **M-Q-02** (VoiceOver over home, a product page, the cart, checkout and the subscriptions tab, with `plans/evidence/Q/a11y/checklist.md`).
- The phone rows of each workstream: **M-A-01**, **M-A-03**, **M-E-01**, **M-E-03**, **M-F-01** to **M-F-03**, **M-G-01**, **M-G-02**, **M-G-04**, **M-H-01** to **M-H-04**, **M-I-01**, **M-I-02**, **M-J-01**, **M-J-02**, **M-L-01**, **M-M-01**, **M-M-04**, **M-O-01**, **M-O-02**, **M-P-02**, **M-P-04**.
- **M-Q-04**: read the cleanup dry run (`plans/evidence/Q/purge-plan.txt`, produced against the live project once step 2 is done), then have the test records removed. **M-Q-05**: read the open items of `plans/evidence/Q/security.md` and `plans/evidence/Q/perf.md` and accept or reject each. **M-Q-06**: accept the known gaps in `plans/RELEASE-CHECKLIST.md` section F (no monitoring, per-instance rate limits, renewal payment, content in the repository, no cookie banner).
- If the repository will be published: run the `ct-builders-readiness` skill (checklist section F).

## Not an owner job, but waiting on one of the steps above

| Waiting | On | Then |
| --- | --- | --- |
| Live data sweep, second seed run, `seed:cleanup-tests` dry run | step 2 | Claude fills the live column of `data-sweep.md` and writes `purge-plan.txt` |
| J15 declined card, hosted payment journeys on the real widget | step 4 | Claude runs J1 to J4 and J15 and files the evidence |
| Mobile speed figure with real images | step 3 | Claude repeats the Lighthouse run of `perf.md` |
| `RELEASE-CHECKLIST.md` sections B (live), D and E | steps 2 to 8 | Claude ticks them with evidence paths |
| Q is `Done` | task Q-17 after step 9 | the lead updates `plans/STATUS.md` |

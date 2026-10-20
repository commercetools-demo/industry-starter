<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Owner items: workstream Q (quality and release)

Draft for the lead to merge into `TODO-MANUAL-TESTING.md`. `OA-05` already exists; `OA-N-Q1` and `SO-Q2` are placeholders the lead numbers.

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| OA-05 (existing) | Owner | Before Q-17 (post-deploy smoke) | 1. Choose hosting (Vercel or Netlify, Q-015). 2. Create the project and connect the repository. 3. Set the environment variables there (names in `storefront/.env.example`). 4. Deploy with `/commercetools:nextjs-deploy-vercel` or `/commercetools:nextjs-deploy-netlify` after `npm run predeploy` passes. | A deployed URL | TODO |
| OA-N-Q1 | Owner | Before the deploy | 1. Create the production storefront API client with exactly the scopes listed in `storefront/.env.example` (including `manage_recurring_orders` and `view_recurrence_policies`, no admin scope). 2. Generate `SESSION_SECRET` (for example `openssl rand -base64 48`). 3. Put values only in the host's environment settings and in a local untracked `.env.production` for the dry run; never in chat or git. | `npm run predeploy` passes | TODO |
| SO-Q2 | Owner | Before the deploy | Decide what happens to the six demo customers who share one known password: keep (demo site, documented in the README) or rotate the password and hide demo accounts. Write the decision under Q-Q-8. | Decision recorded | TODO |
| M-Q-01 | Owner | After Q-09 | On a real phone run J1 (US) and J3 of `plans/E2E-JOURNEYS.md` against the release build (same Wi-Fi) with the hosted Checkout test card. | Both complete without problems | TODO |
| M-Q-02 | Owner or accessibility reviewer | After Q-08 | VoiceOver pass over home, a product page, the cart, checkout and the subscriptions tab, using `plans/evidence/Q/a11y/checklist.md`. | Everything announced sensibly; findings listed | TODO |
| M-Q-03 | German-speaking reviewer | Before release | Read the German UI through J1-DE and the German content pages. | Natural wording; corrections list or approval | TODO |
| M-Q-04 | Owner | After Q-09 | 1. Read `plans/evidence/Q/purge-plan.txt` (cleanup dry run). 2. Tell the lead to run `cd seed && npm run seed:cleanup-tests -- --register ../plans/evidence/Q/test-data.md --apply --confirm <projectKey>`. | Test records removed; orders stay (cannot be deleted) | TODO |
| M-Q-05 | Owner | After Q-13 and Q-14 | Read the open items in `plans/evidence/Q/security.md` and `perf.md`; accept or reject each in writing. | Accepted, or a fix is requested | TODO |
| M-Q-06 | Owner | Before release | Read the known gaps in `plans/RELEASE-CHECKLIST.md` section F (no monitoring, per-instance rate limits, renewal payment, repository content, no cookie banner) and accept them. | Written acceptance | TODO |
| M-Q-07 | Owner | After Q-17 | On your own device open the deployed home page, one product, the cart and sign-in; confirm the demo account decision is applied. | Site as expected | TODO |

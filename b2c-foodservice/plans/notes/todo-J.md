<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream J

Draft rows for the lead to merge into `plans/TODO-MANUAL-TESTING.md` (the lead numbers OA and SO). Only the owner sets DONE, PASS, FAIL or WAIVED.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-J-a | Owner | Before the J browser recipe | 1. Confirm OA-01 credentials are in `storefront/.env.local`. 2. Confirm the API client scopes include `manage_customers`. | `/api/health` answers and registration works | TODO |
| OA-J-b | Owner | When real email is wanted (not blocking) | 1. Decide Q-J-03. 2. If a provider is chosen, store its key only in the host secret store. | A real mail adapter task can be written | TODO |
| SO-J-a | Owner | Before release | 1. Open `/en-US/sign-in`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` at 375 and 1440 px. 2. Compare with the other pages. 3. Approve or list changes (screens are not in the VELA design). | Owner signs off or lists changes | TODO |
| M-J-01 | Owner | Before release | 1. On a real phone open `/en-US/sign-in`. 2. Sign in as a seeded customer (password from `SEED_DEMO_PASSWORD`). 3. Reload, close and reopen the tab. | Still signed in, no horizontal scroll, keyboard does not hide the button | TODO |
| M-J-02 | Owner | Only if a real email provider is chosen | 1. Register with a real inbox. 2. Click the verification link. 3. Request a reset and click that link. | Both links work once and expire as stated | TODO |

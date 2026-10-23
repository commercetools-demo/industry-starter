<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream J

Draft rows for the lead to merge into `plans/TODO-MANUAL-TESTING.md` (the lead numbers OA and SO). Only the owner sets DONE, PASS, FAIL or WAIVED.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-J-a | Owner | Before the J browser recipe | 1. Confirm the API clients are in `storefront/.env.local` (OA-01). 2. Confirm the API client scopes include `manage_customers`. | `/api/health` answers and registration works | TODO |
| SO-J-a | Owner | Before release | 1. Open `/en-US/account/sign-in` and `/en-US/account/register` at 375 and 1440 px. 2. Compare with the other pages. 3. Approve or list changes (screens are not in the VELA design). | Owner signs off or lists changes | TODO |
| M-J-01 | Owner | Before release | 1. On a real phone open `/en-US/sign-in`. 2. Sign in as a seeded customer (password from `SEED_DEMO_PASSWORD`). 3. Reload, close and reopen the tab. | Still signed in, no horizontal scroll, keyboard does not hide the button | TODO |
| OA-J-b | Owner | Before the demo sign-in works live | 1. In `storefront/.env.local` set `DEMO_LOGIN_ENABLED=true`. 2. Set `DEMO_LOGIN_PASSWORD` to the same value as `SEED_DEMO_PASSWORD` in `seed/.env.local`. 3. Restart `npm run dev`. | The sign-in page shows "Demo customers"; picking each customer signs in | TODO |
| OA-J-c | Owner | Before J-09 probes | Confirm `manage_customers` is in `CTP_SCOPES` (OA-J-a). J-09 (cart-merge probes a, b, c in the workstream file) needs live credentials and is not done offline. | `plans/PROJECT-FINDINGS.md` gets the J-09 answers | TODO |
| M-J-02 | Owner | Before release | 1. Tab through `/en-US/account/sign-in` and `/en-US/account/register` with the keyboard only. 2. Check the focus ring on every control, including the show-password button and the demo select. | Every control reachable, ring visible | TODO |
| M-J-03 | Owner | Before release | Confirm `DEMO_LOGIN_ENABLED` for any public launch (D-040, `RELEASE-CHECKLIST.md`). | Owner decides on or off | TODO |

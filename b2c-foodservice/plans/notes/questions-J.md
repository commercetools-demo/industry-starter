<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream J (auth and session)

Draft for the lead to consolidate into `plans/QUESTIONS.md`. Format: `Q-<L>-<n> | question | default | blocks? | status`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-J-01 | Is SSO or federated sign-in required? | No. No SSO control or route is built. | No | Open |
| Q-J-02 | Are customers global or store-scoped? | Global customers, global `/login`, no `in-store` calls. | No | Open |
| Q-J-03 | Which email provider sends verification and reset mails? | Removed by D-032: no email provider, no mail adapter. | No | Superseded (D-032) |
| Q-J-04 | What may a new customer do? | Everything; registration is verified automatically (D-032). | No | Superseded (D-032) |
| Q-J-05 | Does registration reveal that an email already exists? | No. Generic refusal text pointing to sign-in (no reset exists). | No | Open |
| Q-J-06 | Must a password reset end sessions in other browsers? | Removed by D-032: no password reset. | No | Superseded (D-032) |
| Q-J-07 | Reset and identity specs conflict on unverified accounts. | Removed by D-032: `password-reset` and `email-verification` are not applicable. | No | Superseded (D-032) |
| Q-J-08 | Where are the terms and privacy pages linked from the register form? | `/${locale}/terms` and `/${locale}/privacy`; P may rename. | No | Open |
| Q-J-09 | Token validity for reset and verification? | Removed by D-032: no tokens. | No | Superseded (D-032) |
| Q-J-10 | Password policy? | 10 to 128 characters, one letter, one digit, not the email. | No | Open |
| Q-J-11 | Cart merge mode when the customer already has an active cart? | `MergeWithExistingCustomerCart`. | No | Open |
| Q-J-12 | Rate limiting on more than one server instance? | In-memory per instance now; shared store when hosting needs it (OA-05). | No | Open |
| Q-J-13 | D's error envelope is closed (fixed `ErrorCode`, body exactly code and message). Field-level and domain codes need extra properties. May the envelope carry extras? | Yes: `domainError(code, status, extra)` in `lib/api-domain.ts` keeps `{ error: { code, message, ...extra } }`, never commercetools text. | No | Open |
| Q-J-14 | The register page reads the HTTP-only `mcf_guest_email` cookie but a Server Component cannot delete a cookie. Where is it deleted? | The register route clears it on success (`Max-Age=0`). If the shopper never registers it stays until K's own expiry. | No | Open |
| Q-J-15 | Workstream I has not shipped `CartView`. What does `cart` in the login and register responses hold? | `AuthCart { id, lineCount, quantity }` (in `lib/types.ts`). Follow-up for I: switch to its `CartView` and call `mutate(KEY_CART, cart, false)` in `useAuthActions.adopt`; today it revalidates `KEY_CART_COUNT` only. | No | Open |
| Q-J-16 | The plan says `502 upstream_unavailable`; D's `handle()` maps upstream failures to `503`. | Keep D's `503 upstream_unavailable` (the UI maps the code, not the status). | No | Open |
| Q-J-17 | D-040 says `DEMO_LOGIN_ENABLED` defaults true; the spec says the control is absent unless it is `true`. | Code treats only the literal `true` as on and also needs `DEMO_LOGIN_PASSWORD`; the owner sets `DEMO_LOGIN_ENABLED=true` in `.env.local` for the demo project. | No | Open |
| Q-J-18 | The "bag was added" toast: plan says when the merged bag has more lines than the guest bag. | Shown when the guest had a bag (units from the header count) and the merged bag has more units; no toast for an empty guest bag. | No | Open |

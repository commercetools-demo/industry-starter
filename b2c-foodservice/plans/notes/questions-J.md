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

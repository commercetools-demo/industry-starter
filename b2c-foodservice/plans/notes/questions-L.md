<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream L (account area)

Draft for the lead to consolidate into `plans/QUESTIONS.md`. Format: `Q-<L>-<n> | question | default | blocks? | status`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-L-01 | Which saved payment methods does the hosted Checkout and the chosen connector actually store, and which fields identify them? | Show what the connector writes (label, default flag); no add form; the rest is "not applicable" with an explanation (D-039). Finding from L-10. | No | Open |
| Q-L-02 | Deleting the default address: promote the next (design-account-area) or leave none (address-book template)? | Promote; one constant `DEFAULT_ADDRESS_AFTER_DELETE` switches it, both tested. | No | Open |
| Q-L-03 | Where is the address nickname (Home, Work) stored? | `additionalAddressInfo` of the address. | No | Open |
| Q-L-04 | Can customers change their email? | No; shown read-only with "contact us" (no email verification exists, D-032). | No | Open |
| Q-L-05 | Is there an address validation service? | No; format checks only; the `AddressVerifier` adapter and dialog exist and are tested with a fake. | No | Open |
| Q-L-06 | Loyalty points and member perks? | Not offered; text and tile omitted (`design.md` Q7). | No | Open |
| Q-L-07 | SMS alerts toggle? | Hidden; no SMS provider. | No | Open |
| Q-L-08 | Returns window and eligible items? | 30 days from the order's last modification, all lines eligible (`RETURN_WINDOW_DAYS`); `SO-L-b` decides. | No | Open |
| Q-L-09 | Buy again: new cart (order-history template) or add to the current bag (design)? | Add to the current bag (design); unavailable lines listed. | No | Open |
| Q-L-10 | Account deletion: erase personal data of orders too? | No: `dataErasure: false`; order records retained and the modal says so. | No | Open |
| Q-L-11 | Is the collection store saved per customer or per browser? | Per browser session cookie (30 days). A per-customer default would need a custom field. | No | Open |
| Q-L-12 | Where do notification preferences live? | Removed by D-032: no email, no preferences, no custom type. | No | Superseded (D-032) |
| Q-L-13 | Who owns the heart and saved-list server API: G and H built the heart on `sessionStorage`. | L implements `/api/shopping-lists` and swaps `useSavedItems` (as G's plan states). | No | Open |
| Q-L-14 | Payment method "Remove": delete or deactivate? | Deactivate (`Inactive`), keeps history; the PSP token is not revoked. | No | Open |
| Q-L-15 | Order-completed time for the returns window? | `order.lastModifiedAt` (approximation); a real delivered date needs the store tooling. | No | Open |

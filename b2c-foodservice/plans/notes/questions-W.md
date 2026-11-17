<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream W (customer connector)

Draft for the lead to consolidate into `QUESTIONS.md`.

| ID | Question | Default | Blocks? | Status | Answer |
| --- | --- | --- | --- | --- | --- |
| Q-W-1 | A Set custom field has no fixed order (Custom Fields reference: "The order of items in the array is not fixed"), so `{index}` taken from the stored array is not stable. How should PUT and DELETE find the note? | **A:** the service always shows notes sorted and `index` is the position in that sorted list; PUT and DELETE accept an optional `expected` text and answer 409 when it does not match. **B:** make `notes` a String field holding a JSON array of `{ id, text, createdAt }` (stable ids, duplicates allowed), with routes by id. B is not the Set that was asked for, and a field type cannot be changed later without removing the field. | W-01, W-09 | Open | |
| Q-W-2 | A Set cannot hold the same text twice. What happens when a note is added that already exists? | 409 `duplicate_note`, nothing written. | No | Open | |
| Q-W-3 | `loyaltyPoints` is absent on a customer who never had points. What does GET return? | `0`. | No | Open | |
| Q-W-4 | Limits on notes. | Trimmed text, 1 to 1000 characters; at most 100 notes per customer. | No | Open | |
| Q-W-5 | Which carts does `GET /carts` return? | Every cart of the customer (any state), newest first, with an optional `cartState` filter. | No | Open | |
| Q-W-6 | Does `setCustomType` with the type `key` need the `view_types` scope? | Built with `view_types` included (read-only), so the custom type key can be resolved with `expand=custom.type`. W-13 can try without it. | No | Answered | Default built. |

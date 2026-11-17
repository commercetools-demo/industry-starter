# W-01 probe: Set custom field behaviour (2026-11-17)

Customer: seeded demo customer `mcf-customer-maya` (no custom type before; reverted after, version 1 -> 3, custom removed).

| Step | Action | Result |
| --- | --- | --- |
| 1 | `setCustomType` key `instore-customer-type` with `notes: [zebra, alpha, Mango]` | OK. Read back in the same order as written. The docs say order is not fixed, so the service still sorts (D5). |
| 2 | `setCustomField notes` with a duplicate (`alpha note` twice) | Refused by the API: "Duplicate elements are not supported for custom fields of type Set". The service answers 409 `duplicate_note` before calling the API. |
| 3 | `setCustomType` with no type | Removed the custom type and all its fields; Maya is back to no `custom`. |

Q-W-6 (does `setCustomType` by type key need `view_types`): the MCP client is not scope-limited like the connector's client, so this probe cannot answer it. It is re-checked in W-13 with the OA-W-a client.

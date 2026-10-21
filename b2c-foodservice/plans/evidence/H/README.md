<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence, workstream H (product detail)

All of this ran against the local stand-in `scripts/mock-ct-server.mjs` (seed catalogue, no credentials). The Chrome DevTools
MCP browser was held by another session ("browser is already running"), so the browser recipe could not be driven: screenshots
and the console and network checks are owner rows M-H-03 and M-H-04 in `plans/notes/todo-H.md`. What was checked instead:

| File | Proves |
| --- | --- |
| `mcp-checks.md` | H-00: preconditions checked statically; the live checks are owner row OA-H-a |
| `cart-lines-readback.txt` | Real app (`next dev`) to mock commercetools: `POST /api/cart/lines` for delivery, collect and subscribe, with the cart read back from the mock (supply channel, `fulfilment` field, `recurrenceInfo` Fixed, recurring unit price) |
| `ssr-checks.txt` | Server-rendered page for a pod, a coffee, a machine and a Canadian pod: selectors present per shape, add button state, fulfilment cards (no Collect in `en-CA`, no Subscribe on the machine), "Goes well with" on the machine, canonical link and title from product data, 404 page for an unknown SKU |

Unit and component tests (935 in the storefront, about 140 added by H) cover every scenario in the workstream checklist; see the
test names in `lib/product/product-helpers.test.ts`, `components/pdp/*.test.tsx`, `app/api/cart/lines/route-fulfilment.test.ts`,
`app/api/recurrence-policies/route.test.ts`, `lib/related.test.ts` and `app/[locale]/p/[slug]/[sku]/page.test.tsx`.
`npm run build` passes and lists `/[locale]/p/[slug]/[sku]` as dynamic.

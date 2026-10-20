<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions draft, workstream H

Format `Q-<L>-<n> | question | default | blocks? | Open`. The lead consolidates into `plans/QUESTIONS.md`.

Q-H-1 | Default fulfilment on load? | Collect when a store is chosen and the variant is in stock there, else ship (prototype defaults to pickup) | No | Open
Q-H-2 | Delivery estimate before a cart exists (template open question)? | Market-wide rule (cut-off hour, 2 to 4 business days) in lib/shop-config.ts, same for every address | No | Open
Q-H-3 | Datasheets and safety data sheets (template open question)? | Not applicable to a B2C coffee shop; none shown | No | Open
Q-H-4 | Spec shows Machine system as a pod selector but each seeded pod product has one system | Read-only fact plus a link to the sibling product when one exists; no selector | No | Open
Q-H-5 | Price tiers: template requires the scenario, B2C excludes the tier table, seed has no tiers | Implement tier-aware unit price and total without a table; test with fixtures | No | Open
Q-H-6 | Spec lists bundle 'with milk frother' but the seed bundle enum has machine-only and starter-capsules only | Show the enum values that exist; seed request for the third value | No | Open
Q-H-7 | Subscribe saving percentage: computed or fixed copy? | Computed per variant from recurring vs one-time price, shown only when positive | No | Open
Q-H-8 | Quantity limits on the PDP? | Honour inventory minCartQuantity and maxCartQuantity, otherwise 1 to 99 | No | Open
Q-H-9 | Image order: lifestyle and pack shot | First image is the pack shot; seed assigns images round-robin so order is not curated (OA-03) | No | Open
Q-H-10 | Selection in the query string: replaceState or push a history entry per option? | replaceState (back leaves the page) | No | Open
Q-H-11 | Product with no price in the market: show the PDP with 'Price on request' or 404? | Show it (template scenario); lists hide such products | No | Open
Q-H-12 | Should adding a line open the cart drawer? | No, toast only (spec) | No | Open
Q-H-13 | Is the capsule compatibility rule (Original with Original, Vertuo with Vertuo, others none) final? | Yes as stated; owner confirms in SO-x1 | No | Open

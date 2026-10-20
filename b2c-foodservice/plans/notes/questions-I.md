<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions draft, workstream I

Format `Q-<L>-<n> | question | default | blocks? | Open`. The lead consolidates into `plans/QUESTIONS.md`.

Q-I-1 | Region switch with a populated bag (template open question; also Q-F-03)? | Carry over lines that have a price, convert collect lines of another country to ship, list everything that could not move | No | Open
Q-I-2 | Where is the minimum order value configured and per what (template open question)? | Per-currency constant MIN_ORDER_VALUE in lib/shop-config.ts, 0 meaning off | No | Open
Q-I-3 | Does the free-shipping progress count collection lines? | No, only lines that ship (ship, subscribe) | No | Open
Q-I-4 | Single shipping mode prices the whole bag with one method; mixed-bag free-above is then compared to the full total | Sync mcf-ship-standard if any line ships else mcf-collect; K's spike decides Multiple or one order per group | No (K decides) | Open
Q-I-5 | Default CART_SHIPPING_MODE? | Single (skill); K may change it, rebuildCart migrates existing carts | No (K decides) | Open
Q-I-6 | How to keep 'Price updated' across reloads? | Optional line field priceWas (seed request); without it the mark shows only on the detecting response | No | Open
Q-I-7 | Cart summary needs variant attributes on lines (savedToLineItem false by default) | Always enrich lines from one batched projection read; seed request to save the needed attributes on the line | No | Open
Q-I-8 | Discount code casing? | Send as typed after trim; verify in I-00 and uppercase only if the project's codes require it | No | Open
Q-I-9 | Block checkout when a line is out of stock online or at its collect store? | Yes, with a reason and the remedy; price changes never block | No | Open
Q-I-10 | Subscribe lines: chips and 'next date shown' meaning before a recurring order exists | No chips; show first delivery estimate then the interval; schedule changes on the PDP or in the account (N) | No | Open
Q-I-11 | Gift note in the summary | Static prompt linking to checkout; storage and cost in K | No | Open
Q-I-12 | Quantity ceiling per line? | 99, clamped to online stock for ship and subscribe and to store stock for collect | No | Open
Q-I-13 | Template's 'Save cart action' and cross-sell block | Not built (saved items are L); machine/capsule nudge is the only cross-sell | No | Open
Q-I-14 | Route Handler table lists DELETE /api/cart | Unused (405); discount codes use PATCH /api/cart; lead adjusts the table | No | Open
Q-I-15 | Switching to Collect when no store is chosen | Open the store picker and retry with the chosen store | No | Open

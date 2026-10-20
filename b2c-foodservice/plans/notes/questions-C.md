<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream C (Seed catalogue)

Format: `Q-<L>-<n> | question | default | blocks? | status`.

Q-C-1 | If OA-03 stays blocked, ship without images? | Yes: products and categories without images; the storefront shows neutral placeholders (token `canvas-2`); the seed adds images on a later run | no | Open
Q-C-2 | Where does the demo password come from? | `SEED_DEMO_PASSWORD` in `seed/.env.local`, generated locally; the owner reads it from the file | J | Open
Q-C-3 | Guest-style reviews 7 to 12 per product have no customer and a synthetic author name (`Sam T.`). | Accepted (Q-S-4) | no | Open
Q-C-4 | "Verified purchase" marks need orders linked to reviews; the seed creates none. | No verified marks in the seed; K or Q may create test orders later | M | Open
Q-C-5 | `FREESHIP` applies to any shipping method (predicate `true`). Restrict to standard shipping? | As seeded (collect is free anyway); revisit after K | no | Open
Q-C-6 | EUR and GBP prices: derived (0.92 and 0.79 of USD, rounded to 5 cents) or supplied by the owner? | Derived; the owner may supply a table (replaces `FX`) | no | Open
Q-C-7 | Pack and size variants. | Pods 10, 50, 100 capsules; coffee 250 g and 1 kg crossed with grinds; as seeded | no | Open
Q-C-8 | Which products are out of stock at which store? | `POD-EMBER` and `MAC-POD1` at `mcf-store-munich` | no | Open
Q-C-9 | Low-stock threshold. | 5 in the seed (`LOW_STOCK_THRESHOLD`); the storefront reads the same value from one constant in `lib/utils.ts` defined by H | H | Open
Q-C-10 | Which products are subscribable? | All pods and coffees (Q-006), none of the others | N | Open
Q-C-11 | Add a `verify -- --search` Product Search probe (optional flag)? | Yes; the rating-range probe is reported, not enforced | no | Open
Q-C-12 | Review statistics lag after creating reviews. | `verify` re-run after one minute; a finding after ten minutes | no | Open
Q-C-13 | Review language on the product page: all languages or only the shopper's? | Show all (M decides); the seed provides all three | M | Open
Q-C-14 | Publish at creation. | Yes (`publish: true`); staged equals current | no | Open
Q-C-15 | Disclaimer "not affiliated with Nespresso" in every pod description. | Keep (approval row SO-x C1) | no | Open
Q-C-16 | Recurring price write path (a price carrying `recurrencePolicy`, not typed in SDK 8). | As seeded; a live difference is recorded as a finding | no | Open

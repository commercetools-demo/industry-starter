<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream O (home page)

Draft for the lead to consolidate into `QUESTIONS.md`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-O-1 | Where do hero, editorial and announcement copy live (the template asks which system owns it)? | Typed module `storefront/content/home.ts` plus the message catalogues; replaceable by a CMS later | no | Open |
| Q-O-2 | Category tiles at 1080 px: the token spec sends grids to 3 columns, which leaves a 3 + 1 layout for four tiles | Two columns at 1080 px and below | no | Open |
| Q-O-3 | Are the capsule-recycling and sourcing claims true? Should the editorial strip be about recycling (pods) or sourcing (coffee)? | Placeholder recycling text, marked draft in the content file | release | Open |
| Q-O-4 | Where does "Shop the edit" lead? | The listing filtered to bestsellers | no | Open |
| Q-O-5 | The hero image is hidden under 900 px but a `priority` image still downloads | Accept one download; Q checks the performance budget | no | Open |
| Q-O-6 | Statically cache the home page (ISR) with per-person parts as client islands? | No: dynamic render; shared cache only for the category tree and channel list | no | Open |
| Q-O-7 | Show a saving percent on the subscribe strip? | No number (varies by product, avoids a dependency on N) | no | Open |
| Q-O-8 | Bestsellers: only products badged `bestseller`, or fill to four by rating? | Badge only, no fill | no | Open |
| Q-O-9 | "Buy again" or recently viewed strip for signed-in shoppers (the B2B template has "recently ordered")? | Not built; parked in `IDEAS.md` | no | Open |
| Q-O-10 | Label of the pods tile: the spec says "Nespresso pods" but D-005 forbids the brand as a product name | Use the platform category name; recommend "Compatible pods" with the line "Nespresso-compatible" | no | Open |
| Q-O-11 | Which product is the hero's featured product? | First seeded Original pod that has a price in both markets (US USD, Canada CAD) | no | Open |
| Q-O-12 | Is the "returns" figure in the promise row the same in all markets? | Same source as the promise bar (F configuration) | no | Open |

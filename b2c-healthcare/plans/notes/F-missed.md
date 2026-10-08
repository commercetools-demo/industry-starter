# Workstream F: gaps noticed in the plan

- `malva-counter` (order numbers, key `order`) is listed in the F design but no F task creates or seeds it; only the container name is defined (`CONTAINERS.counter`). Whoever builds order numbering (workstream with checkout) must add it.
- `reset-seed.ts` (E) does not know about reviews, customers or Custom Objects; a reset leaves them behind, and the doctor reviews then reference deleted products. Needs a decision: extend reset (reviews first, then Custom Objects in `malva-*` containers, never customers by default).
- No purge of expired guest bookings or old slot claims exists; `expiresAt` only hides guest bookings on read. A job or a seed utility should delete them (health data minimisation).
- The workstream's browser recipe says `mlv-doc-okafor`; the doctor key is `mlv-doc-amara-okafor`. Also "`read_reviews` shows only verified flags": all seeded reviews are verified, so the flag filter is only unit-tested.
- SEED-PLAN lists `malva-dispense-ledger`; it has no owner in F (E-missed already notes SEED-PLAN differences). The `RX` refill decrement belongs to the workstream that dispenses.
- F's Definition of done wants the "no real-looking personal data" proof as a grep; it is implemented as a unit test (`scripts/seed/clinical-seed.test.ts`), so it runs in `npm run check`.
- `getRatingStatistics` and `listVerifiedReviews` return plain interfaces defined in `lib/ct/reviews.ts`; once workstream G adds app types in `lib/types.ts` the pages may want to import those instead.
- The prototype shows doctor ratings of 4.7 to 5.0 with 96 to 421 reviews; seeded data has 3 to 6 reviews each (plan), so the rating counts on cards will differ from the design.

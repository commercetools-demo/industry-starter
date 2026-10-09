# Workstream X: gaps and things other workstreams must pick up

## Violations found by the static scans in earlier workstreams

None. The three scans (custom-field names, logging calls, query parameters) passed over the whole code base on the first run; each has a sanity test that proves it would catch a violation, and a count check that proves it is not scanning nothing (more than 100 files, more than 15 logging calls). Nothing was changed in earlier workstreams' code.

## Shared test helpers extended (additive)

- `scripts/seed/fake-root.ts`: new collections (payments, shoppingLists, discountCodes, cartDiscounts, businessUnits, quotes, quoteRequests, stagedQuotes, messages, recurringOrders), nested/`in`/`and`/`is defined` predicates through `test/fake-predicate.ts`, `dataErasure` recorded on DELETE, `setRecurringOrderState` and `removeAssociate` actions, project `messages.enabled: false`. Unsupported predicates still match everything, as before.
- `test/fake-custom-objects.ts`: `matchPredicate` now uses the same evaluator (nested `guest(email in (...))`, `is defined`, comparisons); a delete records `dataErasure`.

## Gaps

- **Nothing ran live.** See X-todos.md: predicates are written from the API reference and the GDPR page, not run against the project.
- **RecurringOrder cannot be erased through `dataErasure`.** It is cancelled and reported, not deleted.
- **Hashed login buckets** (`rl-login-<hash of email|client>`) cannot be tied to a person, so an erase run does not remove them; retention removes them within a day (entries with no failure in the 10 minute window).
- **Subject access scale.** `malva-order-attempt` and DiscountCode/CartDiscount reads list the whole container/collection and filter in memory (fine for the demo; with real volumes use a per-patient container or an indexed field).
- **Orders keep medication names by design** (D-025, SO-04): the audit does not flag product names, only sigs, lab names and notes, and booking reasons.
- **Sessions are not revoked on erasure** (stateless cookie, 30 days, J-missed): an erased customer's `malva_session` stays valid until it expires; how the pages behave for a customer id that no longer exists was not tested here.
- **Patient bookings keep their reason text** until cancelled and 90 days past the visit; completed patient bookings are part of the clinical history owned by the clinical system and are not retention-deleted here (owner decision, X-questions 8).
- **The retention function has no seed project-key guard** (it runs on the storefront's own project); its safety is the secret header and idempotent rules.
- **`TODO-MANUAL-TESTING.md` SO-04 row** not edited (not mine); evidence is in `docs/privacy-inventory.md` section 6.

# Workstream F: live steps (need the project and OA-01)

No commercetools credentials were available; everything below is unrun. All commands run from `b2c-healthcare/site` with `.env.seed.local` filled (including `SEED_PATIENT_PASSWORD`).

1. `npm run seed -- --dry-run`, then `npm run seed`. Expect new steps for reviews (`mlv-rev-*`), `malva-*` objects and three customers. Then `npm run seed` again: must print `0 change(s)` (the live proof of the "second run is a no-op" part of F-07).
2. `npm run seed:verify`. Expect all checks to pass, including the clinical block. If only "product rating statistics are non-zero" fails, wait a few seconds (statistics roll up asynchronously) and re-run.
3. Slots: `npx tsx scripts/seed/smoke-slots.ts mlv-doc-amara-okafor office`. Expect a list of free slots and `PASS  the second claim of the same slot failed with 409`. If the first claim itself fails with 400, the claim key format (F-questions #2) or the `version: 0` create-only semantics (#3) differ from the assumption: record in `PROJECT-FINDINGS.md`.
4. Merchant Center (or `read_custom_objects` through the MC MCP): containers `malva-schedule` (8), `malva-rx` (4), `malva-lab` (5), `malva-credential` (1), `malva-booking` (1); `malva-slot-claim` empty after the smoke test.
5. `read_reviews`: 29 reviews (`mlv-rev-*`), each with `custom.fields.verifiedPatient = true`; each doctor product shows `reviewRatingStatistics.count` equal to its review count.
6. `read_customers`: exactly three `example.com` patients (`mlv-patient-*`), email verified, one default address each, `custom.fields.patientRef` set, Sam has `fundingScheme` "Demo Health Plan". Sign-in with the seed password works for all three.
7. QA tool: place an order (or use an existing one) and `npm run seed:advance -- <orderNumber> pharmacist-review --dry-run`, then without `--dry-run`; `read_orders` shows the `mlv-pharmacist-review` state. A skipped step (`... delivered` from `mlv-received`) must be refused.
8. Storefront scopes (D-questions #2): the storefront client needs `manage_custom_objects` (or view/manage on custom objects) and `view_products`/`manage_reviews` read access for `lib/ct/*`; confirm with the owner before widening the API client scopes.
9. Not done here, needs a decision: `reset-seed.ts` deletes only `KINDS`; it does not delete reviews, customers or Custom Objects. After `seed:reset` the reviews block product deletion order (delete reviews first). See F-missed.

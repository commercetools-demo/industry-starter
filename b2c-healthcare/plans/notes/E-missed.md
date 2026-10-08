# Workstream E: gaps noticed in the plan

- The plan says `cleanup-sample.ts` deletes "unused zones except `usa`" but PROJECT-FINDINGS says `europe` is left alone; both are kept (E-questions #2).
- `PROJECT-FINDINGS.md` says E-02 "must turn indexing on"; the later row says it is already Activated. E-02 only verifies.
- E-04 lists custom types but no inventory type for the `expiryDate` custom field required by E-07; added `mlv-inventory-meta`.
- SEED-PLAN's `mlv-rx-line` fields (`dispensedAuthRef`) differ from the workstream E list (`credentialRef`, `eligibleForRestricted`, `coveredAmount`, ...). The workstream list was followed; SEED-PLAN's `mlv-order-meta.pharmacistReviewedAt` was replaced by `allowanceApplied`/`restrictedApplied`. Docs should be reconciled.
- Product Search `query` is required; "poll until the expected count" needs a query (see E-questions #7).
- The shipping-method zone reference is stored as an id only, so diffs compare cents and the default flag, not the zone.
- Existing products are not updated by `seed` (create-if-missing); price/SKU differences are reported, other attribute edits need `seed:reset` then `seed`, or a manual update. Images are intentionally not compared (handled by `seed:images`).
- The workstream's Definition of done wants `PROJECT-FINDINGS.md` updated and the project to contain no furniture: both depend on E-10 (blocked).
- No `.env.seed.local` loader writes anything to `process.env`; `PEXELS_CLIENT_ID` is read from the shell only.

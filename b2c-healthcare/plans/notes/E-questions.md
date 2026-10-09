# Workstream E: questions and the defaults chosen

| # | Question | Default chosen |
| --- | --- | --- |
| 1 | The agent worktree started at an older commit. | Fast-forwarded to `worktree-b2c-healthcare` as instructed. |
| 2 | E-03 says delete "unused zones except `usa`"; PROJECT-FINDINGS says `europe` "is left alone". | Both `usa` and `europe` are kept (`KEPT_ZONES` in `deletion.ts`). Shipping methods are deleted first, so a leftover unused zone would otherwise be deletable. |
| 3 | Do zones/channels/states/types need a non-prefixed cleanup? None exist in the sample data (findings: 0 custom types). | `cleanup-sample.ts` covers only the kinds in E-03. Customers are never deleted (not in E-03, and F owns synthetic patients). |
| 4 | Does the sample zone `usa` have the key `usa`? Findings list it by name only. | Shipping method `mlv-standard` references the zone by key `usa`. If the key differs, `seed` fails on that step: set the key with `update_zones` setKey (owner/Claude) or change `ZONE_USA` in `data/shipping.ts`. |
| 5 | Zone `Location.state`: is it the free-text state code (`NY`) or a name? | Free string, we use two-letter codes `NY`, `TX`, `IL`; the BFF/Q must put the same codes on the shipping address. Doubt recorded. |
| 6 | Channel role for price scoping. | `ProductDistribution` (the catalog-migration skill says a price channel needs it, otherwise the API refuses the price). |
| 7 | Product Search needs `query` (required field). E-02 and verify have no "match all". | `wait-for-search` uses `prefix` on `key` = `mlv-`; verify uses `fullText` on `name`, language `en-US` (must be a project language; it is). If `prefix` on `key` is rejected live, switch to `exists` on `key`. |
| 7b | Which language codes does `fullText` take: `en-US` or `en`? The reference page shows `en`, a learning page shows `en-au`. | `en-US` (project locale). If the live index returns 0 for "Okafor" while the product exists, try `en`. |
| 8 | Type for `allowanceApplied` / `restrictedApplied` (order meta) and `fundingScheme` (patient). The plan lists only names. | `allowanceApplied`, `restrictedApplied` = Money; `fundingScheme` = String; `coveredAmount` = Money; `rxNumber`, `rxLineRef`, `credentialRef`, `patientRef` = String; `prescribedQty` = Number; booleans for `eligibleForRestricted`, `verifiedPatient`. Workstreams that write these (Q, R) must confirm; Types cannot change a field's type later without recreating it. |
| 9 | Where does `expiryDate` live? The plan says "custom field on its inventory entry" but lists no inventory type. | Added custom type `mlv-inventory-meta` (resource `inventory-entry`, field `expiryDate` Date). Fixed date `2026-11-15` on `MED-famotidine-20-mg` (a relative date would break idempotency). |
| 10 | `controlClass` values. | Enum `none` / `schedule-iv`; every medication has the attribute set (`none` for all but two). Two controlled demo products: Alprazolam 0.5 mg and Tramadol 50 mg (synthetic demo, `hsaEligible` false). |
| 11 | `maxQtyPerOrder` for some medications. | Present on 19 of 20; `acetaminophen-500-mg` has none, so it also has no inventory limit (covers the "no ceiling" case). |
| 12 | Medication count "~20". | Exactly 20: the 5 prototype medicines plus 15 common Rx/OTC. |
| 13 | Doctor `modes`. All 8 prototype doctors have both a remote and an office fee. | All 8 have both channels. Code supports one-mode doctors (one price, one mode), tested. |
| 14 | Attribute constraint for the product types. | `None` everywhere. One variant per product, so `SameForAll` would add nothing; `None` is the only relaxable value (irreversible choice avoided). |
| 15 | Rating and review count for doctors. | Not attributes (plan: they come from Reviews, workstream F). The review type `mlv-review-meta` is created here. |
| 16 | `seed:images` banner slots: the plan also mentions "3 doctor-list/page-head backgrounds if used". | Only the six slots named in E-08 (`home-hero`, `home-cta`, `home-rx-delivery`, `journal-1..3`). Add to `data/site-slots.ts` if the design uses more. |
| 17 | Eslint forbids the platform SDK and `new ClientBuilder` outside `lib/ct` for the whole site. | `scripts/seed/lib.ts` has a file-level `eslint-disable` for those two rules with a comment (seed scripts are an admin tool outside the storefront architecture). `eslint/restrictions.mjs` (workstream A) was not edited. |
| 18 | Scopes for the seed client. | Listed in `.env.seed.example` as a best guess; OA-01 owner must confirm. Deleting carts/orders needs `manage_orders`. |
| 19 | Enum attribute values are plain `enum` (not `lenum`). | Labels are English strings; localisation is added when de-DE/en-GB are in scope. |

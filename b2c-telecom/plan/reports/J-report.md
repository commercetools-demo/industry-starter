# Workstream J report (offer rules)

Branch `ws/j-offer-rules`. Live reads ran against `spec-test-b2c-telecom` (storefront client, read-only).

## Done
J-01 … J-10, all ticked. `npm run verify` passes (696 tests). All 15 scenario rows have tests named after the scenario titles (`lib/offers/compat.test.ts`, `addons.test.ts`, `errors.test.ts`, `app/api/offers/compatibility/route.test.ts`). `npm run lint:catalog` live: `Checked 27 offers. 0 error(s), 0 warning(s).` A throwaway live script confirmed C-J-1..5 verdicts on real offers (see deviations for the ones that differ from the plan). Order note: J-04 and J-05 were committed before J-03 because `evaluateAddition` imports them.

## Not done / blocked
Nothing. Browser-based C-J lines (fetch from a page) not run.

## Questions for the owner
- Positive vs allow-list semantics (see Deviations 1): I followed the spec and the seed. Confirm.

## Missed features and deviations
1. **`compatible-addons` / `compatible-equipment` are positive exceptions, not an allow-list** (the plan's Planner default contradicted G's seed: Unlimited Max lists only Netflix, which is internet-only). A listed candidate skips family/technology/speed rules; declared incompatibility and included extras still win. `NOT_IN_COMPATIBLE_SET` was dropped from `ReasonCode`. The scenario "Incompatible add on refused" is tested with `FAMILY_MISMATCH`.
2. **Included equipment satisfies required kinds.** Live cable plans include the DOCSIS modem and wireless plans the 5G gateway (their `required-equipment-kinds` are `modem` / `gateway`), so the plan's "allowed only" equipment lookup would have made every plan `REQUIRED_EQUIPMENT_MISSING`. `defaultEquipment` returns `{ selections, unfulfillable, includedKinds }`, adds no line for included kinds; `missingRequiredEquipment(plan, attached, equipmentOffers = [])` takes the catalog equipment to recognise included kinds; new `includedEquipmentKinds`. Consequence: live plans auto-add no equipment line today; M's required-equipment code path only fires for data with a non-included required kind.
3. `refersTo`: a ref starting `malva-offer-` matches only the offer with that key; other refs match anchors or SKUs (the live `malva-offer-cable-existing-customer` anchors the same product as Cable 500, so derived-key matching would be ambiguous).
4. Family mismatch is the only reason reported for another plan family (technology/speed skipped).
5. `evaluateCandidate`/`conflictBetween` live in new `lib/offers/rules.ts` (avoids an import cycle with `equipment.ts`); `compat.ts` re-exports them. Lines of the candidate's own offer key are ignored in the plan-conflict check (same offer again is a quantity change, M decides).
6. Route errors use E's `ApiError` codes (`VALIDATION` 400, `NOT_FOUND` 404, `UPSTREAM_ERROR` 502), not `INVALID_REQUEST`/`OFFER_NOT_FOUND`/`UPSTREAM_UNAVAILABLE`; 405 is Next's automatic answer (only `POST` exported, tested). Rule errors keep the literal `OFFER_RULE_VIOLATION` 409 body (`ruleErrorBody`), which is not an `ApiErrorCode`.
7. Message namespace `offers` added; `messages/parity.test.ts` (D) top-level list gained `offers`.
8. `scripts/lint-catalog.ts` bypasses `next/cache` (`unstable_cache` throws outside Next: "incrementalCache missing") by intercepting the module load, then imports H's `getAllOffers`.
9. M's ARCHITECTURE seam names (`checkCompatibility`, `requiredEquipment`, `revalidateCompatibility`, `parentCandidates`) do not exist; M should use `evaluateAddition`, `defaultEquipment`, `revalidateCartCompat`, `evaluateAddition().candidateParents`.

## TODOs for other workstreams
- M: call `evaluateAddition` before every write (409 with `ruleErrorBody`), write `attachmentFields` in the same update, `removalPlan` + `confirmCascade`, `revalidateCartCompat` on every cart read; the offers map comes from `getAllOffers`.
- K: add `mergeVerdicts` calls in the route handler; add K reason keys to both message files; filter the two extra live offers by eligibility.
- N: use `buildCandidateList(plan, candidates, attachedKeys)`; included offers show "Included".
- Orchestrator: `node plan/verify-plan.mjs --sync` (STATUS).

## Findings
Appended to `plan/PROJECT-FINDINGS.md` under `## J — catalog lint`. Live verdicts: AC1200 on Cable Gig SPEED_TOO_LOW (300/1000); AX3000 and Mesh allowed on Cable Gig; DOCSIS modem on Air 5G and 5G gateway on Cable 500 TECHNOLOGY_MISMATCH; gateway on Air 5G Plus included; AX3000 on Air Lite DECLARED_INCOMPATIBLE; Device Care on Cable Gig and Apple TV+ / AX3000 on Unlimited FAMILY_MISMATCH; Apple TV+ on Cable Gig included; Spotify included on Unlimited; Netflix allowed on Unlimited Max only.

## Manual tests added
None.

## Junior design choices
None (no UI).

## Chrome checks ready
C-J-1 … C-J-9 (updated in the workstream file to the live data). C-J-10 needs M and N.

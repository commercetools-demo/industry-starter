# Workstream M report: My bundle, Broadband Facts label, discount prompt

Branch `my-bundle-cart-label-prompt` (worktree `.claude/worktrees/agent-a3b7ea128350107c1`). Not pushed, not merged into main.

## Done

- M-01 to M-18 and M-19 (see the workstream file for the ticks): types, config, cart/guard/minimum/quantity/precheck, label builder and `orderStamp`, cart mapper, `lib/ct/cart.ts` (ownership, retry, normalize, probe cart), `lib/ct/bundle.ts`, `lib/ct/prompts.ts`, the six `/api/cart/*` routes, `useCart` hooks, `CartProvider`, connected `BundlePill`, the bundle page and its components, the Broadband Facts label (plus `AccountPlanLabels` for U/V), discount prompt card, en-US and de-DE messages (parity test extended).
- M-15 live: `npm run seed:discounts -- --confirm-project spec-test-b2c-telecom` created `malva-cd-code-cable5` and code `MALVA-CABLE5`; `malva-cd-second-line-10` and `malva-cd-bundle-5` already existed. Verified through the MCP.
- Live smoke on a local dev server (project `spec-test-b2c-telecom`): anonymous add of Cable 500 24M creates a cart with the fee line; `GET /api/cart/prompts` returned the bundle-cable-phone prompt with a $5.00 saving; `MALVA-CABLE5` applied (discountTotal 500); `NOPE` returned `DISCOUNT_CODE_REJECTED` / `unknown-code`; afterwards no probe carts remain (`origin=Merchant` query returned 0).
- `lib/ct/order-stamp.ts` `stampOrderPricing(orderId, market)` for U: reads the order, builds schedule and label snapshot with the order's creation date, writes `priceSchedule`, `labelSnapshot`, `serviceStartDate`. It relies on `stampOrderCustomFields` from `lib/ct/recurring`; not unit-tested (thin I/O wrapper), the pure part `buildOrderPricingStamp` is.

## Not done / blocked

- Chrome checks C-M-1 to C-M-22 and manual test M-M-1 are written in the plan file but not executed by me (no browser run). C-M-18 needs OA-02 and R.
- OA-05 (Checkout, Gate 2): nothing here pays; `canCheckout` and the order stamp are ready for U.
- Live verification still open: month-to-month variants for every offer, category keys of live offers against `promptPairings`, second-line prompt pricing, sign-in merge, customer-cart query (`origin=Customer`).

## Questions for the owner

- Should the label legal placeholders in `lib/config/label.ts` (`LABEL_LEGAL`) be replaced by real provider text and URLs?
- Is the minimum order value (USD 30, EUR 28) final?
- Should the prompts card appear for a cart with only one eligible pairing at a time, or all of them (now: all, capped by `PROMPT_MAX_CANDIDATES`)?

## Missed features and deviations

- The prompts logic lives in `lib/ct/prompts.ts` (not `lib/pricing/prompts.ts`) because the boundary check forbids the SDK in `lib/pricing`; its test is `lib/ct/prompts.test.ts`.
- Plan said `checkCompatibility`; implemented with J's `evaluateAddition`, `defaultEquipment`, `revalidateCartCompat`, `ruleErrorBody`, and K's `revalidateCart`, `getBuyerContext`, `getVisibleOffers`, all only imported in `lib/cart/guard.ts`.
- `ApiError.status` is a getter, so the client `CartError` exposes `httpStatus`.
- The label is English in both locales by design; the label CSS module is literal (no tokens), as the FCC format requires.
- `ONE_TIME_AS_CUSTOM_LINE_ITEM=false`: the activation fee is a custom line item (slug `activation-fee:<offerKey>`).

## TODOs for other workstreams

- U: call `stampOrderPricing(orderId, market)` right after the order is created and decide what to do with `errors`; render saved labels with `AccountPlanLabels`/`parseLabelSnapshot`; `canCheckout`, `issues` and `summary` come from `GET /api/cart`.
- V: use `AccountPlanLabels` for the account plan view.
- G: `activation-fee` attribute and the `malva-line-item` field `parentLineItemId` are relied on.
- R: sign-in merge must use `getSignInMergeArgs` (cart ownership by `anonymousId`/`customerId`); C-M-18 once ready.
- Checkout owner: `OrderedBannerSlot` and `SaveBundleSlot` in `components/bundle/slots.tsx` are placeholders for later workstreams.

## Findings

- Mixed cart (fixed and dynamic recurrence lines) works live; typing the cart `malva-order` from creation works; `paymentStrategy` is never set.
- Probe cart pricing works live and the probe is always deleted.
- Cart discount expansion by id to key map works live (`appliedDiscountKeys` and code state `applied`).
- Prettier must not be run on `app/[locale]/layout.tsx` (changes quote style); the repo style is single quotes.

## Manual tests added

- M-M-1 and C-M-1 to C-M-22 in `plan/workstreams/M-my-bundle-cart-label-prompt.md` (STATUS and TODO-MANUAL-TESTING left untouched for the orchestrator to merge).

## Junior design choices

- Cart ownership is checked on every call; a cart of another currency is ignored rather than converted.
- Removing a plan with dependents needs `cascade=true`; otherwise 409.
- One conflicting plan in the same category is refused with `replace` offered.
- Prompt pricing never cached; saving = attributable(probe) minus attributable(current), monthly lines only.
- A fee line follows the plan quantity; dependents follow the parent quantity.

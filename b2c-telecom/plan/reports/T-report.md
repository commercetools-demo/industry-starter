# Workstream T report (address book, payment methods, saved lists)

Branch `ws/t-address-book-payment-methods-saved-lists`. `npm run verify` passes (2360+ tests, build OK) after T-09 and T-14; the other commits ran lint, typecheck, boundaries and the affected tests. Live work ran against `spec-test-b2c-telecom` only (seed client behind the allow-list guard, storefront client through the app modules, throwaway customers `qa-t-*@example.com` and `probe-pm-*` deleted again). Browser checks C-T-* were not run (no browser); the three pages were not seen in a browser.

## Done
T-01 … T-15 (all ticked). Every scenario row of the plan table has a test with the verbatim title (address-book 3, payment-methods 2, saved-lists 3; "Card tokenized then listed" excluded by D-032).

Live results (storefront client, real project):
- Address book (`lib/ct/addresses.ts`): first address becomes default service and billing; a second address without "make default" keeps the existing defaults; `setDefault` moves the default; `changeAddress` with a new purpose works; removing the default address leaves `defaultShippingAddressId` empty and promotes nothing; removing the last address gives an empty book.
- Shopping lists: create with `customer`, `addLineItem` with `custom` of type `malva-list-line` (fields stored, name and variantId filled by the platform), `changeName`, `removeLineItem`, delete: all fine with the storefront client.
- Payment methods: create with the `malva-payment-method` custom type, list, version/etag fine (seed script run twice: second run "unchanged"). The storefront client can already **read** `/payment-methods` (no 403; scope for writes untested).

## Not done / blocked
- Chrome checks C-T-1 … C-T-15 (need a running app and a browser). C-T-5 also needs workstream U (checkout step; `pickPreselected` and `useAddresses` are ready for it). C-T-8's cards need `npm run seed:payment-methods -- --confirm-project spec-test-b2c-telecom --email <customer>`.
- Live "Add all to My bundle" against the real cart was not run (the catalog read needs the Next runtime); unit-tested with an injected add function. Live Stored Payment Methods through the hosted Checkout stays blocked on OA-05 (the page only lists what exists).
- `DashboardExtras` (S's slot for a lists preview) left empty (not in T's tasks; in IDEAS.md).
- `PROJECT-FINDINGS.md` not edited (the junior prompt says the orchestrator moves findings there); entry text is below.

## Questions for the owner
- German H1 words follow the T plan ("Zahlungsmethoden", "Gespeicherte Listen") but S's navigation says "Zahlungsarten" and "Merklisten". Pick one (IDEAS.md).
- Anonymous "Save for later" only goes to sign-in and does not save after sign-in (plan default kept).

## Missed features and deviations
- **Payment methods are not stored with brand text**: `PaymentMethodView.label` is only the localized record name; the UI builds "Visa ending 4242" / "Saved card" from `brand`/`last4` (messages, not server strings).
- **Custom types are in G's manifest** (`scripts/seed/data/custom-types/{payment-method,list-line}.ts`, registered in `customTypes`, so `npm run seed` and `seed:verify` know them: expected custom types 4 -> 6, tests updated). Both types now exist in the live project (created by `seed:payment-methods` and one scratch run).
- **Payment method keys** are `malva-pm-<slug>-<first 8 chars of the customer id>` (keys are project-wide; two customers would collide with the plan's fixed keys). `seed:payment-methods` and the other write scripts need `--confirm-project spec-test-b2c-telecom` (F's framework rule). A removed (Inactive) demo card is brought back on re-run.
- **Error codes** of the account API (`INVALID_ADDRESS`, `ADDRESS_UNRESOLVED`, `LIST_FULL`, ...) are literals via `AccountRefusal` in `lib/api/account-api.ts` (E's `ApiError` set is closed). Shared helper `accountRoute` (same-origin check for writes, `requireCustomerApi`, `private, no-store`, SDK errors logged by name only) is new; `lib/api/address-api.ts`, `lists-api.ts`, `payment-methods-api.ts` sit next to it.
- **SWR keys** live in `lib/cache-keys.ts` (appended: `ACCOUNT_KEY_PREFIX`, `KEY_ADDRESSES`, `KEY_PAYMENT_METHODS`, `KEY_LISTS`, `keyList`) and are re-exported from the hooks. Logout clears every key starting with `account:` (one line added to `hooks/useAuthMutations.ts`).
- **Account nav links already existed** (S), so no nav edit. Dialog: S/M's `ConfirmDialog` (components/bundle) is reused for delete/remove/delete-list; `AddressDialog` is a native `<dialog>` of its own.
- **Lists**: `SavedListLine` has extra `term`, `recurring` (price shown "/mo") and `variantLabel` only for terms-less variants (handset "Black · 256 GB"); `BundleMoveResult.cart` may be null and `skipped[].reason` carries `messageKey`/`params` of J/K so the UI localizes the verdict. `fromCart` skips fee lines and lines included at no charge (the plan brings them). Quantity of a saved line is clamped to 1–5.
- `lib/lists/{delta,order,resolve}.test.ts` are one file (`lib/lists/lists.test.ts`); `loadLinePrices` lives in `lib/ct/lists.ts` (with the rest of the module).
- Cart add uses M's `addToBundle` (not `addShoppingList`), injected through `moveListToBundle(..., addLine)`; the session cart id is remembered via the new `after` hook of `accountRoute`.
- Appended to others' files: `components/offers/OfferCard.tsx` and `AddonCard.tsx` (one `SaveToListButton` line each), `components/bundle/slots.tsx` (`SaveBundleSlot` now renders `SaveBundleAsList`; M's slot was meant for this), `lib/cache-keys.ts`, `lib/types.ts` (T section), `package.json` (two scripts), `messages/*.json`, `scripts/seed/checks/catalog.ts` and two seed tests (counts).
- The address dialog's "Make this my default" applies to both purposes the address serves.
- Page address data comes from the customer the guard already read (no second request); SWR fallback with `revalidateOnMount: false` on addresses, payment methods and one list (the lists index revalidates because it also reads the cart).

## TODOs for other workstreams
- U: import `useAddresses` / `pickPreselected`; show only addresses with `country === market.country`; `useAddresses({ enabled: signedIn })`.
- U/Checkout (OA-05): saved cards appear only when the Adyen connector has Stored Payment Methods on; the connector's records need the `malva-payment-method` fields (`brand`, `last4`, `expMonth`, `expYear`) or the row shows the record name / "Saved card".
- Owner: `manage_payment_methods` for writes (make default / remove) is probably still needed on the storefront client (read already works); M-T-1 stays.

## Findings
(for `PROJECT-FINDINGS.md`, section "T: Payment Methods, lists, addresses")
- **Payment Methods: the platform does NOT clear the previous default; it refuses a second default**: `POST /payment-methods/{id}` `setDefault true` while another record is default answers `400 InvalidOperation "Customer can only have one default PaymentMethod."`. Probe result `PLATFORM_CLEARS_PREVIOUS_DEFAULT=false` (run 2026-10-07). So clearing the old default first (what `setDefaultPaymentMethod` does) is mandatory, not a precaution.
- Storefront client (`.env.local`): `GET /payment-methods?where=customer(id="…")` and `GET /shopping-lists?where=customer(id="…")` answer 200 (no 403 on read). Writes to payment methods with the storefront client were not tried (seed client was used for the seed/probe).
- Shopping-list line `custom` uses the Type resource id `line-item` (same as cart lines; confirmed by the docs and by a live write); `shopping-list-line-item` does not exist.
- Customers `addAddress` + `addShippingAddressId {addressKey}` + `setDefaultShippingAddress {addressKey}` in ONE update work when the address has a `key`; removing the default address clears `defaultShippingAddressId` and promotes no other address.
- `where` on shopping lists has no `matches`; delete by key prefix needs a list-and-filter.
- `GET /payment-methods` expects the `customer(id="…")` predicate: accepted live.

## Manual tests added
M-T-1 (already in the workstream file).

## Junior design choices
- Address cards: bordered `rounded-xl` cards in an auto-fit grid, tags with `Tag` (pink = default service, brand = default billing, neutral = plain Service/Billing), text-link actions (the "make default" action is hidden when it already is the default or the address does not serve that purpose), screen-reader suffix with the person's name on each action.
- Address dialog: two-column field rows from 640 px, State only for US, three checkboxes, inline errors under fields, the "We couldn't verify this address" panel replaces the form body.
- Payment methods: one row per method (brand tag, "Visa ending 4242", "Expires 03/30", pink "Default" tag, text actions); empty state with a "Go to My bundle" button; unavailable state is a status paragraph.
- Lists: list cards with count and date; detail rows with price now (`/mo`), price-changed tag (pink = up, brand = down), greyed unavailable rows, result panel (`role` section with the plain list of skipped lines) above the rows; rename and delete as text actions; inline name form (`ListNameForm`) for new, rename and "New list…" in the save popover.
- `SaveToListButton`: text link "Save to list" opening a bordered radio group; nothing renders until the session is known.

## Chrome checks ready
C-T-1 … C-T-4, C-T-6, C-T-7, C-T-9 … C-T-15 as written in the workstream file (C-T-5 needs U). Notes for the checker: the seeded card keys carry the customer id prefix; `npm run seed:payment-methods` needs `--confirm-project spec-test-b2c-telecom`; demo helper scripts also need `--confirm-project` (`npx tsx scripts/demo/set-list-line-price.ts --confirm-project spec-test-b2c-telecom <listKey> <lineIndex> <cents>`; the list key is `malva-list-<uuid>`, read it with commerce MCP `read_shopping_lists`); the list names are stored in both locales with the same text; the add-all result panel is the `section` that contains "n items added to My bundle."; the catalog cache lasts 60 s.

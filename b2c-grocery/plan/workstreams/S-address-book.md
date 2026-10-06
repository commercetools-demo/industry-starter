# S — Address book

**Specs:** `grocery-storefront-features` → `address-book-design` (all); existing behavior `address-book`
**Depends on:** O, Q, R · **Unblocks:** — · **Sign-off:** SO-07

## Goal
Customers manage addresses and can pick one in the cart delivery step.

## Design
- Type `Address` (J) plus `id`, `isDefaultShipping`, `isDefaultBilling`, `key?` (mapper `lib/mappers/address.ts`).
- `lib/ct/addresses.ts` (`server-only`), all via `customers().withId().post({ body: { version, actions } })` with retry on 409: `getAddresses(customerId)`, `addAddress` (`addAddress` then `setDefaultShippingAddress` when it is the first), `changeAddress` (`changeAddress` by `addressId`), `removeAddress`, `makeDefault(addressId)` (sets default shipping **and** billing). Deleting the default clears it (commercetools does this when the address is removed; verify and test the mapper outcome).
- Validation `lib/address-validation.ts` (client-safe): `validateAddress(a): Record<field,errorKey>`; required: firstName, lastName, streetName, postalCode, city, country; country ∈ {US, DE}; postcode: US `^\d{5}(-\d{4})?$`, DE `^\d{5}$`; phone optional `^[+\d][\d\s-]{5,}$`.
- Routes (`/api/account/addresses`, 401 anonymous): `GET`, `POST`, `PATCH /[addressId]`, `DELETE /[addressId]`, `POST /[addressId]/default`; responses return the full list. `privateJson()` from R.
- Hook `useAddresses()` (`KEY_ADDRESSES`) + mutations (update cache from response).
- Page `/account/addresses` (`(protected)`): 2-column grid of cards: name, lines, city/postcode/country, "Default" `Tag accent-2`, actions Edit, Delete, "Make default"; empty state + "Add an address"; `AddressDialog` (H `Dialog`) with `Field`s; delete uses a confirm `Dialog`.
- Cart integration: in `CartDeliveryStep` (Q) for signed-in customers show `SavedAddressPicker` (radio cards, default preselected) above the manual form and an "Add a new address" option; choosing one calls `PUT /api/cart/address` with the saved address.

## Tasks
- [x] S-01 Write `lib/address-validation.ts` + `lib/mappers/address.ts` + tests (every field rule, both countries; default flags mapped).
- [x] S-02 Write `lib/ct/addresses.ts` + tests (actions sent for add/change/remove/default; first address becomes default shipping; retry on 409).
- [x] S-03 Write the API routes + tests (401; validation errors 400 with field keys; list returned after each change).
- [x] S-04 Write `useAddresses` + tests.
- [x] S-05 Write the page, `AddressDialog`, delete confirmation + tests (default tag; invalid postcode shows inline error and nothing saved; delete default clears the tag; empty state).
- [x] S-06 Write `SavedAddressPicker` and wire into Q's step + tests (default preselected; picking calls cart address endpoint; "add new" shows form). Messages (both locales); report manual tests M-S-1…M-S-3 and sign-off SO-07.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Default marked / Save address / Invalid postcode | S-01, S-05 |
| Delete default | S-05 |
| Pick saved address | S-06 |

## Manual tests to report
- M-S-1: Register a customer at `/en-US/account/register` (or sign in as a QA customer), open `/en-US/account/addresses` (empty state "You have not saved an address yet." and an "Add an address" button). Add address 1 (Ada Lovelace, 1 Main St, 94105 San Francisco, US) and address 2 (Bo Kim, 9 Oak St, 10001 New York, US): the first card carries the olive "Default" tag by itself, the second has "Edit / Delete / Make default". Press "Make default" on the second: the tag moves to it at once. In Merchant Center → Customers → the customer → Addresses, the second address is Default shipping and Default billing. Try an invalid postcode (US `1234`, DE `1234`) in the dialog: an inline error appears and nothing is saved. Open `/en-US/account`: the "Default address" card shows the new default. Needs: a customer (clean up with `npx tsx scripts/seed/cleanup-qa.ts`).
- M-S-2: With two addresses where the second is default, press Delete on the default card: the confirmation dialog warns that no default address will remain; confirm. The card is gone and the remaining card has no "Default" tag. In Merchant Center the customer has no default shipping or billing address. The dashboard "Default address" card shows its empty state with "Add an address". Needs: the customer from M-S-1.
- M-S-3: Signed in as that customer with one product in the bag and a US default address, open `/en-US/cart`: the Delivery card shows the saved addresses as radio cards with the default preselected, the address is applied to the bag (no typing) and the delivery slot days load below. Pick the other saved address: slots reload. Choose "Add a new address": the manual form appears. Reload the page: the chosen address stays selected. Anonymous in a private window: only the manual form. Needs: a customer with saved addresses (M-S-1).
- M-S-4: German store at `/de-DE/account/addresses` and `/de-DE/cart` (informal "du"): add a DE address (Berlin, 10115) and a US one. In the German cart the DE address is selectable, the US one is greyed out with "Delivery to this country needs the other store". The dialog's country select offers "United States" and "Deutschland". Needs: the customer from M-S-1.

## Definition of done
Validation shared client/server; cart integration works; `verify` passes; SO-07 requested.

## Implementation notes (deviations, recorded by the developer)
- **Live findings (`PROJECT-FINDINGS.md` section 18, throwaway customer):** `removeAddress` on the default address clears `defaultShippingAddressId` and `defaultBillingAddressId` by itself, so no extra action is sent and nothing else is promoted; `addAddress` with a `key` plus `setDefaultShippingAddress` with `addressKey` in one update makes the first address default; `changeAddress` keeps default flags.
- Type: `SavedAddress extends Address` (`id`, `isDefaultShipping`, `isDefaultBilling`, `key?`) in `lib/types.ts`; the plan said "Address plus ..." but cart code uses plain `Address`, so the extra fields are a separate type. Mapper `mapAddresses(customer)` in `lib/mappers/address.ts` (skips addresses without an id).
- `lib/ct/addresses.ts` functions return the **mapped full list** (`SavedAddress[]`), take only `customerId` (they read the customer fresh and retry once on 409). New typed errors: `AddressNotFoundError` (an id that is not in this customer's book: checked before calling commercetools, so a foreign id never reaches the API; routes answer 404 `ADDRESS_NOT_FOUND`) and `AddressCustomerNotFoundError`. New addresses get a generated key `address-<uuid>`.
- `lib/address-validation.ts`: `validateAddress(values)` returns `{ field: 'required' | 'invalidCountry' | 'invalidPostcode' | 'invalidPhone' | 'tooLong' }` (the key is the suffix of `account.addresses.errors.*`); also `normalizeAddress`. Values over 100 characters are rejected (same limit as the cart address route). The cart's `AddressForm` and `PUT /api/cart/address` keep their own validation (Q); see IDEAS.
- API: `lib/api/address-api.ts` (`addressesJson`, `parseAddressBody`, `addressFailure`). Answers are `{ addresses }` (POST 201); 400 `INVALID_ADDRESS` `{ fields: { <field>: <errorKey> } }`; 401 via `unauthenticated()`. The scan test `app/api/account/private-responses.test.ts` accepts `addressesJson` as a `privateJson` wrapper (one added word in its regex); each route still calls `getSession()` itself. PATCH takes the **whole** address (not a partial).
- Hook: `useAddresses({ enabled })` (`addresses`, `defaultAddress`) and `useAddressMutations()` (`add`, `update`, `remove`, `makeDefault`; throw `ApiError`, write the answer into `KEY_ADDRESSES` and revalidate `KEY_PROFILE` so the dashboard card follows). `KEY_ADDRESSES` was already cleared on logout (O).
- UI: page `app/[locale]/account/(protected)/addresses/page.tsx` (H1 + `AddressBook` + `DetailsCard current="addresses"`), `components/account/{AddressBook,AddressDialog}.tsx`. "Make default" is hidden on the card that is already default shipping. The "Add an address" button is always shown under the grid (also in the empty state). Messages: `account.addresses.*` and `cart.saved.*` (both locales, German machine translated, see IDEAS).
- Cart: `components/cart/DeliveryAddress.tsx` replaces `<AddressForm>` in `CartDeliveryStep` (a two-line change there) and decides between the form and `SavedAddressPicker`. Rules: anonymous or no saved addresses -> the manual form (no addresses request for anonymous shoppers); a cart with no address gets the **default shipping address applied once** (`PUT /api/cart/address`) so that slots load (M-S-3); a cart address that equals a saved one selects it; any other cart address stays untouched and appears in the form under "Add a new address" (we never overwrite an address the shopper typed). Saved addresses of the other country than the store market are disabled with the Q `countryMismatch` text, and the default is not auto-applied then. Picking calls `useDeliveryMutations().saveAddress` (slot clearing and notices stay in Q's step). Two assertions in `CartDeliveryStep.test.tsx` now also ignore `/api/auth/me` (the step reads the account).
- SO-07 (address book and dialog design, not drawn) awaits the owner after M-S-1.

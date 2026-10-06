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
- [ ] S-04 Write `useAddresses` + tests.
- [ ] S-05 Write the page, `AddressDialog`, delete confirmation + tests (default tag; invalid postcode shows inline error and nothing saved; delete default clears the tag; empty state).
- [ ] S-06 Write `SavedAddressPicker` and wire into Q's step + tests (default preselected; picking calls cart address endpoint; "add new" shows form). Messages (both locales); report manual tests M-S-1…M-S-3 and sign-off SO-07.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Default marked / Save address / Invalid postcode | S-01, S-05 |
| Delete default | S-05 |
| Pick saved address | S-06 |

## Manual tests to report
- M-S-1: Add two addresses; set the second as default: tag moves; Merchant Center → customer shows the defaults.
- M-S-2: Delete the default: no address marked default.
- M-S-3: In the cart, the default address is preselected and slots load.

## Definition of done
Validation shared client/server; cart integration works; `verify` passes; SO-07 requested.

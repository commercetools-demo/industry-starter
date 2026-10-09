# Workstream P: todos and live checks (no credentials; BLOCKED on OA-02/OA-03)

## Live checks (need a seeded project and `.env.local`)
1. Sign in as Sam, open `/en-US/account/addresses`: add an address, tick "Use as my default address". `read_customers` must show it in `addresses`, in `shippingAddressIds` and as `defaultShippingAddressId`; the first address of an empty book becomes the default without the tick.
2. Remove the default: `defaultShippingAddressId` is empty, the other address is not promoted, the page shows "You have no default address...".
3. ZIP "1234": inline error, focus on ZIP. State NY with ZIP 90210: warning naming state and ZIP code and "CA"; nothing stored until "Save anyway".
4. `fetch('/api/account/addresses/<another customer's address id>', {method:'DELETE'})` answers 404 `{error:'Not found.'}`; signed out answers 401.
5. As Alex remove the only address: empty state "No addresses yet".
6. Confirm the platform accepts `addAddress` with a `key` followed by `addShippingAddressId`/`setDefaultShippingAddress` with `addressKey` in one update (verified against the docs, not against a live project), and that `setDefaultShippingAddress` with no address id unsets the default.
7. `/en-US/account/profile`: change the name, header initials follow; change the password (wrong current password answers "Your current password is not correct.").
8. 390 px layout of both pages (class-level only so far; no browser check was possible).

## For other workstreams
- Q (checkout): use `useAddresses()` from `hooks/use-addresses.ts`; `defaultAddress` is the preselected address (null: ask the patient to choose), `addresses` the others. `AddressForm` (props `onSave`, `onCancel`, `onSaved`, `prefillName`) and `AddressList` can be reused. After applying a saved address to a cart, re-read the cart (the platform recalculates shipping and tax).
- R (account shell): move `app/[locale]/(protected)/account/addresses/page.tsx` and `.../profile/page.tsx` into the shell (R-02); add links to both from the account menu; the profile page has no sign-out button (J-missed).
- Owner: SO-03 (address book look).

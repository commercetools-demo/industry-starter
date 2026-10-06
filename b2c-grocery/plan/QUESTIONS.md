# Questions to the owner

Juniors: add a question when you must stop and ask (see JUNIOR-GUIDE §7). Format:

## Q-001 (workstream X, task X-03)
**Question:** ...
**Blocking:** yes/no
**Answer (owner):**

## Q-H-1 (workstream H, task H-08/H-10)
**Question:** The announcement bar text (`common.announcement`) is "Fresh groceries from growers we trust, delivered to your door." because the delivery threshold must not be hard-coded (D-021, D-049). Do you want different copy, or should the bar be hidden until a real message exists? Also: the header's bag and account controls are plain placeholder links until J/O fill the slots.
## Q-G-001 (workstream G, task G-08)
**Question:** G-08 says to change `app/[locale]/layout.tsx` to pass `getValidMarkets()` to `LocaleSwitcher`, but `LocaleSwitcher`, the header and footer are created in H-09/H-10 (after G; H's own text says "G-08 switches the layout to `getValidMarkets()`"). Done in G: `lib/ct/locale-validation.ts` (`getValidCountryConfig`, `getValidMarkets`, TTL 300) and `POST /api/locale` rejects markets not valid for the project (400, tested). Proposed: H composes the layout with `markets = await getValidMarkets()` and adds the test "a market missing from the project is not offered" (Header/LocaleSwitcher level). I edited neither H's file nor the layout.
**Blocking:** no
**Answer (owner):**

## Q-J-1 (workstream J, task J-04)
**Question:** `defaultSubstitutionPreference(product)` takes only the product but the rule needs category keys, and `Product` only has `categoryIds`. Implemented as `defaultSubstitutionPreference(product, categoryKeys = [])` plus `categoryKeysOf(product, tree)` (resolved from the cached category tree in the add route). Chilled storage always wins. OK?
**Blocking:** no
**Answer (owner):**

## Q-J-2 (workstream J, task J-05)
**Question:** The add route returns 404 `UNKNOWN_SKU` for a SKU that is not in the catalog (the plan did not say). Also quantity must be an integer >= 1 for PATCH too (removing is DELETE). OK?
**Blocking:** no
**Answer (owner):**

## Q-O-1 (workstream O, tasks O-01..O-06)
**Question:** Live checks show commercetools answers HTTP 400 (not 401/409) for wrong credentials (`InvalidCredentials`) and duplicate email (`DuplicateField`), and 404 for unknown email on password token and for used/expired reset tokens (details in `PROJECT-FINDINGS.md` section 15). I map them to the plan responses (401 INVALID_CREDENTIALS, 409 ACCOUNT_EXISTS, 400 INVALID_TOKEN). Also: sign-in retries without the anonymous cart if the first attempt fails for a non-credential reason, so a stale cart cannot block login. OK?
**Blocking:** no
**Answer (owner):**

## Q-O-2 (workstream O, task O-09)
**Question:** `/en-US/account` and `/en-US/account/orders` do not exist until R, so after register, sign-in without `redirect` or password reset the shopper lands on a 404 page for now. Should the default landing be changed (for example to `/`) until R merges? I kept `/account` as specified.
**Blocking:** no
**Answer (owner):**

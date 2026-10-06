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

## Q-ORCH-1 (found by orchestrator while testing J)
**Question:** The cart/currency comes from the *session* market, the page language from the *URL* locale. A visitor whose session says `de-DE`/EUR who opens `/en-US` directly sees English text but an EUR cart (and the catalog price currency follows the session too). Should the proxy/layout sync the session market to the URL locale on every request (recommended: yes, same rule as the locale switch: currency change drops the cart), or keep the explicit switch only?
**Blocking:** no (default for now: explicit switch only; see IDEAS)
## Q-K-1 (workstream K, task K-05)
**Question:** The market (currency/country) comes from the session or the `your-shop-country-locale` cookie, but the proxy does not set it when someone opens `/de-DE/...` directly, so the cart layout (J) and `getMarket()` would give USD under a German URL. K avoids it by deriving currency/country from the URL locale (`COUNTRY_CONFIG[locale]`). Should `proxy.ts`/`getMarket()` do this for everyone (L, M, P, cart), or is the locale switcher the only intended way to change market?
**Blocking:** no
**Answer (owner):**

## Q-P-1 (workstream P, task P-04)
**Question:** P-04 asked for fullText on name plus a SKU OR clause. Live, fullText misses German compounds ("milch" vs "Vollmilch") and partial words, so I also OR a case-insensitive `wildcard *q*` on name (substring match, wildcards in user input escaped). Any query of 4+ letters/digits/hyphens also adds the exact-SKU clause (so "milk" does too, harmlessly). Trade-off: wildcard scans the name of every product (fine for a small catalog; revisit for very large ones). OK?
**Blocking:** no
**Answer (owner):**

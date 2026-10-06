# Questions to the owner

Juniors: add a question when you must stop and ask (see JUNIOR-GUIDE §7). Format:

## Q-001 (workstream X, task X-03)
**Question:** ...
**Blocking:** yes/no
**Answer (owner):**

## Q-G-001 (workstream G, task G-08)
**Question:** G-08 says to change `app/[locale]/layout.tsx` to pass `getValidMarkets()` to `LocaleSwitcher`, but `LocaleSwitcher`, the header and footer are created in H-09/H-10 (after G; H's own text says "G-08 switches the layout to `getValidMarkets()`"). Done in G: `lib/ct/locale-validation.ts` (`getValidCountryConfig`, `getValidMarkets`, TTL 300) and `POST /api/locale` rejects markets not valid for the project (400, tested). Proposed: H composes the layout with `markets = await getValidMarkets()` and adds the test "a market missing from the project is not offered" (Header/LocaleSwitcher level). I edited neither H's file nor the layout.
**Blocking:** no
**Answer (owner):**

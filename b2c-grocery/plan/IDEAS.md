# Ideas (out of scope, parked)

Juniors: add unrelated ideas here instead of changing code outside your task. Format: `- [WS-letter] idea`.

## From orchestrator browser tests (2026-10-06)
- `/favicon.ico` returns 404 (no icon yet). Add `app/icon.*` (brand mark) — small, any workstream after H.
- [H] `hooks/useLocaleSwitch.ts` calls `fetch('/api/locale')` directly because `lib/fetcher.ts` (G-02) is not merged yet; switch it to `sendJson` once G is merged.
- [H] Footer shop links hold per-locale category slugs in `messages/*.json` (`footer.slugs.*`) to avoid a data call in the footer; when G-08/K expose the category tree, derive the links (and labels) from it.
- [H] Machine-translated German keys to review: `common.announcement`, `nav.searchPill/menu/closeMenu/primary/home`, `footer.*`, `a11y.language`.
- [H] Announcement bar text is generic ("Fresh groceries ... delivered to your door") because delivery thresholds must not be hard-coded (D-021, D-049); owner may want a different message.
- [H] Header on compact widths hides the search pill and saved icon below `tablet` (they are in the menu drawer); revisit when SO-01 is reviewed.
- [G] Migrate `unstable_cache` (category tree, project locale settings) to the `use cache` directive if Cache Components is enabled later; Next 16 docs mark `unstable_cache` as replaced.
- [G] `products().search()` projections need the deprecated `productProjectionParameters`; revisit when commercetools offers a non-deprecated way to get scoped prices in search results.
- [G] German `fullText` search is token based ("milch" does not find "Vollmilch"); consider a `wildcard` query for P (search) if compound words matter.
- [G] Listing without text and sort has no explicit tiebreaker; if pagination ever shows duplicates add a secondary sort (e.g. `createdAt`).

## From workstream J
- [J] `hooks/useLocaleSwitch.ts` still calls `fetch('/api/locale')` directly (G-02 `sendJson` now exists); switching it is a tiny follow-up in H's area.
- [J] German keys to review (machine-translated): `nav.bagCount`, all of `cart.*`.
- [J] A line's name is not a link to the PDP yet (the PDP route comes with L); add the link (and a thumbnail link) when `/product/[slug]` exists.
- [J] `getAvailableQuantity` is one inventory call per add/change; a batch `getAvailableQuantities(skus)` would help if the cart page ever revalidates stock per line.
- [J] Undo after Remove re-adds with the default substitution preference (the removed line's preference is not restored).

## From workstream K
- [K] Loading skeleton (`app/[locale]/shop/loading.tsx`) with tile-height placeholders and an inline retry card (design "States") are not built.
- [K] Optional category description under the H1 (`showDescription`) once categories carry descriptions.
- [K] German keys to review (machine-translated): all of `plp.*`.
- [K] `SaveButton` and `useSaved` are stubs until T; T must replace `hooks/useSaved.ts` only.
- [K] Quick add-to-bag on tiles (not drawn) could use `useCartContext().addItemWithToast`.
- [L] German keys to review (machine-translated): all of `pdp.*`.
- [L] Mobile PDP from `design/specs/pdp.md` ("Responsive (proposed)"): the swipe carousel with dots and the sticky bottom bar (price + Add to bag) below 768 px are not built; the page stacks gallery and buy box instead.
- [L] `addItemWithToast` could return `{ ok, available }` (or take an `onInsufficient` callback) so the PDP can show the inline "Only N available" for a server-side 409 too, not only for the client-side check.
- [L] `marketFor(locale)` (`lib/market.ts`) duplicates the private helper in `app/[locale]/shop/page.tsx`; switch the shop page to it, or fix the root cause in Q-K-1.
- [L] "Pairs with" shows the first 4 other products of the first category; it could use `substituteProductIds` or an explicit pairing attribute later.
- [K] Facet counts cost up to 3 extra lean searches when category, price and stock are all active; cache or merge if search latency becomes an issue.
## From workstream O
- [O] German keys to review (machine-translated): all of `auth.*`.
- [O] Signed-in visitors who open sign-in, register or forgot-password still see the form; redirecting them to `/account` would be friendlier.
- [O] No "sign out" control exists yet (the account area arrives in R); `useAuthMutations().logout` and `/api/auth/logout` are ready.
- [O] The email-verified banner with "resend" from `design/specs/account.md` is moot while registration auto-verifies (D-038); `isEmailVerified` is not kept in the session.
- [O] Password rules are length only (8+), as specified; a breached-password or strength check could be added.

## From workstream P
- [P] German keys to review (machine-translated): all of `search.*` (title "Finden Sie es", suggestions).
- [P] Search ranks by commercetools default (no sort). A relevance boost for whole-word matches over substring matches, and a "did you mean" for zero results, are not built.
- [P] Search suggestions as typeahead dropdown (live results while typing) is not in the plan; the 300 ms URL update re-renders the page instead.

## German tone consistency (orchestrator, 2026-10-06)
- German copy mixes informal "du" (cart: "Dein Warenkorb", footer "deine Tür") and formal "Sie" (search: "Finden Sie es", "Probieren Sie es mit"). Decide one register (recommend informal "du" to match the brand voice) and align all `de-DE.json` keys in the final copy review.
- [X] All copy in `site/content/**` (about, faq, journal, policies) is placeholder and needs owner review (SO-10, SO-13); legal pages (privacy, terms) need real legal text. German is a faithful translation by the developer; please have it reviewed.
- [X] Footer links only to `/policies/delivery`; add returns, privacy and terms (H owns the footer). The homepage contact strip (M) should link to `/contact`.
- [X] German keys to review (machine-translated): `static.*` and the German markdown in `content/de-DE`.
- [X] Contact form has no CAPTCHA; in-memory rate limit only (D-047). Real delivery (email/CRM) is out of v1 (D-044).

## Orchestrator notes (2026-10-06)
- Product images are picsum.photos landscapes (random, not food). Replace with real grocery photos (owner or a stock set) before launch; `washed` styling is already applied.
- Fixed by orchestrator: locale switch on a PDP produced a 404 (slugs differ per locale). `getProductBySlug` now tries every market language and the PDP redirects to the canonical slug of the URL locale.
## From workstream M
- [M] German keys to review (machine-translated): all of `home.*` (hero, grid tiles, categories, new in, editorial, contact).
- [M] Real photography (hero, six categories, five magazine tiles, editorial) is an owner item (M-M-3); the homepage currently uses picsum placeholders. A small content file or per-image env could replace the code map in `lib/config/home-images.ts`.
- [M] The homepage fails as a whole if the product search or category tree fails (the `error.tsx` boundary shows). Rendering the other sections without the failed one would be more resilient.
- [M] "Recently ordered / Recommended for you" and quick order from `home-landing-page` have no drawn design (D-022) and are not built. The newsletter and promo banner from the Canvas are not built either.
- [M] The editorial panel copy ("A morning at the bakery") is static placeholder; its link target `/journal` depends on workstream X.
## From workstream Q
- [Q] German keys to review (machine-translated): `cart.step.*`, `cart.slotCleared`, `cart.noSlots`, `cart.nextAvailable`, `cart.slotTaken`, `cart.slotExpired`, `cart.chooseSlot`, `cart.addAddress`, `cart.slotLine`.
- [Q] Slot times are UTC in the stub; real slots need the delivery area's time zone (and a day boundary in local time).
- [Q] Show a hold countdown ("held for 12 min") next to the chosen slot.
- [Q] The address form always shows; a collapsed "Deliver to Ada, 10001 New York · Change" summary after saving would be tidier (the signed-in saved-address picker comes in S).
- [Q] Changing the country should switch the market (see Q-Q-1) instead of blocking.
- [Q] Slot capacity is global in the stub; per-postcode-area capacity would need the `country`/`postalCode` arguments that the interface already carries.
## From workstream N
- [N] German keys to review (machine-translated): `pricing.*` (e.g. "Gesamt (vorläufig)", "Der Endbetrag hängt vom Gewicht ab, das wir abwiegen.").
- [N] Mark approximate-weight lines ("about 500 g" / "approx.") on tile, PDP and cart line, not only in the cart summary.
## From workstream T
- [T] German keys to review (machine-translated, informal "du"): all of `account.saved.*`.
- [T] A failed heart toggle only rolls back silently; show a toast ("We could not save that. Please try again.") once `useSaved` can reach the toast context safely.
- [T] The header "Saved" entry (`nav.saved`) and the account hub should link to `/account/saved`; R owns the account hub, H the header.
- [T] Deleting a customer leaves its `wishlist-<customerId>` shopping list behind in commercetools; the QA cleanup script should delete those lists too.
- [T] Saved cards always add quantity 1 of the first variant; weight products (N) may need their increment instead.

## Fixed by orchestrator in T (2026-10-06)
- Heart click while signed out → sign-in → the shopper stayed on the sign-in page (PendingSaveRunner ran on the sign-in URL because it also carries `save`, stripped the param and `router.replace`d back to sign-in, racing with the login redirect). The runner now ignores `/account/sign-in` and `/account/register`; regression test added. Cleanup script also deletes `wishlist-<customerId>` lists.
## From workstream R
- [R] German keys to review (machine-translated): the whole `account.*` namespace (e.g. "Kunde seit {year}", "Wird gepackt", "Ähnliches erlaubt").
- [R] The theme has no `--color-muted`: `text-muted` (used in J/N components such as `CartSummary`, `PriceBlock`) is silently ignored. Define a muted token or switch those to `text-text/60`.
- [R] Order detail: "Track", "Reorder" and a status timeline (design spec, `post-purchase-order-management`) are not built; neither are Returns or an unverified-email banner.
- [R] The dashboard orders table could show skeleton rows while loading (spec) instead of the loading sentence.
- [R] Order dates and slot times are UTC (like the slot stub); show them in the delivery area time zone once slots have one.
- [V] Show the order total from the hosted checkout (its own price summary) next to ours, or hide our summary under 1200 px behind an expandable bar as the design spec proposes ("Responsive (proposed)"); today the summary stacks above the hosted flow below the `desktop` breakpoint.
- [V] Close the hand-off gap without the browser: a commercetools Subscription on `OrderCreated` (or Connect job) that confirms the slot booking and links guest orders; see Q-V-1.
- [V] Pass `styles` / `languageOverrides` to `checkoutFlow` so the hosted UI follows the tokens even without Merchant Center branding (M-V-1 checks the branding only).
- [V] German keys to review (machine-translated): the whole `checkout.*` namespace (e.g. "Zur Kasse", "Danke, {name}", "Bewahre deine Bestellnummer auf").
- [V] The SDK only knows `de` (not `de-DE`); `CheckoutFlow` maps `de-*` to `de`. Other locales added later must be checked against the SDK's locale list.

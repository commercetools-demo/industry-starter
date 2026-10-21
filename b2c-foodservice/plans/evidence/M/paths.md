# M-00 paths (read on branch ws/m-reviews, from develop 9cf64a9b)

Preconditions: H, J, G, D, F, A are on develop. L (account area) is not built: there is no `app/[locale]/account/(shell)` and no Reviews stub, so M-08 creates `app/[locale]/account/(shell)/reviews/page.tsx` itself (a route group with no layout; L adds the shell layout later and keeps this page). I (cart) is parallel.

| Item | Real location |
| --- | --- |
| H slot | `components/pdp/ReviewsSlot.tsx` (`{ productId }` only; renders `<div id="reviews-list">` when `REVIEWS_ENABLED`). Mounted by `components/pdp/ProductDetail.tsx` after `RatingSummary`. M extends the props to `{ productId, productSlug, sku, productName, stats }` and edits `ProductDetail.tsx` (one line) |
| Rating summary | `components/pdp/RatingSummary.tsx` renders `<section id="reviews">` with the summary and the distribution bars. M's body is mounted after it as a sibling with its own `id="reviews-list"` and `id="write-review"` anchors |
| Flag | `lib/shop-config.ts` `REVIEWS_ENABLED` (false; M sets true) |
| Rating mapper | `lib/mappers/rating.ts` `mapRatingStats` (`RatingStats { average, count, distribution }`). No G fallback attribute exists and no finding in `PROJECT-FINDINGS.md`, so M-09 is not needed |
| J | `lib/api-domain.ts` `domainError` (closed code union; M appends `already_reviewed`), `lib/rate-limit.ts` `rateLimit(key, {limit, windowMs})` and `hashKey`, `lib/auth/redirect.ts` `safeRedirect` (fragment `#[A-Za-z0-9-]*`), `hooks/useAccount.ts`, `lib/routes.ts` `signInHref` |
| D | `lib/api.ts` `handle`, `requireCustomer`, `jsonError`; `lib/ct/retry.ts` `updateWithRetry`; `lib/cache-keys.ts` already has `keyReviews(productId, sort, page)` and `keyMyReviews(customerId)`; `my-reviews` is in `USER_SCOPED_KEYS` |
| Session | `lib/session.ts` carries `customerId`, `customerFirstName`, `customerLastName`, `locale` |
| Seed | `seed/src/data/reviews.ts` (reviews keyed `mcf-review-<sku>-<n>`, `uniquenessValue` = key, no state). No `mcf-review` custom type yet (M-02) |
| Mock server | `scripts/mock-ct-server.mjs` (M adds `/reviews`, `/orders`) |

Live seed `verify` output needs credentials: owner row M-M-03 in `plans/notes/todo-M.md`.

# Evidence, workstream M (reviews and ratings)

All runs are against the local mock commercetools server (`storefront/scripts/mock-ct-server.mjs`, reviews in `scripts/mock-fixtures/mock-reviews.mjs`). No live project and no credential was used. Live runs are owner rows M-M-03 and M-M-04 in `plans/notes/todo-M.md`.

| File | Proves |
| --- | --- |
| `paths.md` | M-00 map of H, J, G, D, L paths |
| `api-run-mock.txt` | R6 create (201, published at once, statistics 12 to 13, Verified purchase from the order lookup, `customerId` in the body ignored), R8 duplicate (409 with reviewId), R9 missing rating (422, no CT call), R10 edit, foreign review and unknown id give the same 404, 401 with no detail, R13 delete (13 to 12), R14 rate limit (6th create is 429), R16 no email or customer id in the public list, R11 markup stored unchanged |
| `no-dangerous-html.txt` | 0 matches for `dangerouslySetInnerHTML` in reviews code |

Unit tests: `lib/reviews/validate.test.ts`, `lib/ct/reviews.test.ts`, `app/api/reviews/reviews-routes.test.ts`, `hooks/useReviews.test.tsx`, `components/reviews/*.test.tsx`, seed `src/reviews.test.ts`. `npm run check` and `npm run build` pass.

Not done: browser screenshots R1 to R16 at 375 and 1440 px (the Chrome DevTools MCP profile was held by another session on every retry), live read-backs and `readbacks.json`, `test-reviews.txt` (no live reviews created).

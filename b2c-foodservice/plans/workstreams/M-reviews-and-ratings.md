<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream M: Reviews and ratings

Paths are relative to `storefront/` unless they start with `plans/` or `seed/`. Read `plans/JUNIOR-GUIDE.md` first. Real exports of other workstreams are used as written in their plan files (`D-server-core.md`, `G-browse.md`, `H-product-detail.md`, `J-auth-and-session.md`, `L-account-area.md`). If a real export differs from this plan, use the real one and say so in your hand-off.

## 1. Header

| Field | Value |
| --- | --- |
| ID | M |
| Name | Reviews and ratings: list, sort, write, own reviews (no moderation) |
| Depends on | H (product page with the `#reviews` section and `RatingSummary`), J (sign-in, `domainError`, `lib/rate-limit.ts`, `safeRedirect`), and transitively G (rating mapper, listing by rating), L (account shell for the Reviews tab), D (session, errors, cache keys) |
| Wave | 9 (parallel with L) |
| Primary spec | `reviews-and-ratings` |
| Also read | `bootstrap-and-structure`, `server-architecture-and-data-flow` (Route Handler table, Errors, Caching), `design-tokens-and-components` (Rating atom, Field, Button, Modal, Toast), `design-product-detail-page` (where the section sits), `design-account-area` (account shell) |
| Generated templates that apply | none (this spec is hand-written for this project) |
| Skills | `[SKILL: commercetools-platform]` (Reviews API, states), `[SKILL: commercetools-storefront]` (BFF, ownership checks) |
| Docs | https://docs.commercetools.com/guides/review-ratings, https://docs.commercetools.com/api/projects/reviews |
| Owner prerequisites (lead numbers the rows) | `OA-M-a` decision to give the storefront API client the scope that Review writes need (`manage_products`, see Design 3.4; there is no narrower review scope) or to provide a second, restricted client (Q-M-02). `SO-M-a` wording sign-off. There is no moderation (D-037). Live runs need the owner's API clients in `storefront/.env.local` (OA-01) |

## 2. Goal and scope

**Goal.** Shoppers read reviews sorted by newest, highest or lowest, signed-in customers write one review per product, new reviews are published at once and count in the statistics immediately (no moderation, D-037), and customers manage their own reviews in the account. Every number shown comes from commercetools (`reviewRatingStatistics` and the Reviews API), so what a shopper sees equals what is in the Merchant Center.

**In scope**
- `components/reviews/ReviewsSection` (list with sort and "Show more", write form, call to action states) mounted in the `#reviews` section that workstream H built, and `REVIEWS_ENABLED` switched on.
- The customer's **Reviews** tab in the account (replaces L's stub): list, edit, delete.
- Handlers `/api/reviews` (GET list and own, POST), `/api/reviews/[id]` (PATCH, DELETE).
- No moderation (D-037): a review is created without a state, so it is included in statistics at once. No review states, no pending or approved tags.
- Verified purchase mark (set at write time from the customer's orders).
- Safety: escaping, server length limits, rate limits, no emails shown.
- Verification that the card rating, "No reviews" state, listing filter and sort (built in G and H) show the right numbers; a refresh of the indexed rating attribute only if G needed the fallback.

**Out of scope**
- Seeding the review states and the seeded reviews (workstream B and C; M only reads them and verifies).
- The rating summary and distribution chart on the product page (H's `RatingSummary`); the card rating and listing filter (G). M verifies them, does not rebuild them.
- Review photos, helpful votes, replies, translation of reviews, review of channels (stores), email notifications, any moderation screen or state (D-037).

## 3. Design

### 3.1 Files

| File | Purpose |
| --- | --- |
| `lib/reviews/validate.ts` | Pure: `validateReviewInput`, `sanitizeText`, `authorName(first, last)` |
| `lib/ct/reviews.ts` | Server only: all Reviews API calls |
| `lib/mappers/review.ts` | `toReviewView`, `toMyReviewView` |
| `lib/shop-config.ts` | Set `REVIEWS_ENABLED` (H's flag) to `true` |
| `app/api/reviews/route.ts` | GET (list or own), POST |
| `app/api/reviews/[id]/route.ts` | PATCH, DELETE |
| `hooks/useReviews.ts` (SWR infinite), `hooks/useMyReviews.ts`, `hooks/useReviewActions.ts` | Client hooks |
| `components/reviews/ReviewsSection.tsx` | Mount point H imports; props below |
| `components/reviews/ReviewList.tsx`, `ReviewItem.tsx`, `SortSelect.tsx`, `WriteReviewCta.tsx`, `ReviewForm.tsx`, `StarInput.tsx`, `FieldCounter.tsx`, `MyReviews.tsx`, `MyReviewCard.tsx`, `DeleteReviewDialog.tsx` | UI |
| `app/[locale]/account/(shell)/reviews/page.tsx` | Replaces L's stub; renders `MyReviews` |
| `lib/cache-keys.ts` | Uses D's `keyReviews(productId, sort, page)` and `keyMyReviews(customerId)`; append nothing unless a key is missing |
| `seed/src/...` | Custom type `mcf-review` (M-02) |
| `messages/*.json` | Namespace `reviews` (3.9) |

`ReviewsSection` props (H calls it; M-00 reads H's call site and makes both agree): `{ productId: string; productSlug: string; sku: string; productName: string; stats: RatingStats | null }`. It renders **below** H's `RatingSummary` (which already shows average, count and the 5 to 1 distribution), starting with the sort select and the list.

### 3.2 Visual design (no VELA screen exists for reviews; derive from atoms and the PDP)

Reviews are not in the prototype (`design.md` section 6 lists what is not designed). Use the `Rating` atom, `Card`, `Field`, `Button`, `Chip`, `Badge`, `Modal` and `Toast` of `design-tokens-and-components`; tokens only; no emoji. Visual sign-off is `SO-M-a`.

- **Section** (inside H's `<section id="reviews">`): H2 "Reviews" (Archivo 700, 24px), after H's summary a row with the sort select at the right (`select`, 10px radius, label "Sort by" visually shown at 12.5px), and `WriteReviewCta` at the left.
- **`ReviewItem`**: no card border, hairline `--line` between items, 20px vertical padding. Row 1: `Rating` stars (filled in `--accent`? use the `Rating` atom's own colour) and the title (Archivo 600, 16px). Row 2: author name and date (12.5px `--ink-3`, date formatted with `Intl.DateTimeFormat` in the session locale), the "Verified purchase" `Badge` (teal-tint, 10px uppercase, check icon `aria-hidden`) when `verifiedPurchase`. Body text 15px/1.55 `--ink`, `white-space: pre-line`, `overflow-wrap: anywhere`, rendered as plain React text only.
- **`ReviewList`**: five items per page, then a ghost "Show more" button (disabled with "Loading…" while fetching, hidden when all are shown); after loading more, focus moves to the first new item (`tabIndex={-1}`) and an `aria-live="polite"` region announces "5 more reviews loaded". Empty (no published reviews): the text "No reviews yet" with "Be the first to review" (the product page's `Rating` summary shows no stars in that case, H).
- **`WriteReviewCta`** states: guest: a sentence "Sign in to write a review" and a link button to `/account/sign-in?redirect=/p/<slug>/<sku>#write-review` (the value J's `safeRedirect` accepts, with the fragment URL-encoded in the query); signed in, not reviewed: ink button "Write a review" (opens the form inline below, `aria-expanded`, `aria-controls`); signed in and reviewed: text "You reviewed this product on {date}" and a ghost "Edit your review".
- **`ReviewForm`** (inline `Card`, 24px padding; the same component in a `Modal` for edits in the account): `StarInput` (5 buttons in a `role="radiogroup"` labelled "Your rating", each 40px target, `role="radio"` `aria-checked`, `aria-label` "{n} stars", roving tabindex, arrow keys, hover and focus preview, required), "Title" input (optional, counter "{n}/80"), "Your review" textarea (optional, 5 rows, counter "{n}/2000"), a muted line "Posted as {authorName}", buttons "Submit review" (ink) and "Cancel" (ghost). States: `idle`, `submitting` (button disabled, `aria-busy`), `published` ("Thanks, your review is live. The average updates shortly"), `error` (`role="alert"`, keeps the entries), `rateLimited`, `alreadyReviewed` (switches to edit mode). Missing rating: the rating control shows the error "Choose a rating" beside it, focus moves to it, nothing is sent.
- **`MyReviewCard`** (account): thumbnail 52x62 (G's image transform), product name link, `Rating`, title, text (clamped to 3 lines with "Show more"), date, buttons "Edit" and "Delete".
- **Responsive**: the sort select and CTA stack under 520px; form fields full width; 44px targets; no horizontal scroll at 375px.
- **Accessibility**: heading order (H2 section, H3 only for the form title), the list is a `ul`; stars are always accompanied by text "{n} out of 5"; error messages tied to fields with `aria-describedby`; counters are `aria-live="off"` (announced on blur only) to avoid noise; the verified badge has visible text.

### 3.3 Data contracts (add to `lib/types.ts`)

```
type ReviewSort = 'newest' | 'highest' | 'lowest'
type ReviewView = { id: string; rating: 1|2|3|4|5; title: string | null; text: string | null; authorName: string; createdAt: string; locale: string | null; verifiedPurchase: boolean }
type MyReviewView = ReviewView & { version: number; product: { id: string; name: string; slug: string; sku: string | null; imageUrl: string | null } | null }
type ReviewPage = { reviews: ReviewView[]; total: number; page: number; pageSize: 5; hasMore: boolean }
type ReviewInput = { rating: number; title?: string; text?: string }
```

Handlers (all wrapped in D's `handle(route, fn)`, `dynamic = 'force-dynamic'`; domain codes through J's `domainError`; D's `rate_limited` through `jsonError`; never the commercetools body; never an email or customer id in a response):

| Handler | Request | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/reviews?productId=<id>&sort=newest\|highest\|lowest&page=<n>` | public, no session needed | `200 ReviewPage` (published reviews only, 5 per page) plus `mine: { id: string } \| null` when a customer session exists | `400 bad_request` (missing or malformed `productId`, page below 0 or above 200, unknown sort) |
| `GET /api/reviews?mine=1` | session | `200 { reviews: MyReviewView[] }` newest first | `401 unauthorized` |
| `POST /api/reviews` | `{ productId: string, rating: number, title?: string, text?: string }` | `201 { review: MyReviewView }` | `401 unauthorized`, `422 validation_failed` with `fields` (`rating_required`, `rating_invalid`, `title_too_long`, `text_too_long`), `404 not_found` (unknown or unpublished product), `409 already_reviewed` with `{ reviewId }`, `429 rate_limited` |
| `PATCH /api/reviews/[id]` | `{ rating?: number, title?: string, text?: string }` (at least one) | `200 { review: MyReviewView }` | `401`, `404 not_found` (foreign and unknown identical), `422`, `429` |
| `DELETE /api/reviews/[id]` | none | `200 { ok: true }` | `401`, `404 not_found`, `429` |

The product id is validated by pattern (UUID) before any predicate is built; user text never enters a predicate. Customer id comes only from the session.

### 3.4 Exact commercetools calls (`lib/ct/reviews.ts`, server only)

Load `[SKILL: commercetools-platform]` and `[SKILL: commercetools-storefront]`; confirm each call with `scripts/docs-search.mjs` or the Knowledge MCP (the `Review` and `ReviewDraft` types with `oas` schema name `api-Review-write`) before coding, and record differences in `plans/PROJECT-FINDINGS.md`. Updates use D's `updateWithRetry`.

**Scopes.** Reading reviews needs `view_products`; creating, updating and deleting needs `manage_products` (https://docs.commercetools.com/api/scopes#manage_products; there is no narrower review scope). That is broader than the storefront's usual least privilege, so it is an owner decision (`OA-M-a`, Q-M-02). Because every write checks the session customer and the review's `customer.id` in code, the exposure is the server's own credentials. Default: use the storefront client with the scope added.

**List published reviews** (`listProductReviews({ productId, sort, page })`): `apiRoot.reviews().get({ queryArgs: { where: 'target(typeId="product" and id=:id) and includedInStatistics=true', 'var.id': productId, sort: <see table>, limit: 5, offset: page * 5, withTotal: true } })`. Docs https://docs.commercetools.com/guides/review-ratings#display-all-reviews-of-one-product.

| `sort` | `queryArgs.sort` |
| --- | --- |
| `newest` | `['createdAt desc']` |
| `highest` | `['rating desc', 'createdAt desc']` |
| `lowest` | `['rating asc', 'createdAt desc']` |

`includedInStatistics=true` is the public filter (a review with a rating and no state is included at once; there is no pending state, D-037). The ratings distribution above the list is H's `RatingSummary` from `reviewRatingStatistics.ratingsDistribution` (keys `1` to `5`; a missing key means zero reviews of that rating).

**Own reviews** (`listMyReviews(customerId)`): `apiRoot.reviews().get({ queryArgs: { where: 'customer(id=:c)', 'var.c': customerId, sort: ['createdAt desc'], limit: 100 } })`. Product name, slug and image come from G's product read for the distinct product ids (one call), not from expanding `target`.

**Existing review for this customer and product** (`findMyReview(customerId, productId)`): same endpoint with `where: 'customer(id=:c) and target(typeId="product" and id=:p)'`, `limit: 1`.

**Create** (`createReview(...)`): `apiRoot.reviews().post({ body: { key: 'rev-<8 random chars>-<yyyymmddhhmmss>', uniquenessValue: '<customerId>:<productId>', locale: <session locale>, authorName: authorName(first, last), title, text, rating, target: { typeId: 'product', id: productId }, customer: { typeId: 'customer', id: customerId }, custom: { type: { typeId: 'type', key: 'mcf-review' }, fields: { verifiedPurchase, orderNumber? } } } })`. `rating` is the star count 1 to 5 (the API accepts -100 to 100; the project uses stars, per the guide). `uniquenessValue` makes a second review by the same customer for the same product fail with a `DuplicateField` error, which maps to `409 already_reviewed`; confirm the field name and behaviour in M-03 against the installed SDK type `ReviewDraft` and note the result in findings (if it is not available, rely on the `findMyReview` check done just before, and say that the race is not closed). Docs https://docs.commercetools.com/api/projects/reviews#create-review.  The review has no state, so it counts in the statistics at once.

**Verified purchase** (`hasPurchased(customerId, productId)`): `apiRoot.orders().get({ queryArgs: { where: 'customerId=:c and lineItems(productId=:p)', 'var.c': customerId, 'var.p': productId, limit: 1 } })`; when found set `custom.fields.verifiedPurchase = true` and `orderNumber`. This is evaluated at write time only (Review has no order link; seeded reviews have none, Q-C-04 in the seed plan, so they show no badge).

**Update** (`updateReview(id, customerId, patch)`): read the review (`apiRoot.reviews().withId({ ID }).get({})`), check `review.customer?.id === customerId` (else 404), then `apiRoot.reviews().withId({ ID }).post({ body: { version, actions } })` with only the changed ones of `{ action: 'setRating', rating }`, `{ action: 'setTitle', title }`, `{ action: 'setText', text }`. No state action is ever sent: an edit is published at once. Docs https://docs.commercetools.com/api/projects/reviews#update-actions.

**Delete** (`deleteReview(id, customerId)`): same ownership read, then `apiRoot.reviews().withId({ ID }).delete({ queryArgs: { version } })`. Statistics update after eventual consistency.

**Statistics.** `reviewRatingStatistics` on the product (`averageRating` rounded to 5 decimals by the platform, `count`, `ratingsDistribution`) is read by G's and H's mappers; M never writes or computes it. After a change that moves statistics (a review created, edited or deleted) M calls `revalidateTag` for any product tag that H uses (name from H's plan, if H caches product reads; if H does not cache them nothing is needed).

### 3.5 Validation (`lib/reviews/validate.ts`, pure, used by form and handlers)

| Field | Rule | Codes |
| --- | --- | --- |
| rating | integer 1 to 5, required | `rating_required`, `rating_invalid` |
| title | optional, trimmed, up to 80 characters | `title_too_long` |
| text | optional, trimmed, up to 2000 characters | `text_too_long` |
| (whole) | at least a rating | |
| productId | UUID pattern | `bad_request` |

`sanitizeText` removes control characters except newline and tab, normalises `\r\n` to `\n`, collapses three or more blank lines to two, and trims; it does **not** strip or escape markup (React renders text as text; no `dangerouslySetInnerHTML` anywhere, a lint rule or test asserts it). Length is limited by the handler even when the form already limits it (`maxLength` attributes are a convenience). `authorName(first, last)`: first name (up to 30 characters, controls removed) plus a space and the first letter of the last name followed by a dot, for example "Maya O."; a missing last name gives the first name only; never the email.

### 3.6 Behaviour rules

- **One review per product per customer.** `GET /api/reviews` returns `mine` for a signed-in customer; the form is replaced by the "You reviewed this product" state and the edit form. The server enforces it with `uniquenessValue` and the pre-check.
- **No moderation (D-037)**: a created review has no state, is included in statistics and in the public list at once; the author sees "Thanks, your review is live". Seeded reviews are likewise published.
- **Guests** see the sign-in prompt; after sign-in J's `safeRedirect` returns them to `/p/<slug>/<sku>#write-review`, where the form opens automatically when the hash is `#write-review` and the customer has no review.
- **Rate limits** (J's `lib/rate-limit.ts`): create 5 per hour per customer; update and delete 30 per hour per customer; answered with D's `rate_limited` (429); the form keeps the entries and shows the message.
- **Edits are live at once.** After editing, the author sees "Your changes are live"; the new text replaces the old in the public list and statistics follow.
- **Own reviews** list every review of the customer, all published.
- **Escape on render, limit on the server, no emails** (spec "Safety"): the response mapper has no email and no customer id fields (tested by key list).
- **Stale data.** Lists use SWR with `revalidateOnFocus: false`; after a create, edit or delete the affected keys are revalidated (`keyReviews(productId, sort, 0)` to the first page and `keyMyReviews(customerId)`); the product's rating summary refreshes on the next navigation (statistics are eventually consistent; the UI says "the average updates shortly").
- **Language.** Reviews are shown in whatever language they were written in (the `locale` stored with each), with no filter or translation (Q-M-05).
- **Seeded review keys** are `mcf-review-<sku>-<n>` (seed); review keys created by this workstream are `rev-...` and are not seed data (the lead's cleanup manifest lists test reviews, D-019).

### 3.7 Session fields

Reads `customerId`, `customerFirstName`, `customerLastName`, `locale`. Writes none.

### 3.8 Caching

No server caching of review lists or own reviews (they change on every write and are per person for `mine`). SWR keys from D: `keyReviews(productId, sort, page)` (one per page, `useSWRInfinite` pages share the tuple shape) and `keyMyReviews(customerId)`; the customer id is in the own-reviews key. The public list is fetched client-side; the section is below the fold and its absence does not affect the page's first render. The product page's rating summary is H's server render from the product read.

### 3.9 i18n keys (namespace `reviews`; en-CA equals en-US)

| Key | en-US |
| --- | --- |
| `title` / `sortBy` / `sort.newest` / `sort.highest` / `sort.lowest` | Reviews / Sort by / Newest / Highest rated / Lowest rated |
| `empty` / `beFirst` | No reviews yet. / Be the first to review |
| `showMore` / `loading` / `moreLoaded` | Show more / Loading… / {count} more reviews loaded |
| `item.stars` / `item.verified` / `item.by` | {rating} out of 5 / Verified purchase / by {name} |
| `cta.signIn` / `cta.signInLink` / `cta.write` / `cta.reviewed` / `cta.edit` | Sign in to write a review. / Sign in / Write a review / You reviewed this product on {date}. / Edit your review |
| `form.title` / `form.rating` / `form.ratingError` / `form.reviewTitle` / `form.text` / `form.postedAs` / `form.submit` / `form.cancel` / `form.save` | Write a review / Your rating / Choose a rating / Title (optional) / Your review (optional) / Posted as {name} / Submit review / Cancel / Save changes |
| `form.star` / `form.count` | {n} stars / {n}/{max} |
| `form.published` / `form.edited` / `form.error` / `form.rateLimited` | Thanks, your review is live. The average updates shortly. / Your changes are live. / We could not save your review. Please try again. / You have posted a lot of reviews. Please try again later. |
| `errors.rating_required` / `rating_invalid` / `title_too_long` / `text_too_long` | Choose a rating. / Choose between 1 and 5 stars. / The title can have at most 80 characters. / The review can have at most 2000 characters. |
| `mine.title` / `mine.empty` / `mine.edit` / `mine.delete` / `mine.deleteTitle` / `mine.deleteText` / `mine.deleteConfirm` / `mine.deleted` | Your reviews / You have not written any reviews yet. / Edit / Delete / Delete this review? / This cannot be undone. / Delete review / Review deleted. |

## 4. Tasks

Branch `ws/m-reviews-and-ratings`. Commit `ws-m: M-nn summary`. Each task is under half a day. Run `npm run check` before ticking; `npm run build` before the last task. Tests call handlers with `new Request(...)` and mock `lib/ct/*`.

- [ ] **M-00 Preconditions and paths.** H and J are `Done` in `STATUS.md`. Grep and write to `plans/evidence/M/paths.md`: H's `ReviewsSlot` and its call of `ReviewsSection` (props), H's `RatingSummary` and its distribution chart, the `REVIEWS_ENABLED` flag, G's rating mapper and the finding G recorded about filtering and sorting by rating (and the fallback attribute name, if G needed one), J's `domainError`, `rate-limit`, `safeRedirect`, `useAccount`, L's Reviews stub path, D's `keyReviews` and `keyMyReviews`. Read a seeded review with the seed `verify` output (there are no review states, D-037). No code.
- [ ] **M-01 Types, validation, author name (pure).** Files: `lib/types.ts` additions, `lib/reviews/validate.ts`, tests. Tests: `Missing rating`, `Rating outside 1 to 5 is refused`, `Title of 81 characters is refused`, `Text of 2001 characters is refused`, `Text keeps markup unchanged`, `Control characters are removed`, `Author name is first name and last initial`, `Author name never contains an email`, `Product id must be a UUID`.
- [ ] **M-02 Seed: review custom type.** `[SKILL: commercetools-platform]`. Files: `seed/src/...` (add custom type `mcf-review`, resource type `review`, boolean `verifiedPurchase`, string `orderNumber`, in the same place and pattern as the other `mcf-` custom types; idempotent, `--dry-run`, refuses a foreign project key). There are no review states and no approval tool (D-037). Run it against the project `spec-test-b2c-food`. Tests: `second run reports 0 changes`, `seed refuses a foreign project key`.
- [ ] **M-03 Reviews module and mappers.** `[SKILL: commercetools-platform]`. Files: `lib/ct/reviews.ts`, `lib/mappers/review.ts`, tests with a mocked `apiRoot`. Before coding, confirm in the installed SDK types: `ReviewDraft` fields (`uniquenessValue`, `authorName`, `locale`, `customer`, `custom`) and write the facts to `plans/PROJECT-FINDINGS.md`, including that a review created with no `state` is `includedInStatistics: true` at once. Tests: `Sorted` (query args for `lowest` are `rating asc` then `createdAt desc`, and for `highest`/`newest` likewise), `Public list uses includedInStatistics` (every public query carries `includedInStatistics=true`, which excludes only reviews without a rating), `Page offsets are page times five`, `Product id is a variable not concatenated`, `New review is published at once` (create sends no `state`, and the author name), `Created review carries no state`, `Create uses uniquenessValue of customer and product`, `Duplicate becomes already_reviewed`, `Edit` (setRating, setTitle, setText only for changed fields; no state action is ever sent), `Foreign review is 404 for update and delete`, `Verified purchase is set from the orders query`, `Mapper has no email and no customer id fields` (asserts the exact key list), `Public list uses includedInStatistics`.
- [ ] **M-04 Handlers.** `[SKILL: commercetools-storefront]`. Files: `app/api/reviews/route.ts`, `app/api/reviews/[id]/route.ts`, tests. Tests: `Valid review` (201, published at once), `Duplicate` (409 with the existing review id; the GET marks `mine`), `Missing rating` (422 with `rating_required`, no commercetools call), `Rate limit on create` (6th in an hour is 429), `Unauthenticated write returns 401 with no detail`, `Review for an unknown product is 404`, `Public list works without a session`, `Own list needs a session`, `Handlers return no commercetools body on 5xx`, `Two customers cannot edit or delete each other's review`, `Customer id in the body is ignored`.
- [ ] **M-05 Hooks.** Files: `hooks/useReviews.ts` (`useSWRInfinite`, pages of 5, key `keyReviews`), `hooks/useMyReviews.ts`, `hooks/useReviewActions.ts` (`create`, `update`, `remove`; revalidate the first page and `keyMyReviews`), tests. Tests: `Show more appends the next page`, `Changing the sort resets to the first page`, `A created review revalidates the list and my reviews`, `Hooks return safe defaults on error`.
- [ ] **M-06 List UI.** Files: `components/reviews/ReviewItem.tsx`, `ReviewList.tsx`, `SortSelect.tsx`, messages. Tests: `Sorted` (choosing "Lowest" puts the 1-star review first in the rendered list), `Markup in text` (`<script>` appears as visible text, no element is created), `Verified purchase badge shows only when set`, `Empty list shows Be the first to review`, `Show more is hidden at the end`, `Focus moves to the first new item after Show more`, `Dates use the session locale`.
- [ ] **M-07 Write UI and section mount.** Files: `components/reviews/StarInput.tsx`, `FieldCounter.tsx`, `ReviewForm.tsx`, `WriteReviewCta.tsx`, `ReviewsSection.tsx`, H's slot (`REVIEWS_ENABLED` to `true`, adapt the call or the props so they agree), messages. Tests: `Valid review` (submit calls create and shows the published message), `Missing rating` (error beside the rating control, focus on it, nothing sent), `Duplicate` (the form is replaced by the edit state), `New review is published at once` (confirmation text), `Guests are asked to sign in and return` (link carries the redirect with `#write-review`), `Star input is keyboard operable`, `Counters stop at the limits`, `Edit prefills and shows the changes-live message`, `Form keeps entries on error`.
- [ ] **M-08 Account Reviews tab.** Files: `app/[locale]/account/(shell)/reviews/page.tsx` (replaces L's stub), `MyReviews.tsx`, `MyReviewCard.tsx`, `DeleteReviewDialog.tsx`, tests. Tests: `Own reviews have no pending tag`, `Edit` (an edited review stays published), `Delete asks for confirmation and removes the card`, `Empty state`, `Reviews panel failure does not hide the other account panels`.
- [ ] **M-09 Rating refresh (conditional).** Only if G's recorded finding says Product Search cannot filter or sort on `reviewRatingStatistics` and G built the fallback (an indexed number attribute written by the seed). Then add `seed/src/scripts/sync-ratings.ts` (`npm run seed:ratings`, `--dry-run`, refuses a foreign project key) that writes each product's current average into that attribute (name and write path from G's finding; remember a product attribute change needs the staged data published), and note in `plans/notes/todo-M.md` that the script is re-run after new reviews. Otherwise tick as "not needed" with a one-line reason. Tests (if built): `Ratings sync writes the platform average`, `Ratings sync is idempotent`, `foreign project key refused`.
- [ ] **M-10 Catalogue parity.** Test `Catalogues have the same keys` for namespace `reviews` (`en-US`, `en-CA`).
- [ ] **M-11 Browser run, evidence, hand-off.** Run sections 6 and 7; `npm run build`; add todo and question rows; set `Ready for review`.

## 5. Scenarios checklist

Tick only with the named test or recorded evidence.

- [ ] Card rating (12 reviews averaging 4.58333 shows 4.6 and 12 reviews): G's `Card rating shows 4.6 and 12 reviews` (`product-summary.test.ts`); M re-checks in the browser (step R1)
- [ ] No reviews: G's `No reviews hides the rating` and H's `no reviews offers Be the first to review`; M: `Empty list shows Be the first to review` (M-06) and R2
- [ ] Filter (4.5 and up): G's `rating facet and filter` test in `build.test.ts`; M re-checks in the browser with real reviews (R3)
- [ ] Sorted: `Sorted` (M-03 query args, M-06 rendered order); browser R5
- [ ] Every public list query counts only reviews included in statistics: `Public list uses includedInStatistics` (M-03)
- [ ] Valid review: `Valid review` (M-04, M-07); browser R6
- [ ] Duplicate: `Duplicate` (M-04, M-07); browser R8
- [ ] Missing rating: `Missing rating` (M-01, M-04, M-07); browser R9
- [ ] New review published at once: `New review is published at once` (M-03, M-07); browser R6, R7
- [ ] No pending state: `Created review carries no state` (M-03), `Own reviews have no pending tag` (M-08); browser R7
- [ ] Edit: `Edit` (M-03, M-08); browser R10
- [ ] Statistics match (seed): C's `verify` check; M runs `cd seed && npm run verify` and records the output in evidence (R4)
- [ ] Markup in text: `Markup in text` (M-06); browser R11

## 6. Browser recipe (Chrome DevTools MCP)

Prerequisites: `npm run dev`, live credentials (`storefront/.env.local`), the seed with reviews, `OA-M-a` done (write scope). Use two QA customers registered through J (`qa-m-<date>-1@example.com`, `-2@`, synthetic passwords; registration is verified automatically). Product pages are `/en-US/p/<slug>/<sku>`; use one seeded product with 12 or so reviews, and one of the three seeded products with none. Evidence in `plans/evidence/M/<step>-<what>-<375|1440>.png`. For every step: snapshot, console without errors, network without failed requests (deliberate 4xx named only).

| Step | Do | Expect |
| --- | --- | --- |
| R1 | Open a listing page, find a product with reviews | Card shows the rating rounded to one decimal and the count; read the same product with the MCP (`reviewRatingStatistics`) and compare the numbers |
| R2 | Open a product with no reviews (card, then page) | Card has no stars; page says "No reviews yet" and "Be the first to review" |
| R3 | Listing, rating filter "4.5 and up", then "4.0 and up", sort "Top rated" | Every remaining card has an average at or above the threshold (compare against MCP data); order is descending |
| R4 | `cd seed && npm run verify` | Passes (statistics equal the seeded review counts); save the output |
| R5 | Product page at 1440 and 375: list, sort "Newest" then "Highest rated" then "Lowest rated" | Order changes accordingly (compare ratings in the DOM); 5 reviews then "Show more" adds 5; focus moves to the first new item |
| R6 | Signed in as customer 1: "Write a review", submit rating 4 with a short text | Confirmation "Thanks, your review is live"; the review is in the public list at once; after a few seconds the product count increases by one and the average updates (compare with the MCP); the review in commercetools has `includedInStatistics` true and no state (read back) |
| R7 | Reload the page, then open it in a second private window | Both show the review in the list; customer 1 sees "You reviewed this product" with no Pending tag; there is no pending state anywhere |
| R8 | Customer 1 opens the form again | Offered "Edit your review" instead of a second form; a second `POST` made from the console returns 409 |
| R9 | Submit with no rating | Error beside the rating control, focus on it, no `POST` in the network list |
| R10 | Customer 1: edit the text of the review (account Reviews tab or the product page) | Message "Your changes are live"; the list shows the new text at once; the review never leaves the public list |
| R11 | Create a review whose text is `<script>alert(1)</script> <b>x</b>` | Shown as plain text in the list; no dialog, no bold element |
| R12 | Customer 2 (guest first): open the page signed out, click "Sign in", sign in | Back on the same product at `#write-review`, form open |
| R13 | Account, Reviews tab (customer 1): list, delete with confirmation | Card removed; read back shows the review gone and the statistics decreased by one |
| R14 | Post 6 reviews quickly with customer 2 on different products (or loop `fetch` in `evaluate_script`) | The 6th within the hour answers 429 and the form shows the rate-limit text (use this only against the QA customer) |
| R15 | Open `/en-CA` product page of the same product | Same English copy and the same reviews; dates in the Canadian English format |
| R16 | Tab through the section; check `GET /api/reviews` in the network panel | Visible focus ring everywhere; stars arrow-key operable; sort select reachable; no email address and no customer id in any field |

## 7. Self-verification with data

No owner involvement.
- Read back with the commercetools MCP `food-service` or a read-only script (keys, ids, counts only): the review's `includedInStatistics` (true at once), `rating`, `uniquenessValue`, `custom.fields.verifiedPurchase` (set for a customer who has an order containing the product: place one through K for the QA customer, then review that product), and the product's `reviewRatingStatistics` before and after each step R6, R9, R12. Save as `plans/evidence/M/readbacks.json`.
- Compare public list totals with `reviews().get` counts using the same predicate.
- Verify the rate limit and the ownership checks at the API level with `evaluate_script` fetches (foreign review id gives 404 and the identical body as an unknown id).
- Verify no `dangerouslySetInnerHTML` exists in `components/reviews` (`grep`; save "0 matches").
- `cd seed && npm run check` and `npm run verify` pass; the `mcf-review` type seed second run reports `0 change(s)`.
- Test reviews created by this workstream are listed (keys only) in `plans/evidence/M/test-reviews.txt` for the lead's cleanup manifest (D-019).
- Write `plans/evidence/M/README.md`.

## 8. Manual testing and owner items

Same rows are in `plans/notes/todo-M.md`.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-M-a | Owner | Before the live runs of M-03 to M-08 | 1. Decide Q-M-02. 2. Either add `manage_products` to the storefront API client scopes (`storefront/.env.local`), or provide a second restricted client and tell the team the env variable names (values only in `.env.local`). | Review writes succeed live; decision recorded | TODO |
| SO-M-a | Owner | Before release | 1. Read the review section and the messages at 375 and 1440 px. 2. Approve or change the wording (these screens are not in the VELA design). | Copy approved | TODO |
| M-M-01 | Owner | Before release | 1. On a real phone write a review with the on-screen keyboard. 2. Tap the stars. | Stars are easy to tap, keyboard does not hide the counter or submit button | TODO |
| M-M-02 | Owner | Only if M-09 was built | 1. After new reviews are posted, run `npm run seed:ratings` (or ask the team to). 2. Check the listing rating filter. | Filter reflects the new averages | TODO |

Removed by D-037 (no moderation): the former approval-in-the-Merchant-Center manual test and the moderation-policy decision.

## 9. Questions

Each is also in `plans/notes/questions-M.md` (format `Q-M-n | question | default | blocks? | Open`). The default is built.

| ID | Question | Default built | Blocks? |
| --- | --- | --- | --- |
| Q-M-01 | Do new customer reviews need approval before they count? | Removed by D-037: no moderation. A review is published on creation and included in statistics at once; no pending state. | No |
| Q-M-02 | The storefront API client needs `manage_products` to write reviews (no narrower scope exists). Accept, or provide a second restricted client? | Add the scope to the storefront client (`OA-M-a`); ownership is checked in code. | Blocks live write tests only |
| Q-M-03 | Is the text required, or is a rating alone a valid review? | Rating required; title and text optional. | No |
| Q-M-04 | Can a customer who never bought the product review it? | Yes; a "Verified purchase" badge is set only when the customer has an order with the product (checked at write time). | No |
| Q-M-05 | Show reviews of every language in every locale? | Yes, as written, no filter, no translation. | No |
| Q-M-06 | Edit of a published review: does it need approval again? | No (D-037): the edit is published at once; statistics update. | No |
| Q-M-07 | Delete by the author: allowed for any own review? | Yes (spec lists delete). | No |
| Q-M-08 | Rate limits? | 5 creates per hour, 30 edits or deletes per hour, per customer; in memory per instance (J's limiter, Q-J-12). | No |
| Q-M-09 | How is the one-review-per-product rule enforced? | `uniquenessValue` of customer id and product id, plus a pre-check; M-03 confirms the field. | No |
| Q-M-10 | Seeded reviews have no verified purchase (no orders in the seed). Add a custom field value to some seed reviews? | No; seed plan Q-C-04 stays. | No |
| Q-M-11 | If Product Search cannot filter or sort on rating statistics, who refreshes the indexed rating attribute after new reviews are posted? | G's fallback attribute is refreshed by `seed:ratings` (M-09) run by the team or owner; a subscription-driven refresh is not built. | No |

## 10. Definition of done

- All tasks ticked, each with a passing `check` commit; `npm run build` passes.
- Every scenario of section 5 ticked with a named test or recorded evidence; the G and H owned ones re-verified in the browser.
- Browser recipe R1 to R16 verified at 375 and 1440 px (and one `/en-CA` product page), console and network clean, evidence and `README.md` in `plans/evidence/M/`.
- Section 7 read-backs saved; no email or customer id in any review response; no `dangerouslySetInnerHTML`.
- `PROJECT-FINDINGS.md` has the M-03 findings (`ReviewDraft` fields, `uniquenessValue`, a review created with no state counting at once, scopes).
- `REVIEWS_ENABLED` is `true` and H's slot renders `ReviewsSection`.
- Owner rows in `plans/notes/todo-M.md`; questions in `plans/notes/questions-M.md`.
- No `TODO` or `FIXME` without an `IDEAS.md` entry; `node plans/verify-plan.mjs` passes; `STATUS.md` shows `Ready for review`.

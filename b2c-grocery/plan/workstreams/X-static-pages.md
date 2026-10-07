# X — Static pages

**Specs:** `grocery-storefront-features` → `static-pages-design` (all); existing behavior `about-us`, `faq`, `policy-pages`, `contact-us`, `blog-resources`, `error-pages`
**Depends on:** D, G, H, K · **Unblocks:** Y · **Decisions:** D-039 · **Sign-off:** SO-10

## Goal
About, FAQ, policies, Journal (one article) and Contact (stub submit) pages in both locales.

## Design
- Content in `content/<locale>/*.md` (markdown with front matter `title`, `description`) read by `lib/content.ts` (`getPage(slug, locale)`; parse with a tiny in-repo front-matter + markdown-to-HTML using `marked`; sanitize with `isomorphic-dompurify`? **No new sanitizer**: markdown is repo-authored, trusted; escape nothing special; never render user input through it). New dep `marked` (justify in commit).
  Slugs: `about`, `faq`, `journal`, `policies/delivery`, `policies/returns`, `policies/privacy`, `policies/terms`.
- Routes (Server; rendered dynamically because layouts read the market cookie; `next.config.ts` sets `outputFileTracingIncludes: { '/**': ['./content/**/*'] }` so Netlify bundles the markdown): `app/[locale]/about/page.tsx`, `faq/page.tsx`, `journal/page.tsx`, `policies/[slug]/page.tsx` (`generateStaticParams`, unknown slug → `notFound()`), all with `generateMetadata` from front matter. Layout: kicker, H1, body column max 720 px (16 px/1.75, 78% text).
- FAQ: markdown `## Topic` headings with `### Question` + answer paragraphs, parsed into `{ topic, items: { q, a }[] }[]` by `lib/faq.ts` and rendered by `FaqList` **(client)** as disclosure buttons (`aria-expanded`, `aria-controls`, one open at a time).
- Journal: the editorial layout (sticky left title column, 1.4fr body) with the single article from `content/<locale>/journal.md` and a "Shop the story" 4-product grid (latest products).
- Contact `app/[locale]/contact/page.tsx` + `components/contact/ContactForm.tsx` **(client)**: fields name, email, topic (select: Order, Delivery, Product, Other), message (min 10, max 2000); `POST /api/contact` validates (`lib/contact-validation.ts` shared), logs `console.info('contact', { topic, length })` **without** name/email/message body (PII-free), responds `{ ok: true }`; page shows confirmation text that says the message was **received** (not "sent to a person"). Honeypot hidden field `website` — non-empty → silently `{ ok: true }` without logging.
- Footer links (H) point to these pages (verified).

## Tasks
- [x] X-01 Add `marked` and the `outputFileTracingIncludes` setting; write `lib/content.ts` + tests (reads both locales; missing page → null; front matter parsed; HTML produced).
- [x] X-02 Write content files for both locales (concise, grocery-appropriate placeholder text; mark in `plan/IDEAS.md` that copy needs owner review) and static routes + tests (title from front matter; unknown policy slug → `notFound`; `de-DE` serves German).
- [x] X-03 Write `lib/faq.ts` and `FaqList` + tests (grouped by topic; `aria-expanded` toggles; one open at a time; ids wired).
- [x] X-04 Write the Journal page + tests (layout columns; product grid fed by search call).
- [x] X-05 Write `lib/contact-validation.ts`, `POST /api/contact` (uses `rateLimit` from E-09 → 429), hook `hooks/useContact.ts`, `ContactForm` + tests (invalid email inline error; message too short; honeypot ignored; logs contain no PII; success message wording).
- [x] X-06 Messages (both locales); report manual tests M-X-1…M-X-3 and sign-off SO-10.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| German About page | X-02 |
| Toggle answer | X-03 |
| Valid submit / Invalid email | X-05 |
| No reviews (omitted) | L-07 |
| Contact strip link | M, X (href check) |

## Manual tests to report
- M-X-1: 1. Open `/en-US/about`, `/en-US/faq`, `/en-US/journal` and `/en-US/policies/delivery`, `/returns`, `/privacy`, `/terms`: each shows kicker, H1 and a text column no wider than 720 px (check at 1440 px and 390 px). 2. Repeat under `/de-DE/...`: German title and text. 3. Open `/en-US/policies/nope`: not-found page. 4. In the footer click About us, The journal, FAQ, Delivery, Contact us: each opens in the same locale. 5. FAQ: click a question, it expands; click another, the first closes; Tab then Enter/Space also work. 6. Journal at 1440 px: the title stays sticky on the left while the article scrolls; "Shop the story" shows 4 product tiles (2 per row at 390 px).
- M-X-2: 1. With `npm run dev` open `/en-US/contact`. 2. Submit empty: four inline "required" errors and no request in the Network tab. 3. Email `abc` and a 5-character message: inline errors, no request. 4. Valid name, email, topic Order, message of 20+ characters: heading "Message received" and text saying it was received (no claim that a person reads it). 5. The dev server terminal shows one line `contact { topic: 'order', length: N }` and no name, email or message text. 6. Submit 6 times within a minute: the 6th shows "Too many messages" (HTTP 429). 7. Repeat step 4 once on `/de-DE/contact`.
- M-X-3: Owner reviews the placeholder copy in `site/content/en-US` and `site/content/de-DE` (about, faq, journal, four policies) and the `static.*` message keys; legal pages need real legal text (SO-10, SO-13).

## Definition of done
All pages render in both locales; contact logging PII-free; `verify` passes; SO-10 requested.

## Implementation notes (deviations, recorded by the developer)
- `marked` ^18 added (small, maintained). `lib/content.ts` exports `getPage`, `parseFrontMatter`, `POLICY_SLUGS`; `getPage` rejects slugs/locales that do not match a strict pattern (no path traversal). Front matter also carries an optional `kicker` (localized, so no message keys are needed for the page kickers).
- Shared `components/content/ContentArticle.tsx` (`ContentArticle`, `Prose`). FAQ answers are plain text paragraphs (the client `FaqList` never imports `marked`); `lib/faq.ts` `parseFaq` drops topics without answered questions.
- Journal "Shop the story" uses `searchProducts({ sort: 'newest', pageSize: 4 })` with the market from the URL locale (like K, Q-K-1) in its own 4-column grid (not `ProductGrid`, which is 3 columns); a search failure omits the grid instead of failing the page.
- Contact: `lib/contact-validation.ts` returns error codes (`required|invalidEmail|tooShort|tooLong`), mapped to messages `static.contact.errors.*` on the client; the API answers `400 { error: 'VALIDATION', fields }`, `429 { error: 'RATE_LIMITED' }` with `Retry-After`. The honeypot is checked before the rate limit and validation. `useContact` is a plain state hook (a one-off POST, no SWR cache needed) over `sendJson`.
- Message keys live under `static.journal.*` and `static.contact.*` (both locales). The success text states the message was received and that a reply is not guaranteed.
- Footer (H) only links `/policies/delivery`; returns, privacy and terms are reachable by URL only (see `plan/IDEAS.md`). The homepage "Contact us" strip belongs to M.

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
- [ ] X-01 Add `marked` and the `outputFileTracingIncludes` setting; write `lib/content.ts` + tests (reads both locales; missing page → null; front matter parsed; HTML produced).
- [ ] X-02 Write content files for both locales (concise, grocery-appropriate placeholder text; mark in `plan/IDEAS.md` that copy needs owner review) and static routes + tests (title from front matter; unknown policy slug → `notFound`; `de-DE` serves German).
- [ ] X-03 Write `lib/faq.ts` and `FaqList` + tests (grouped by topic; `aria-expanded` toggles; one open at a time; ids wired).
- [ ] X-04 Write the Journal page + tests (layout columns; product grid fed by search call).
- [ ] X-05 Write `lib/contact-validation.ts`, `POST /api/contact` (uses `rateLimit` from E-09 → 429), hook `hooks/useContact.ts`, `ContactForm` + tests (invalid email inline error; message too short; honeypot ignored; logs contain no PII; success message wording).
- [ ] X-06 Messages (both locales); report manual tests M-X-1…M-X-3 and sign-off SO-10.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| German About page | X-02 |
| Toggle answer | X-03 |
| Valid submit / Invalid email | X-05 |
| No reviews (omitted) | L-07 |
| Contact strip link | M, X (href check) |

## Manual tests to report
- M-X-1: Visit About, FAQ, each policy, Journal in both locales; footer links work.
- M-X-2: Submit the contact form: confirmation shown; server log shows topic and length only.
- M-X-3: Owner reviews copy (SO-10, SO-13).

## Definition of done
All pages render in both locales; contact logging PII-free; `verify` passes; SO-10 requested.

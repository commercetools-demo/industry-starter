<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream P: Content pages and error pages

Read `plans/JUNIOR-GUIDE.md` first. Everything runs in `storefront/`. Dev URL assumed `http://localhost:3000`.

## 1. Header

| Field | Value |
| --- | --- |
| ID | P |
| Name | Content and error pages: about, contact, FAQ, policies, journal (blog), 404, 500, forbidden |
| Depends on | E (tokens, atoms), F (shell, footer, store picker, toast), and for the checks D (error shape), G (search route), H and L (not-found calls, account guard) which are `Done` by wave 10 |
| Wave | 10 (parallel with N and O) |
| Specs implemented (primary first) | `about-us` (primary), `contact-us`, `faq`, `policy-pages`, `blog-resources`, `error-pages`. All six are **generated templates written for a B2B or grocery seller**; none has a visual design in the VELA prototype (design.md section 6 item 8). The template adaptations are in D1. |
| Owner prerequisites | SO-01 (legal and policy text, existing), SO-P1 to SO-P5 (layout, copy, contact channels, consent decision, journal content), OA-P1 (receiver for contact and feedback, see section 8). The lead numbers the `-P` placeholders. |
| Skills | `commercetools-storefront` (`references/core/add-page.md`, `stack/nextjs/best-practices/error-handling.md`, `metadata.md`, `server-components.md`), `commercetools-platform` only where a page touches an API (it should not) |

## 2. Goal and scope

**Goal.** Every link in the footer and every dead end leads somewhere honest. Content pages are readable, indexable and keep working when commercetools is down. The contact form never tells a shopper a message was received when it was not. Policies state the date their text took effect. Error pages say which of three things happened and offer a way back.

**In scope**

1. A small content layer: typed content modules per page, locale fallback with a visible notice, token substitution for figures that must not drift (D2).
2. Pages: About, Contact (form and route handler), FAQ (and feedback route), Policies (shipping and returns, terms, privacy, accessibility statement), Journal (listing, filters, article).
3. Error handling: `not-found`, `error`, `global-error`, `forbidden`, catch-all for unknown paths, JSON 404 for unknown `/api` paths, one shared `ErrorPage` component.
4. SEO: metadata per page, `sitemap.ts`, `robots.ts`, structured data (FAQPage, Article).
5. Wiring: footer link targets (F's config) and the policy links in checkout (K's consent text), href and target only.
6. Tests, recipe, evidence.

**Out of scope**

- A CMS, an admin UI to edit content, gated resources, a chat widget (Q-P-1, Q-P-6).
- A cookie or consent banner: no third-party script or analytics is added, so none is built; SO-P4 records the decision.
- Newsletter sign-up: F's form is a validated no-op (Q-F-07); P does not build a receiver.
- Real legal text and real articles (owner supplies; this workstream ships clearly marked drafts).
- Product or category entries in the sitemap (parked in `IDEAS.md`; Q may add them).

## 3. Design

### D1. The six templates, adapted to a B2C coffee retailer

| Template says | What applies to Malva | What does not apply |
| --- | --- | --- |
| `about-us`: company story, credentials and route to sales, assembled only from CMS content, served without a commerce call | Story, values (sourcing, roasting, quality guarantee, capsule recycling placeholders), "visit a store" (opens the picker), links to shop and contact. No commerce call. | "Credentials", "certification claims" and "route to sales / supplier vetting": no B2B sales route; no certification is claimed unless the owner supplies one (SO-P2). The template's attribution CTA question is dropped (no referral tracking). |
| `contact-us`: confirm only what support accepted; phone, email and offices static; chat optional | Form routed to a configured receiver, honest failure, reference number, static channels per market (US, Canada) | CRM account or company id (no companies); chat vendor not built; "offices" are customer-care channels per market, not offices |
| `faq`: grouped, full answers in the first response, deep link opens one answer, feedback collector may fail silently | As written. Topics are coffee-specific (D6). | Nothing |
| `policy-pages`: stable addresses, effective date shown, opened from checkout without losing state, locale fallback | As written for shipping and returns, terms, privacy; plus an accessibility statement (footer links it, shell spec) (no imprint page: Germany is dropped, D-030; Q-P-9 removed) | Re-consent for standing B2B orders; per-region variants chosen by store (policies vary by locale only, Q-P-10) |
| `blog-resources`: independently addressable articles, filter listing, withdrawn articles redirect to topic | Called **Journal**. Listing with tag filters and text search, article pages, related articles by tag, withdrawn handling | Gated resources, case studies, form gates |
| `error-pages`: three conditions, shared shell, route back; commercetools section is B2B (`AssociateMissingPermission`, business units, as-associate) | Not found, server error, forbidden; unauthorized exists but is never shown for an expired session. One component with a discriminator. | The whole commercetools section: there are no associates or business units in B2C (D-015), so no permission names appear anywhere. A shopper opening another customer's order gets **not found**, never "forbidden" (does not reveal that it exists). |

### D2. Content layer

All page content is **typed data in the repository** (Q-P-1). No new package is installed (no MDX, no CMS client). One seam, `lib/content/index.ts`, is the only place that reads content; swapping to a CMS later changes that file only.

`lib/content/localized.ts`

```ts
import type { Locale } from '@/i18n/routing';
export type Localized<T> = { 'en-US': T } & Partial<Record<Exclude<Locale, 'en-US'>, T>>;
export interface Resolved<T> { value: T; usedLocale: Locale; isFallback: boolean }
export function resolveLocalized<T>(c: Localized<T>, locale: Locale): Resolved<T>;
// fallback chain: requested locale, then en-US (the storefront's fallback language)
```

`lib/content/blocks.ts`: content bodies are **structured blocks, never HTML** (no `dangerouslySetInnerHTML` anywhere in P; a unit test greps for it).

```ts
export type Block =
  | { type: 'h2'; id: string; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }                  // may contain tokens {{...}}
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'cta'; text: string; href: string }; // internal app path (no locale) or https URL
```

`renderTokens(text, figures)` replaces `{{freeShipping}}`, `{{collectMinutes}}`, `{{returnDays}}`, `{{supportEmail}}`, `{{supportPhone}}`. Figures come from F's promise figures function (same source as the promise bar, so policies, FAQ answers and the shop can never disagree: this is the answer to the FAQ template's "what stops answers drifting" question). **The call is wrapped so that it can never fail the page**: `Promise.race` with an 800 ms timeout and a `catch`; on failure the token is replaced by a neutral phrase from `content.tokenFallback.*` (for example `our free-shipping threshold`). `supportEmail` and `supportPhone` come from `content/contact.ts`, not the platform. About, Contact and Journal use no commerce figure and therefore make **no commerce call at all**.

Shared components (`components/content/`): `ContentPage` (breadcrumb, `<h1>`, intro, prose column max 68ch, optional table of contents from `h2` blocks), `Blocks` (renders blocks to semantic elements, adds `id` to `h2`), `FallbackNotice` (`role="note"`, text `This page is shown in English because it is not available in {language} yet.`, and the fallback region carries `lang="en"`), `EffectiveDate`, `DraftBanner`.

Content files: `content/about.ts`, `content/contact.ts`, `content/faq.ts`, `content/policies.ts` (or one file per policy under `content/policies/`), `content/journal/<slug>.ts` plus `content/journal/index.ts` (registry and tags). Every piece of copy carries a `// DRAFT` comment and `isDraft: true` where it is legal or factual text; `DraftBanner` shows `This text is a draft and not final legal text.` while true (removed by SO-01).

### D3. Routes and files

| Route | File | Notes |
| --- | --- | --- |
| `/{locale}/about` | `app/[locale]/about/page.tsx` | server, static content |
| `/{locale}/contact` | `app/[locale]/contact/page.tsx` + `components/contact/ContactForm.tsx` (client) | |
| `/{locale}/faq` | `app/[locale]/faq/page.tsx` + `components/faq/FaqAccordion.tsx` (client) | `?q=<questionId>` opens one answer on the server |
| `/{locale}/policies/{slug}` | `app/[locale]/policies/[slug]/page.tsx` | slugs `shipping-returns`, `terms`, `privacy`, `accessibility`; unknown slug `notFound()` |
| `/{locale}/journal` | `app/[locale]/journal/page.tsx` | `?tag=` (repeatable, all must match), `?q=`, `?page=` |
| `/{locale}/journal/{slug}` | `app/[locale]/journal/[slug]/page.tsx` | |
| 404 | `app/not-found.tsx`, `app/[locale]/not-found.tsx`, `app/[locale]/[...rest]/page.tsx` | the catch-all calls `notFound()` so unknown paths **inside** a locale render the localized 404 with the shell |
| 500 | `app/[locale]/error.tsx`, `app/global-error.tsx` | |
| 403 | `app/[locale]/forbidden.tsx` (see P-00 for the Next.js flag) | |
| `/api/contact` | `app/api/contact/route.ts` | POST |
| `/api/faq-feedback` | `app/api/faq-feedback/route.ts` | POST |
| unknown `/api/*` | `app/api/[...rest]/route.ts` | JSON 404 for every method |
| SEO | `app/sitemap.ts`, `app/robots.ts` | |

Locale-aware links only (`@/i18n/routing`). Route hrefs for content pages go in `lib/routes.ts` (`aboutHref()`, `contactHref()`, `faqHref(id?)`, `policyHref(slug)`, `journalHref(params?)`, `articleHref(slug)`) so F's footer and K's consent text import one place.

### D4. About

Sections (all text from `content/about.ts`, `Localized`): hero (eyebrow `Our story`, `<h1>`, intro), story (two or three paragraphs), three value cards (Sourcing, Roasting, Quality guarantee: icon, title, two lines), a recycling note for capsules, a "Visit a store" band (button `Find your store` opens the picker, `OpenStoreButton` from O or F; a duplicate tiny leaf is fine if O is not done), and a closing band with `Shop coffee` and `Contact us`. No statistics, awards or certifications are invented. Metadata: title and description per locale; `Organization` JSON-LD is on the home page (O), not repeated.

States: this page has no loading or empty state (static). Fallback locale: `FallbackNotice` at the top. Commerce down: nothing changes for the page body (test D14).

### D5. Contact

Page layout: left column the form card, right column the channels card (`Customer care`: email link, phone link, opening hours, expected reply time, all from `content/contact.ts` per market) and a "Looking for a store?" block opening the picker.

`content/contact.ts`

```ts
export interface ContactChannel { label: Localized<string>; email: string; phone: string | null; hours: Localized<string>; replyWithin: Localized<string> }
export const CONTACT: { default: ContactChannel; byCountry: Partial<Record<'US' | 'CA', ContactChannel>> } // placeholder values on the .example domain, flagged SO-P3
```

Selection: `byCountry[session.country] ?? default` (scenario "Region without an office": a visitor in a market without its own entry sees the default channels, never an empty block). Country comes from the session/locale (`getLocale()`), no commerce call.

`ContactForm` (client). Fields: `name` (required, 2 to 80), `email` (required, simple RFC-shaped check), `topic` select (`order`, `collection`, `subscription`, `product`, `other`; required), `orderNumber` (optional, 3 to 40 characters, letters, digits and dashes), `message` (required, 10 to 2000, counter), `consent` checkbox (required: `I have read the privacy policy` with a link to `policyHref('privacy')` opening in a new tab), a hidden honeypot field `website` (visually hidden, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden`). A line above the message field: `Please do not include card numbers or passwords.` (answer to the template's free-text question). Labels above fields (12.5 px, 600), errors under each field with `aria-describedby` and `aria-invalid`; first invalid field is focused on submit. Signed-in shoppers: name and email are prefilled **once** from `useAccount()` if the fields are still empty; no customer id is sent (Q-P-5).

States: `idle`, `submitting` (button disabled, `aria-busy`), `sent`, `failed`.

- `sent`: the form is replaced by a confirmation card (`role="status"`): `Thank you. We have your message.`, `Reference {reference}`, `Received by {channel}`, `We usually reply within {replyWithin}.` The reference and channel come **from the response** only.
- `failed` (network error, timeout, `503 contact_unavailable`, `429`): `role="alert"` text `We could not send your message. What you wrote is still here. Try again, or reach us at {email} or {phone}.` The fields keep their values; the button is enabled again; for `429` the text adds `Please wait a few minutes.`

`POST /api/contact` (session optional)

Request:

```json
{ "name": "Maya Test", "email": "maya@example.com", "topic": "order", "orderNumber": "MC-10042", "message": "My capsules arrived damaged.", "consent": true, "website": "", "locale": "en-US" }
```

Responses:

| Status | Body | When |
| --- | --- | --- |
| 202 | `{ "reference": "MC-20261019-K7P2QX", "channel": "Customer care" }` | the receiver answered 2xx within 5 s |
| 400 | D's safe body `{ "error": { "code": "invalid_request", "message": "<safe message>" } }` (no field details, never the entered value; the form validates with the **same** validators before sending, so a server 400 means the request bypassed the form) | validation failure or honeypot filled |
| 415 | `unsupported_media_type` | not JSON |
| 429 | `rate_limited`, header `Retry-After` | more than 5 submissions from one client in 10 minutes |
| 503 | `contact_unavailable` | `CONTACT_WEBHOOK_URL` unset, receiver error status, timeout, or network error |

Server flow (`lib/contact/handle.ts`, server-only, pure enough to test): validate (hand-written validators in `lib/contact/validate.ts`, no new package); rate limit with J's shared `lib/rate-limit.ts` (`rateLimit(key, { limit: 5, windowMs: 600000 })`, key a hash of the first `x-forwarded-for` value, limitation on serverless noted in Q-P-4; no IP in logs); errors are produced with D's `errorResponse` helper so bodies stay `{ error: { code, message } }`; build `reference = 'MC-' + yyyymmdd + '-' + 6 random characters from an unambiguous alphabet` with `crypto.randomInt`; `forward()` posts to `CONTACT_WEBHOOK_URL`: JSON `{ reference, receivedAt, locale, country, topic, orderNumber, name, email, message }`, header `Authorization: Bearer ${CONTACT_WEBHOOK_TOKEN}` when set, `AbortController` 5000 ms; **accepted only if the response is 2xx**. The channel name returned is the market's `label` from `content/contact.ts`. The reference is generated by us and sent in the payload so support can find it. **Never log the name, email, order number or message**; log `{ route: 'contact', reference, topic, status, correlationId }` only. Env names (server only, never `NEXT_PUBLIC_`): `CONTACT_WEBHOOK_URL`, `CONTACT_WEBHOOK_TOKEN` (both optional in `.env.example`, empty value).

For development and tests a throwaway receiver `scripts/dev/mock-contact-receiver.mjs` (Node `http`, port 4010, answers 200 with `{}` and prints only the reference; `?fail=1` or header `x-fail: 1` makes it answer 500; `x-slow: 1` waits 6 s). It is excluded from the build and listed in Q's release checks.

No chat: the page loads no third-party script and renders no chat placeholder; a test asserts there is no element matching `[data-chat]` and no `<script src>` to another origin (scenario "Chat script absent").

### D6. FAQ

`content/faq.ts`:

```ts
export interface FaqItem { id: string; q: Localized<string>; a: Localized<Block[]> }
export interface FaqTopic { id: string; title: Localized<string>; items: FaqItem[] }
```

Topics and questions to author as drafts (answers use tokens for figures; owner approves, SO-P2):

| Topic | Questions |
| --- | --- |
| Ordering and delivery | How long does delivery take? What does shipping cost and when is it free ({{freeShipping}})? Can I change or cancel an order? |
| Collecting in store | How does collection work? How long until my order is ready ({{collectMinutes}} minutes)? What do I bring? Why is an item unavailable at my store? |
| Subscriptions | How do subscriptions work? Can I skip, pause or cancel? Does the price change? (answer follows the owner's decision, Q-N-1) |
| Capsules and machines | Are the capsules compatible with my machine (Original or Vertuo, "compatible with Nespresso", never the brand as ours)? Which grind should I choose? How do I descale? |
| Returns and payment | What is the returns window ({{returnDays}} days)? Which payment methods are accepted? Is my payment secure? |
| Your account | How do I change my address? How do I delete my account? |

Rendering: topics as `<section>` with `<h2>`, each question a native `<details id="question-{id}">` with `<summary>` containing the question text as a heading level 3 button-like row, and the full answer **in the HTML of the first response** (inside the closed `<details>`, so it is crawlable and screen readers can reach it). A table of contents at the top links to topics. `FAQPage` JSON-LD with all questions and plain-text answers (blocks flattened) is rendered for the resolved locale.

Deep link: `/{locale}/faq#question-<id>` (client script opens the matching `<details>` on load and on `hashchange`, scrolls it into view honouring reduced motion, moves focus to its summary) **and** `/{locale}/faq?q=<id>` (the server renders that item with `open`, so it works without JavaScript and for crawlers). Other topics stay on the same page. Unknown id: ignored, page renders normally.

Feedback (`FaqFeedback`, client leaf at the end of each answer): `Was this helpful?` with two buttons `Yes` and `No`. Click: `POST /api/faq-feedback` with `{ "questionId": "ordering-shipping-cost", "helpful": false, "locale": "en-US" }`.

- Response `202 { "recorded": true }`: replace the buttons by `Thanks for your feedback.` (`aria-live="polite"`).
- Any other result, network error or timeout (3 s): **show nothing**, keep the buttons, discard the vote (scenario "Feedback collector unreachable"). No acknowledgement is ever shown unless `recorded: true` arrived.
- Server: validate `questionId` against the ids in `content/faq.ts` (unknown id `400`), forward to `FEEDBACK_WEBHOOK_URL` when set (2xx required, else `502 upstream_unavailable`); when it is unset write one structured log line `{ route: 'faq-feedback', questionId, helpful }` and answer `202 { recorded: true }` (the server log is the collector; Q-P-7 asks who owns it). No personal data is sent or logged.

### D7. Policies

`content/policies.ts`: `Localized<{ title: string; effectiveDate: 'YYYY-MM-DD'; isDraft: boolean; body: Block[] }>` per slug. **The effective date lives inside the localized text object**, so the date always moves with the text it describes, including when a locale falls back to English (the fallback's own date is shown; scenario "Version superseded"). `EffectiveDate` renders `Effective from {date}` with `Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })`.

Pages: `shipping-returns` (delivery by market using tokens for the threshold; collection; returns window `{{returnDays}}`, how to return, refunds), `terms` (terms of sale), `privacy` (what is collected: account, orders, session cookie; payment is handled by the hosted Checkout and its provider, card data never touches Malva; reviews; contact form; retention and rights; no analytics or advertising cookies at present, the only cookies are the session cookie and the market preference), `accessibility` (conformance target WCAG 2.2 AA, known gaps, contact route). Policy text is US and Canada neutral placeholders (US state and Canadian federal privacy and consumer-law wording to be supplied by the owner or legal, SO-01); there is no imprint, no VAT text and no email promise (no confirmation, reset or marketing email is sent, D-032); the delivery section names the US and Canada markets and says collection is available in New York City stores only.

Rules: each page has a table of contents when it has more than three `h2` blocks; headings have ids; the page is plain server-rendered content with **no session, cart or commerce dependency beyond tokens** (D2); the URL never changes with the content system (stable `policyHref(slug)`, tested by a snapshot of the slug list so a rename fails a test). "Opened from checkout": checkout's consent links open the policy in a **new tab** (`target="_blank"`, `rel="noopener"`, set by task P-12), so the original tab keeps cart, addresses and selections; the policy page itself has no redirect and requires nothing.

### D8. Journal (blog)

`content/journal/<slug>.ts` exports an `Article`:

```ts
export interface Article {
  slug: string;                                  // lower-case, hyphens, 3 to 80 characters, unique, never equal to a reserved word (see below)
  status: 'published' | 'withdrawn';
  topicTag: string;                              // where a withdrawn article sends the reader
  tags: string[];                                // keys of the fixed taxonomy
  publishedAt: string;                           // 'YYYY-MM-DD'
  updatedAt?: string;
  image?: { url: string; alt: Localized<string> };   // clean URL, no query string
  title: Localized<string>;
  description: Localized<string>;                // 110 to 160 characters
  body: Localized<Block[]>;                      // empty array for withdrawn articles (the text is removed)
}
```

Taxonomy (fixed, labels in `messages` under `journal.tags.*`): `brewing`, `capsules`, `machines`, `sourcing`, `subscriptions`, `care`. A seed set of three drafted articles (one per two tags, one with **no tags** to exercise the related block, one **withdrawn**) ships so every scenario is testable; real content is owner work (SO-P5). Reserved slugs: none needed because articles live under `/journal/` (answer to the template's "shared prefix" question: articles share no prefix with category or product routes).

Listing `/{locale}/journal`: header (`<h1> Journal`), tag chips (links, `aria-pressed` style as links with `aria-current`), a search field (GET form `q`), results as cards (image 3:2, tags, date, title, description), 9 per page with Previous and Next links (`?page=`, clamped to the last page). Filters are in the URL: `?tag=brewing&tag=capsules&q=descale&page=2`. Rules: `tag` repeated means **all must match**; unknown tags are ignored; `q` matches title and description case-insensitively; order newest first.

Empty result (scenario "Filter matches nothing"): `No articles match your filters.` followed by the **applied filters as removable chips** (each chip is a link that removes only that one filter) and a `Clear all` link; the listing stays on the page with the chips visible so they can be relaxed one at a time.

Article page: breadcrumb, `<h1>`, date line, tags, hero image (lazy except the first image which is `priority`), `Blocks`, related block. Related (scenario "Article without tags"): other **published** articles that share at least one tag, newest first, at most three; the block is **omitted** when the article has no tags or nothing matches (never filled with unrelated articles). `generateMetadata`: `title`, `description`, `alternates.canonical` (`/{locale}/journal/{slug}`), `alternates.languages` only for locales that have their own text (a fallback locale is not advertised as an alternate), `openGraph` type `article` with `publishedTime`, one image. `Article` JSON-LD. `generateStaticParams`: all locales x published slugs; `dynamicParams` true so withdrawn and unknown slugs are handled per request.

Withdrawn (scenario "Article withdrawn"): the page for a withdrawn slug **does not render its text** (there is none) and calls `redirect()` (307) to `/{locale}/journal?tag=<topicTag>`; the redirect is outside any `try/catch`. Unknown slug: `notFound()`.

Fallback locale: card and article show `FallbackNotice`; fallback content region has `lang="en"`.

### D9. Error pages

One component, `components/error/ErrorPage.tsx`:

```ts
interface ErrorPageProps {
  kind: 'not-found' | 'server-error' | 'forbidden' | 'unauthorized';
  reference?: string;       // error digest, shown as "Reference {reference}" for server-error only
  onRetry?: () => void;     // server-error only (Next's reset())
}
```

| Kind | Status | Heading and text | Actions |
| --- | --- | --- | --- |
| `not-found` | 404 | `We can't find that page.` `The address may be mistyped, or the product may no longer be available.` | Search form (GET to the search route, `role="search"`, visible label), links to the top-level categories (static nav config shared with F, **no commerce call**), `Back to home` |
| `server-error` | 500 | `Something went wrong on our side.` `Your bag and your account are safe. Please try again.` | `Try again` (calls `onRetry`), `Back to home`, `Contact us`; `Reference {reference}` |
| `forbidden` | 403 | `You don't have access to this page.` `If you think this is a mistake, contact us.` | `Go to my account`, `Contact us` |
| `unauthorized` | 401 | `Please sign in to continue.` | `Sign in` (with `next` = current path). **Never shown for an expired session**: the account guard redirects to sign-in with the destination kept (scenario "Expired session is not a refusal"). |

The commercetools-specific text of the template (permission names, business units) is not used. The message never includes the platform's error text. The page is **static**: no session read, no commerce call, no data fetching; it renders even when the thing that failed was the commerce tier. Because it is in the locale layout, the shell is complete (header, footer); there is never a half-rendered shell. Keep `<main>` with one `<h1>` and `role="alert"` **only** on the server-error heading region.

Files and behaviour:

- `app/[locale]/not-found.tsx` renders `ErrorPage kind="not-found"`. `app/not-found.tsx` (no locale known) renders the same with the default locale's messages. `app/[locale]/[...rest]/page.tsx` calls `notFound()` so unmatched paths under a valid locale use the localized page (known next-intl pattern).
- `app/[locale]/error.tsx` (`'use client'`) renders `ErrorPage kind="server-error"` with `reset` and `error.digest`. It does **not** touch cookies, SWR cache or session (scenario "Upstream fault": session and cart stay intact).
- `app/global-error.tsx` (`'use client'`, includes `<html>` and `<body>`) imports the global stylesheet so tokens apply, and cannot use `NextIntlClientProvider`, so it carries a small **inline dictionary for the two locales** (the one allowed exception to "strings come from the catalogues"; a test checks it has both), choosing the language from the first path segment.
- `app/[locale]/forbidden.tsx` / `unauthorized.tsx`: Next.js `forbidden()` and `unauthorized()` may require `experimental.authInterrupts` in `next.config.ts`. P-00 checks the Next.js documentation for the installed 16.x and records the answer in `PROJECT-FINDINGS.md`; if the flag is needed set it only in `next.config.ts` and say so in the hand-off. B2C code rarely calls `forbidden()` (D-015).
- `app/api/[...rest]/route.ts` exports `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` returning `404 { "error": { "code": "not_found", "message": "Not found" } }` so unknown API paths do not return HTML.
- Recovery policy for retired products (template question): a product that is unpublished or unknown returns the **hard 404 page** with search and category links (no redirect, Q-P-12).
- HTTP status: `notFound()` called after streaming started yields 200 with a `noindex` meta. The recipe checks the real status of `/{locale}/<product route>/does-not-exist`; if it is not 404, record it in `PROJECT-FINDINGS.md` and tell H and Q (do not fix H's page here).

### D10. SEO

`app/sitemap.ts`: entries for `/{locale}` and the content routes (about, contact, faq, every policy, journal, every published article) for the two locales (en-US, en-CA), with `alternates.languages` where a page has its own translation, `lastModified` from `updatedAt` or the policy `effectiveDate`. `app/robots.ts`: allow `/`, disallow `/api/`, `/*/account`, `/*/cart`, `/*/checkout`, and point at the sitemap (absolute site origin from `NEXT_PUBLIC_SITE_URL` or the deployment URL variable; the name is chosen in P-00 and added to `.env.example`, no secret). Withdrawn articles are never in the sitemap.

### D11. i18n keys (new namespaces; identical keys in the two catalogues)

`content.*` (shared), `about.*`, `contact.*`, `faq.*`, `policy.*`, `journal.*`, `error.*`. Page copy itself is in `content/*.ts` (Localized), these catalogues carry the **interface** strings. en-CA equals en-US except spelling where it differs. Core keys (all of them are created in the tasks; the table lists the ones with exact text a reviewer must check):

| Key | en-US |
| --- | --- |
| `content.fallbackNotice` | This page is shown in English because it is not available in {language} yet. |
| `content.draftBanner` | This text is a draft and not final legal text. |
| `content.toc` | On this page |
| `content.tokenFallback.freeShipping` | our free-shipping threshold |
| `content.tokenFallback.collectMinutes` | a short time |
| `content.tokenFallback.returnDays` | the return period |
| `policy.effective` | Effective from {date} |
| `contact.title` | Contact us |
| `contact.field.name` / `email` / `topic` / `orderNumber` / `message` | Name / Email / Topic / Order number (optional) / Message |
| `contact.topic.order` / `collection` / `subscription` / `product` / `other` | My order / Collection in store / A subscription / A product / Something else |
| `contact.noSecrets` | Please do not include card numbers or passwords. |
| `contact.consent` | I have read the privacy policy. |
| `contact.submit` / `sending` | Send message / Sending... |
| `contact.sent.title` | Thank you. We have your message. |
| `contact.sent.reference` | Reference {reference} |
| `contact.sent.channel` | Received by {channel} |
| `contact.sent.reply` | We usually reply within {replyWithin}. |
| `contact.failed` | We could not send your message. What you wrote is still here. Try again, or reach us at {email} or {phone}. |
| `contact.failedRate` | Please wait a few minutes before trying again. |
| `contact.error.required` / `emailInvalid` / `tooShort` / `tooLong` / `consentRequired` | This field is required. / Enter a valid email address. / Please write a little more. / Please shorten your message. / Please confirm to continue. |
| `faq.title` | Frequently asked questions |
| `faq.helpful` / `yes` / `no` / `thanks` | Was this helpful? / Yes / No / Thanks for your feedback. |
| `journal.title` | Journal |
| `journal.search` / `clear` | Search articles / Clear all |
| `journal.empty` | No articles match your filters. |
| `journal.removeFilter` | Remove filter {label} |
| `journal.related` | Keep reading |
| `journal.tags.brewing` / `capsules` / `machines` / `sourcing` / `subscriptions` / `care` | Brewing / Capsules / Machines / Sourcing / Subscriptions / Care |
| `error.notFound.title` / `text` | We can't find that page. / The address may be mistyped, or the product may no longer be available. |
| `error.server.title` / `text` | Something went wrong on our side. / Your bag and your account are safe. Please try again. |
| `error.forbidden.title` / `text` | You don't have access to this page. / If you think this is a mistake, contact us. |
| `error.unauthorized.title` | Please sign in to continue. |
| `error.retry` / `home` / `contact` / `reference` / `searchLabel` / `searchSubmit` | Try again / Back to home / Contact us / Reference {reference} / Search the shop / Search |

Footer and nav labels belong to F.

### D12. Accessibility and responsive

One `<h1>` per page; headings in order; prose column 68ch; line height 1.55 (E); links underlined in prose; form controls with visible labels and 44 px touch height; error summary is not needed (inline errors plus focus on the first invalid field); `details` summaries are focusable with visible rings; the `FallbackNotice` is `role="note"`; the honeypot is not focusable and not announced; `prefers-reduced-motion` honoured for the scroll to a deep-linked question. Layout: content pages are single column up to 900 px; contact is two columns above 900 and one below (channels card first on small screens, because it works when the form does not); journal grid 3 columns, 2 under 1080 px (E breakpoints), 1 under 520 px. Contrast follows the token rules (use `--ink-2`, never `--ink-3` or `--teal` for small text on canvas; see Q).

### D13. Cache and performance

Content pages are static data: `generateStaticParams` for locales and slugs; no `unstable_cache` is needed. The only shared server cache used is F's (promise figures). Per-person data is never read except `country` for the contact channel and the optional prefill on the client.

### D14. Degraded commerce tier (scenario "Commerce tier degraded")

Pages import nothing from `lib/ct/*` except through the promise-figure wrapper of D2. A unit test (`no-commerce-imports.test.ts`) reads the page files of About, Contact, FAQ, Policies and Journal and fails if they import `@/lib/ct/` anywhere else. The browser recipe step 6.9 runs a second dev server with an unreachable `CTP_API_URL` and checks these pages render fully.

## 4. Tasks

Common rules: test first; `npm run check` before ticking; commit `ws-p: P-0x summary`; tokens only; two catalogues; no `any`; no `dangerouslySetInnerHTML`; links through `@/i18n/routing`.

- [x] **P-00 Preconditions and findings.** E and F `Done`. Grep and record in `plans/evidence/P/paths.md`: F's footer link config, F's `getPromiseFigures()` (`lib/ct/promise.ts`), the store-picker opener, G's search route and K's checkout consent links, L's account guard function, H's not-found call. Read the Next.js 16 documentation for `forbidden`, `unauthorized` and `authInterrupts` and the not-found status code behaviour; record in `PROJECT-FINDINGS.md`. Pick the env name for the site origin (add to `.env.example`). Add `.env.example` entries `CONTACT_WEBHOOK_URL=`, `CONTACT_WEBHOOK_TOKEN=`, `FEEDBACK_WEBHOOK_URL=` (no values). `npm run check` green. [SKILL: commercetools-storefront]
- [x] **P-01 Content layer.** `lib/content/localized.ts`, `blocks.ts`, `index.ts`, `renderTokens`, `lib/routes.ts` additions, `components/content/*` (`ContentPage`, `Blocks`, `FallbackNotice`, `EffectiveDate`, `DraftBanner`), messages `content.*`. Tests: `Locale without translation: fallback language is served and identified`, `fallback chain ends at en-US`, `blocks render semantic elements and no raw html`, `no dangerouslySetInnerHTML in content components`, `tokens are replaced from figures`, `tokens fall back when figures fail or time out`, `route helpers return stable paths`. 
- [x] **P-02 About page.** `content/about.ts`, route, metadata. Tests: `Editor publishes a correction: content change appears in the rendered page from the module only` (render, change fixture, render again), `Commerce tier degraded: About renders with commerce mocked to throw`, `Locale without translation: About shows the notice in en-CA when only the en-US text exists`, `about has one h1`.
- [x] **P-03 Policies.** `content/policies.ts` (five policies, drafts with placeholder text, effective dates), route with `generateStaticParams`, table of contents, `EffectiveDate`, `DraftBanner`. Tests: `every policy has an iso effective date no later than today in every locale`, `Version superseded: the date comes from the same object as the text`, `Policy not translated: fallback text and its own date are shown`, `policy slugs are stable` (snapshot of the slug list), `unknown policy slug is not found`, `Opened from checkout: policy page needs no session and sets no redirect`, `policy page has no commerce import beyond tokens`.
- [x] **P-04 FAQ page.** `content/faq.ts` (six topics, drafts), page, `FaqAccordion`, `?q=` handling, JSON-LD. Tests: `answers are present in the first response inside closed details`, `Deep link to one question: hash opens that answer`, `Deep link: q parameter renders that answer open on the server`, `other topics remain reachable`, `unknown question id is ignored`, `Answer not translated: fallback is served with a notice`, `json-ld lists every question`.
- [x] **P-05 FAQ feedback.** `app/api/faq-feedback/route.ts`, `FaqFeedback`. Tests: `Feedback collector unreachable: vote is discarded and nothing is shown`, `acknowledgement only after recorded true`, `unknown question id is 400`, `feedback is forwarded to the configured receiver`, `without a receiver it logs one line and answers 202`, `no personal data is logged`, `request times out after 3 seconds on the client`.
- [x] **P-06 Contact: validators and handler.** `lib/contact/validate.ts` (used by client and server), `forward.ts`, `handle.ts`, route, `scripts/dev/mock-contact-receiver.mjs`. Tests (call `POST` with `new Request`, mock `fetch`): `Enquiry accepted downstream: 202 with reference and channel`, `Routing unavailable: receiver 500 returns 503`, `Routing unavailable: timeout returns 503`, `no receiver configured returns 503`, `reference has the expected shape`, `honeypot is rejected`, `invalid input answers the safe invalid_request body without echoing values`, `message over 2000 characters is rejected`, `sixth submission in ten minutes is 429`, `non-JSON body is 415`, `logs never contain the message or email`, `payload sent to the receiver carries the reference`.
- [x] **P-07 Contact page and form.** Page, `ContactForm`, channels card, market selection, prefill. Tests: `Enquiry accepted downstream: confirmation names the channel and shows the reference`, `Routing unavailable: text is preserved and phone and email are offered`, `Chat script absent: no chat placeholder and no third-party script`, `Region without an office: default channels are shown`, `first invalid field gets focus`, `labels errors and aria-invalid are wired`, `button is disabled while sending`, `signed-in prefill does not overwrite typed text`.
- [x] **P-08 Journal content and listing.** `content/journal/*` (three drafts: tagged, untagged, withdrawn), registry, listing with filters, search, pagination, chips. Tests: `Filter matches nothing: states it and keeps the applied filters visible`, `removing one chip relaxes only that filter`, `all selected tags must match`, `search matches title and description`, `page beyond the last is clamped`, `withdrawn and unknown articles are not listed`, `fallback articles are marked`.
- [x] **P-09 Journal article page.** Route, metadata, JSON-LD, related block, withdrawn redirect, `generateStaticParams`. Tests: `Article withdrawn: redirects to its topic and serves no text`, `Article without tags: related block is omitted`, `related shows at most three published articles sharing a tag`, `metadata has title description canonical and article time`, `alternates list only locales with their own text`, `unknown slug is not found`, `article slugs are unique and valid`.
- [ ] **P-10 Error component and files.** `ErrorPage`, the route files (replace the bare `error.tsx` and `not-found.tsx` shells that A created and that E styled minimally), the catch-all, `global-error` with inline dictionary, `forbidden.tsx` per P-00, messages `error.*`. Tests: `Address resolves to nothing: not found page has search and category links and no session read`, `Upstream fault: server error page offers retry and does not touch cookies`, `Upstream fault: retry calls reset`, `Expired session is not a refusal: account guard redirects to sign-in with the destination and renders no error page` (imports L's guard), `server error page shows only the digest never the message`, `global error dictionary has both locales`, `unknown locale path renders the default-locale 404`, `error page imports nothing from lib/ct`. [SKILL: commercetools-storefront]
- [ ] **P-11 Unknown API paths.** `app/api/[...rest]/route.ts`. Tests: `unknown api path answers json 404 for every method`, `existing api routes are not shadowed` (call a known handler path through the router list in a test that lists `app/api` folders).
- [ ] **P-12 Wiring.** F's footer link config: set hrefs for Shipping and returns, FAQ, Contact us, Our story, Journal, Privacy, Terms, Accessibility using `lib/routes.ts`. K's consent text: policy links open in a new tab with `rel="noopener"`. Change **only** hrefs and `target`/`rel`. Tests: `footer links point at content routes`, `checkout consent links open in a new tab`. [SKILL: commercetools-storefront]
- [ ] **P-13 SEO.** `app/sitemap.ts`, `app/robots.ts`. Tests: `sitemap lists content pages in both locales`, `withdrawn articles are not in the sitemap`, `robots disallows api account cart and checkout`.
- [ ] **P-14 Messages, responsive, a11y, gates.** All keys of D11 plus every other key used, in two catalogues (identical key test from E); CSS per D12; `npm run check`; `npm run build` (content routes static, error routes present). Tests: `catalogues have the same content keys`, `no hard coded strings in content components`.
- [ ] **P-15 Browser and degraded-tier verification** (sections 6 and 7); evidence in `plans/evidence/P/`; owner rows; `STATUS.md` `Ready for review`.

## 5. Scenarios checklist

`about-us` (primary):

- [ ] Editor publishes a correction: `about.test.tsx` `Editor publishes a correction: content change appears in the rendered page from the module only`. **Note**: "without a storefront deployment" is not possible with repository content; the module is the single seam and a CMS swap is Q-P-1. Mark this scenario `partial: content module only` and add the owner sign-off in SO-P2.
- [ ] Commerce tier degraded: `about.test.tsx` `Commerce tier degraded: About renders with commerce mocked to throw`; recipe 6.9.
- [ ] Locale without translation: `about.test.tsx` `Locale without translation: About shows the notice in en-CA when only the en-US text exists`.

`contact-us`:

- [ ] Enquiry accepted downstream: `contact-route.test.ts` `Enquiry accepted downstream: 202 with reference and channel`; `ContactForm.test.tsx` confirmation test; recipe 6.3.
- [ ] Routing unavailable: `contact-route.test.ts` (receiver 500, timeout, unset), `ContactForm.test.tsx` `Routing unavailable: text is preserved and phone and email are offered`; recipe 6.4.
- [ ] Chat script absent: `ContactPage.test.tsx` `Chat script absent: no chat placeholder and no third-party script`.
- [ ] Region without an office: `ContactPage.test.tsx` `Region without an office: default channels are shown`.

`faq`:

- [ ] Deep link to one question: `faq.test.tsx` hash and `q` tests; recipe 6.5.
- [ ] Feedback collector unreachable: `FaqFeedback.test.tsx` `Feedback collector unreachable: vote is discarded and nothing is shown`; recipe 6.5.
- [ ] Answer not translated: `faq.test.tsx` `Answer not translated: fallback is served with a notice`.

`policy-pages`:

- [ ] Opened from checkout: `policy.test.tsx` `Opened from checkout: policy page needs no session and sets no redirect`, `checkout.links.test.tsx` `checkout consent links open in a new tab`; recipe 6.6 (state intact).
- [ ] Version superseded: `policy.test.tsx` `Version superseded: the date comes from the same object as the text`.
- [ ] Policy not translated: `policy.test.tsx` `Policy not translated: fallback text and its own date are shown`.

`blog-resources`:

- [ ] Filter matches nothing: `journal.test.tsx` `Filter matches nothing: states it and keeps the applied filters visible`.
- [ ] Article withdrawn: `article.test.tsx` `Article withdrawn: redirects to its topic and serves no text`; recipe 6.7.
- [ ] Article without tags: `article.test.tsx` `Article without tags: related block is omitted`.

`error-pages`:

- [ ] Address resolves to nothing: `not-found.test.tsx` `Address resolves to nothing: ...`; recipe 6.8 (HTTP status checked).
- [ ] Upstream fault: `error.test.tsx` `Upstream fault: server error page offers retry and does not touch cookies`; recipe 6.9.
- [ ] Expired session is not a refusal: `error-routing.test.ts` `Expired session is not a refusal: ...`; recipe 6.10.

## 6. Browser recipe (Chrome DevTools MCP)

Base `http://localhost:3000`. Viewports 375x812 and 1440x900. Evidence `plans/evidence/P/<step>-<what>-<375|1440>.png` and `README.md`. Console without errors and no failed requests unless the step says a failure is expected (then it is named in the README). Start the mock receiver for steps 6.3 and 6.4: `cd storefront && node scripts/dev/mock-contact-receiver.mjs` and set `CONTACT_WEBHOOK_URL=http://127.0.0.1:4010/` in `.env.local`.

1. **6.1 Footer tour.** On `/en-US` click each footer link (Shipping and returns, FAQ, Contact us, Our story, Journal, Privacy, Terms, Accessibility): each lands on a real page with one `h1`, no 404. Repeat for `/en-CA` (Canada pages show the same text; delivery-only wording appears in the shipping page).
2. **6.2 About and policies.** `/en-US/about`: snapshot shows headings and bands; `Find your store` opens the picker. `/en-US/policies/terms`: `Effective from <date>`, draft banner, table of contents links jump to headings. Screenshot at 375 and 1440.
3. **6.3 Contact success.** `/en-US/contact`: fill all fields (`@example.com`), tick consent, submit: confirmation card shows `Reference MC-...` and the channel name. `list_network_requests` shows `POST /api/contact` 202. The receiver terminal printed the same reference and no message text appears in the dev server log.
4. **6.4 Contact failure.** Set `CONTACT_WEBHOOK_URL=http://127.0.0.1:4010/?fail=1` (the receiver then answers 500), restart the dev server, and submit: the failed message appears, the fields keep their text, the phone and email links are present, the button is enabled again. Restore the normal URL, restart, and resubmit successfully. Submit empty: inline errors, focus on the first invalid field. Submit six times quickly: the sixth shows the wait message (429).
5. **6.5 FAQ.** `/en-US/faq`: `evaluate_script` counts `details` elements and checks that every `details` has a non-empty answer in its `textContent` while closed (read `textContent`, not `innerText`, which hides closed content). Open `/en-US/faq#question-<id>`: that answer is open and in view; open `/en-US/faq?q=<id>`: open on load. Click `No` on an answer: thanks text; then block `/api/faq-feedback` (stub `fetch` to reject with `evaluate_script` before clicking): nothing is shown.
6. **6.6 Policy from checkout.** Add a pod to the bag, `/en-US/checkout`, fill the address, click the Terms link in the consent text: it opens in a new tab (`list_pages` shows two pages); close it: the first tab still has address and selections.
7. **6.7 Journal.** `/en-US/journal`: cards, tag chips. Apply two tags that have no common article: empty message with two removable chips; remove one chip: results appear. Open the untagged article: no `Keep reading` block. Open the withdrawn slug: you land on `/journal?tag=<topic>` (network shows 307) and the old text is nowhere. Metadata: `evaluate_script` reads `document.title` and `link[rel=canonical]`.
8. **6.8 404.** `/en-US/does-not-exist`, `/en-CA/does-not-exist` and `/xx/foo`: localized 404 with shell, search form and category links; the document response status is 404 (`list_network_requests` and `get_network_request`); a search from the 404 page works. A product route with an unknown slug: same page and status; if status is 200 record it (D9). `/api/nothing` returns JSON 404.
9. **6.9 Server error and degraded commerce.** Start a second dev server on port 3002 with `CTP_API_URL=http://127.0.0.1:9` (separate env file, never committed): About, Contact, FAQ, every policy and the journal render fully; a commerce page (a listing) shows the localized server-error page with `Try again` and a reference, with the header and footer present; click `Try again` (still failing: the page stays, no loop); the cart count in the header is unchanged from before.
10. **6.10 Expired session.** Signed out, open `/en-US/account/orders`: you land on sign-in with the destination preserved (URL carries `next`), **not** on a forbidden page.
11. **6.11 Responsive, keyboard, audit.** Resize 1080, 900, 820, 700, 520, 375 on contact, FAQ, journal and 404: no horizontal scroll (`scrollWidth <= innerWidth`), contact one column under 900. Keyboard: Tab through the contact form and a FAQ item (Enter toggles, focus ring visible). `lighthouse_audit` for About, Contact, FAQ, Terms, Journal and the 404 page: accessibility, SEO and best practices at least 95 (record any lower score with the reason).

## 7. Self-verification with data (no asking the owner)

1. Contact and feedback routes are verified against the mock receiver; the receiver's printed references equal the ones the page showed (record both in `plans/evidence/P/readback.md`).
2. Content validity script (a unit test, also run in `check`): slugs unique and valid, tags in the taxonomy, effective dates valid, every `href` in `cta` blocks resolves to a known route helper or an `https://` URL, every token used is one of the five known tokens.
3. Figures check: the shipping threshold, collection minutes and return days shown in the policy and FAQ pages equal the promise bar (F) in each market; read the shipping rate tiers with the commercetools MCP or `seed verify` and compare (ids and values only).
4. Sitemap check: fetch `/sitemap.xml` and `/robots.txt`; every URL returns 200 (script in the README, run with the dev server up).

## 8. Manual testing and owner items (also in `plans/notes/todo-P.md`)

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| SO-01 (existing) | Owner or legal | Before release | Supply or approve privacy policy, terms of sale, cookie statement and returns text for the US and Canada (neutral drafts; no Impressum, no VAT text) in `storefront/content/policies.ts`; set `isDraft: false` per policy. | Final text; draft banner gone | TODO |
| SO-P1 | Owner | Before release | These pages have no design. Compare the screenshots in `plans/evidence/P/` with your intent: About, Contact, FAQ, a policy, Journal list and article, 404, 500. | Approval or change list | TODO |
| SO-P2 | Owner | Before release | Read `content/about.ts` and `content/faq.ts` (all answers). Approve or rewrite; confirm no claim (certification, sourcing, recycling) is untrue. | Approved copy | TODO |
| SO-P3 | Owner | Before release | Provide customer-care email, phone, opening hours and reply time per market (US, Canada) for `content/contact.ts` (current values are placeholders on the `.example` domain). | Real channels in the file | TODO |
| SO-P4 | Owner and legal | Before release | Decide whether a cookie or consent banner is needed (no analytics or third-party scripts today; the session and market cookies are essential). Record the decision in `QUESTIONS.md` Q-P-6. | Decision recorded | TODO |
| SO-P5 | Owner | Before release | Replace the three drafted journal articles with real ones or remove them; supply images. | Real articles | TODO |
| OA-P1 | Owner | Before the contact form can work outside tests | 1. Choose where enquiries go (a helpdesk, a Slack or Teams incoming webhook, a form service). 2. Put its URL in `storefront/.env.local` and the host's settings as `CONTACT_WEBHOOK_URL`; token (if any) as `CONTACT_WEBHOOK_TOKEN`. 3. Optionally the same for FAQ feedback: `FEEDBACK_WEBHOOK_URL`. 4. Tell the team the URL is set (never paste it in chat). | A real submit shows a confirmation and the message arrives | TODO |
| M-P-01 | Owner | After OA-P1 | Send a real enquiry from the deployed site on a phone; read it at the receiver; note the reference. | Message arrives with the same reference shown on screen | TODO |
| M-P-02 | Owner or accessibility reviewer | After P-15 | Read Contact, FAQ and a policy with VoiceOver (macOS) or TalkBack: headings, form errors, details toggles, fallback notice. | Everything announced sensibly | TODO |
| M-P-03 | Removed | n/a | German review no longer applies: Germany and German are dropped (D-030). | n/a | WAIVED |

## 9. Questions (also in `plans/notes/questions-P.md`)

| ID | Question | Default | Blocks |
| --- | --- | --- | --- |
| Q-P-1 | Where does page content live (the templates say CMS, with edits published without a deployment)? | In repository content modules behind one seam; a correction needs a deploy | no |
| Q-P-2 | Which pages and routes exist (names, slugs)? | `/about`, `/contact`, `/faq`, `/policies/{shipping-returns, terms, privacy, accessibility}`, `/journal` | no |
| Q-P-3 | Where do contact enquiries go and who answers? | A webhook receiver chosen by the owner (OA-P1); until then the form reports "not sent" honestly | live contact |
| Q-P-4 | Rate limiting on serverless is per instance | In-memory limit now; a shared store or the host's WAF in Q's security review | no |
| Q-P-5 | Does a signed-in shopper's enquiry carry the customer id? | No; only prefilled name and email that the shopper can edit | no |
| Q-P-6 | Cookie or consent banner and chat widget? | Neither; no third-party scripts; SO-P4 | release |
| Q-P-7 | Who owns FAQ feedback ("unhelpful" votes)? | The server log is the collector; owner names a receiver and an owner later | no |
| Q-P-8 | Which statements on About are legally controlled (certifications, sourcing)? | None are claimed; owner adds with sign-off | release |
| Q-P-9 | Removed (D-030): no German seller, no imprint page | None | no |
| Q-P-10 | Do policies vary by market or only by language? | By language (locale); en-US and en-CA share English text; delivery wording differs by market via tokens | release |
| Q-P-11 | Re-consent for subscribers after a material terms change, and where is it recorded? | Not built; out of scope | no |
| Q-P-12 | Retired product linked from an old bookmark or page: hard 404 or soft redirect to the category? | Hard 404 page with search and category links | no |
| Q-P-13 | Name of the blog section (spec says blog and resources) | "Journal" at `/journal` | no |
| Q-P-14 | Where are superseded policy versions kept so the text in force on an order date can be produced? | Git history; no public archive | no |
| Q-P-15 | Newsletter sign-up (footer) needs a receiver and a route not in the route table | Not built here; reported to the lead (F decides) | no |

## 10. Definition of done

- P-00 to P-15 ticked, each with a passing `check` commit; `npm run build` passes.
- Every scenario of section 5 has a named passing test or recorded evidence (the About "without a deployment" scenario recorded as `partial`, with SO-P2).
- Recipe 6.1 to 6.11 done with evidence at 375 and 1440; console and network clean; the 404 status and the degraded-commerce run recorded.
- No page imports `lib/ct` except through the figures wrapper; no `dangerouslySetInnerHTML`; no secret in code or logs; the contact route never logs message content.
- `.env.example` lists the three new names without values; `plans/notes/todo-P.md` and `questions-P.md` exist.
- Footer links and checkout consent links work (6.1, 6.6).
- No `TODO` or `FIXME` in code without an `IDEAS.md` entry; `node plans/verify-plan.mjs` passes; `STATUS.md` `Ready for review`.

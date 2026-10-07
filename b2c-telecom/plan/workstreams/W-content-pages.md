# W — Content pages: about, FAQ, blog, policies, support

**Specs:** `about-us`, `faq`, `blog-resources`, `policy-pages`, `contact-us` (all scenarios; the four `contact-us` scenarios and one `faq` scenario are replaced, see Excluded) · supporting `seed-product-images-pexels` (only the "Image credits" page text; its footer link to Pexels belongs to I/G)
**Depends on:** D, I · **Unblocks:** Y · **Decisions:** D-002, D-004, D-034, D-051, D-055, D-059
**Owner prerequisites:** none · **Sign-off:** SO-09 · **Skill refs:** none (no commercetools calls; these pages never touch the commerce API)

## Goal
A visitor can read About, FAQ (with a support page that adds a `mailto:` contact), a small blog and the legal pages (shipping and returns, terms, privacy, image credits) in `en-US` and `de-DE`, all served from versioned files under `site/content/`, with every FAQ answer present in the HTML, every policy stating its effective date, and every article at a stable, indexable address.

## Design

### Routes (all owned by W, all under `app/[locale]/`; see `plan/ARCHITECTURE.md`)
| Route | File | Notes |
| --- | --- | --- |
| `/about` | `app/[locale]/about/page.tsx` | Markdown page `about` |
| `/faq` | `app/[locale]/faq/page.tsx` | Full FAQ, `FAQPage` JSON-LD |
| `/support` | `app/[locale]/support/page.tsx` | Contact card (`mailto:`) + one question per topic + link to `/faq` (D-051) |
| `/blog` | `app/[locale]/blog/page.tsx` | Listing; filter by `?tag=a&tag=b` (AND, max 3 tags) |
| `/blog/[slug]` | `app/[locale]/blog/[slug]/page.tsx` | Article; `Article` JSON-LD |
| `/legal/[policy]` | `app/[locale]/legal/[policy]/page.tsx` | `policy ∈ shipping-returns \| terms \| privacy \| image-credits`; optional `?asOf=YYYY-MM-DD` |

Every page: Server Component, calls `setRequestLocale(locale)`, exports `generateMetadata`, and has `generateStaticParams` over `routing.locales` (and over slugs for `blog/[slug]` and `legal/[policy]`). Unknown slug → `notFound()`. Pages import **nothing** from `@/lib/ct/*` (test enforces this, see "Commerce tier degraded").

### Content files (`site/content/`, owned by W; versioned in git, no CMS, D-034)
```
content/
  en-US/
    about.md
    faq.md
    support.md
    blog/<slug>.md                        # slug = file name, identical in both locales
    legal/<policy>/<YYYY-MM-DD>.md        # one file per version; the date is the effective date
  de-DE/                                  # same tree, German text
```
Front matter is a small YAML subset parsed by `lib/content/frontmatter.ts` (no new dependency): lines `key: value` (string; surrounding quotes optional) and `key: [a, b]` (list of strings), between two `---` lines at the top of the file. Unknown keys are ignored. Missing required key → the loader throws `ContentError('<file>: missing <key>')` (a build/test failure, never a runtime blank page).

| File kind | Required keys | Optional keys |
| --- | --- | --- |
| page (`about`, `faq`, `support`) | `title`, `description` | `kicker` |
| blog article | `title`, `description`, `date` (`YYYY-MM-DD`), `status` (`published` or `withdrawn`) | `updated` (`YYYY-MM-DD`), `tags` (list), `topic` (a tag slug; **required when `status: withdrawn`**) |
| legal version | `title`, `description`, `effective` (`YYYY-MM-DD`, must equal the file name) | none |

Markdown is rendered by `marked` (new dependency `marked@^18`, the same version the grocery project uses; justify in the commit message). The content is repo-authored and trusted, so there is **no sanitizer**; never pass user input through it. `lib/content/markdown.ts` `renderMarkdown(md: string, locale: ContentLocale): string` adds one rule: a link whose `href` starts with a single `/` (not `//`) is rewritten to `/<locale>` + href, so authors write `[Support](/support)` and `de-DE` readers stay in `de-DE`. Links starting with `https://` get `rel="noopener noreferrer"` and `target="_blank"`.

### Modules (new, all in W's area; names are binding for later workstreams)
| Path | Exports |
| --- | --- |
| `lib/content/types.ts` | `type ContentLocale = 'en-US' \| 'de-DE'`, `const FALLBACK_LOCALE: ContentLocale = 'en-US'`, `interface ContentOptions { root?: string; now?: Date }` (`root` defaults to `path.join(process.cwd(), 'content')`; tests pass a temp directory), `class ContentError extends Error` |
| `lib/content/frontmatter.ts` | `parseFrontMatter(raw: string): { data: Record<string, string \| string[]>; body: string }` |
| `lib/content/markdown.ts` | `renderMarkdown(md, locale)`, `stripHtml(html): string` (plain text for JSON-LD) |
| `lib/content/pages.ts` | `getPage(slug: 'about' \| 'faq' \| 'support', locale, opts?): PageDoc \| null` where `PageDoc = { slug; title; description; kicker?: string; html: string; servedLocale: ContentLocale; fallback: boolean }`. Slug and locale are validated against `/^[a-z0-9-]+$/` and the two locales, so no path traversal |
| `lib/content/faq.ts` | `getFaq(locale, opts?): Faq`, see FAQ below |
| `lib/content/blog.ts` | `listArticles`, `getArticle`, `getRelated`, `listTags`, see Blog below |
| `lib/content/policies.ts` | `LEGAL_SLUGS`, `getPolicy`, `listVersions`, `legalPath(policy)`, see Policies below |
| `lib/content/credits.ts` | `getImageCredits(opts?): { photographer: string; url: string }[]` |
| `lib/content/format.ts` | `formatDate(iso: string, locale): string` = `new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'))` |
| `lib/content/jsonld.ts` | `articleJsonLd`, `faqJsonLd`, `serializeJsonLd(obj): string` |
| `lib/config/site.ts` | `SITE_URL: string` = `process.env.SITE_URL ?? process.env.URL ?? 'http://localhost:3000'` with trailing slashes removed (`URL` is set by Netlify at build; `SITE_URL` is optional and lets the owner force the production domain; Y lists it) |
| `lib/config/contact.ts` | `SUPPORT_EMAIL = 'support@malva.example'` (placeholder, replaced in SO-09), `supportMailto(locale): string` |
| `components/content/` | `ContentArticle.tsx`, `FallbackNotice.tsx`, `FaqSections.tsx` (server), `FaqAccordion.tsx` (client), `BlogCard.tsx`, `BlogFilters.tsx`, `PolicyLink.tsx`, `ContactCard.tsx`, `FooterLegalLinks.tsx`, `JsonLd.tsx` |

### Layout (tokens from `design/DESIGN.md`; Malva pages were not drawn in the prototype, SO-09 covers them)
Every page: kicker (Exo 600 14px, 1px tracking, `brand-700`), H1 (Exo 700, 40px, `brand-950`), body column max 720 px (Roboto 16px / 1.75, `--color-text`), links `pink-700` (hover `pink-800`), 80 px top padding, 40 px side padding at ≥ 768 px and 20 px below. Use token names only (no raw hex). Content width is `max-w-[720px]` expressed via the container token already defined by C; if C has no 720 px token, add `--content-width-prose: 720px` to the `@theme` extension block of `app/globals.css` (append-only; C owns the file).

### Locale fallback (spec: "Locale without translation", "Answer not translated", "Policy not translated")
`FALLBACK_LOCALE = 'en-US'`. A loader asked for `de-DE` that finds no German file returns the `en-US` document with `servedLocale: 'en-US'`, `fallback: true`. The page then:
1. renders `<FallbackNotice />` above the title: de-DE text `content.fallbackNotice` (below) and wraps the English body in `<div lang="en">`;
2. sets metadata `robots: { index: false, follow: true }` and `alternates.canonical` to the `en-US` URL.
A request for `en-US` never falls back. There is no third language.

### About (`/about`)
`content/<locale>/about.md`. **Planner default (open question "which claims are legally controlled"):** the v1 page makes **no** certification, compliance, regulatory, award, coverage-percentage or superlative claims. A unit test scans the file (both locales) for the forbidden words below; adding any such claim later requires owner sign-off recorded as SO-09 re-approval before the change is merged. **Planner default (open question "referral attribution"):** the sales call-to-action is a plain link to `/support`; it does not carry the referring page (no consent policy exists, D-059).
Forbidden words (case-insensitive, whole word): `certified`, `certification`, `accredited`, `ISO`, `SOC`, `GDPR-compliant`, `award`, `award-winning`, `best`, `fastest`, `#1`, `guarantee`, `guaranteed`, `licensed`, `zertifiziert`, `Zertifizierung`, `ausgezeichnet`, `beste`, `schnellste`, `garantiert`, `Garantie`, `lizenziert`.

Exact `content/en-US/about.md`:
```markdown
---
title: About Malva Telecom
description: Malva Telecom sells cable internet, home wireless internet, phone plans and add-ons, with the full price shown before you order.
kicker: About us
---
## What we do
Malva Telecom sells cable internet, home wireless internet, phone plans and add-ons such as streaming services and equipment. Every plan shows its monthly price, its contract term and any introductory price before you order.

## How we work
My bundle shows the full price schedule for everything you pick, and every internet plan comes with a Broadband Facts label, so you can compare plans on the same terms.

## Talk to us
Questions about a plan or an order? Read the [frequently asked questions](/faq) or [contact support](/support).
```
Exact `content/de-DE/about.md`:
```markdown
---
title: Über Malva Telecom
description: Malva Telecom verkauft Kabel-Internet, Heim-Funk-Internet, Mobilfunktarife und Zusatzleistungen, mit dem vollständigen Preis vor der Bestellung.
kicker: Über uns
---
## Was wir tun
Malva Telecom verkauft Kabel-Internet, Heim-Funk-Internet, Mobilfunktarife und Zusatzleistungen wie Streaming-Dienste und Geräte. Jeder Tarif zeigt vor der Bestellung den Monatspreis, die Vertragslaufzeit und einen möglichen Einführungspreis.

## So arbeiten wir
Mein Paket zeigt den vollständigen Preisverlauf für alles, was Sie auswählen, und jeder Internettarif hat ein Breitband-Informationsblatt, damit Sie Tarife unter gleichen Bedingungen vergleichen können.

## Sprechen Sie mit uns
Fragen zu einem Tarif oder einer Bestellung? Lesen Sie die [häufigen Fragen](/faq) oder [kontaktieren Sie den Support](/support).
```
(`Mein Paket` and `Breitband-Informationsblatt` must match the strings D/I/M use for "My bundle" and the label; if M's German differs, copy M's strings. Flagged machine-translated in `plan/IDEAS.md` per D-004.)

### FAQ (`/faq`, `/support`)
**Authoring format** (`content/<locale>/faq.md`): front matter (`title`, `description`, `kicker`), then topics as `## Topic title {#topic-id}` and questions as `### Question text {#question-id}` followed by answer markdown until the next heading. The ids are lowercase `[a-z0-9-]+`, **identical in both locales**, unique across the file, and are the DOM ids and deep-link anchors. A heading without `{#id}` makes the loader throw `ContentError`.

```ts
export interface FaqItem { id: string; question: string; answerHtml: string; answerText: string; fallback: boolean } // fallback: served in en-US
export interface FaqTopic { id: string; title: string; items: FaqItem[] }
export interface Faq { page: PageDoc; topics: FaqTopic[] }
getFaq(locale: ContentLocale, opts?: ContentOptions): Faq
```
`getFaq('de-DE')` **merges per question**: the question ids and order come from the `en-US` file; each id uses the German text if present, else the English text with `fallback: true`. A topic title missing in German is served in English the same way. (`answerText` = `stripHtml(answerHtml)`.)

**Rendering (spec: answers readable and indexable without expanding):**
- `FaqSections` (server) renders, for each topic, `<section id="{topicId}" aria-labelledby="{topicId}-h">` with an `<h2 id="{topicId}-h">` and, for each question, a native `<details id="{questionId}" open>` containing `<summary>` (the question, styled as a button row with a chevron icon) and the answer HTML. **Every `<details>` carries the `open` attribute in the server HTML**, so a crawler, a reader with scripts disabled, and assistive technology all see every answer.
- A `<nav aria-label="Topics">` above the list links to every `#topicId` so other topics stay reachable.
- `FaqAccordion` (client, `'use client'`, wraps the list) is the progressive enhancement: in a `useEffect` on mount it closes every `<details>` **except** the one whose `id` equals `location.hash.slice(1)` (or the `<details>` that contains the element with that id), scrolls that one into view (`scrollIntoView({ block: 'start' })`), and listens to `hashchange` to repeat the same. No other behaviour: reader toggling uses the native `<details>` mechanics (Enter/Space on `<summary>` work without code). It never fetches. One-open-at-a-time is **not** required.
- Deep links with scripts disabled land on the open answer because all are open (spec: "Deep link to one question").
- Pitfall: do not use `hidden`, `display:none`, `aria-hidden` or lazy fetch for closed answers.
- `FAQPage` JSON-LD on `/faq` only (not on `/support`, to avoid two pages claiming the same questions): `{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":answerText}}]}`.

**No helpfulness vote. Planner default** (open question "unhelpful vote routing"): there is no "Was this helpful?" control and no analytics (D-034 static content, D-059). The original scenario needs a feedback endpoint, so it is listed in Excluded.
**Planner default** (open question "answers restating policy, price or lead time"): FAQ, About and blog text never state a price or a number of days; they link to the policy page or the shop, so there is one source of truth. A unit test fails if the three content kinds contain `$`, `€`, `USD`, `EUR`, or `\d+\s*(day|days|business days|Tag|Tage|Werktage)`.

Exact `content/en-US/faq.md` (German in the table after it):
```markdown
---
title: Frequently asked questions
description: Answers about billing, cancelling, internet service and phones at Malva Telecom.
kicker: Help
---
## Orders and billing {#orders-billing}

### When am I charged? {#when-am-i-charged}
Monthly service lines are billed every month once your service starts. Equipment and phones bought outright are charged when you place your order. The exact schedule is shown in My bundle before you pay.

### What happens when an introductory price ends? {#intro-pricing}
My bundle shows the introductory period and the price that follows it before you order. The same schedule is on your order page.

### Can I cancel my order? {#cancel-order}
Yes, from your order page until your service start date. The [Shipping and returns policy](/legal/shipping-returns) has the details.

## Internet service {#internet-service}

### How do I know if internet reaches my address? {#check-address}
Open a cable or home wireless plan and enter your ZIP code. The page tells you which plans are available there.

### What is the difference between cable and home wireless internet? {#cable-vs-wireless}
Cable internet arrives over a wired connection and needs an installation visit. Home wireless internet uses a mobile network and comes with a receiver you plug in. Our article [Cable or home wireless](/blog/cable-or-home-wireless) compares them.

### What is the Broadband Facts label? {#broadband-label}
It is a standard summary of price, speeds and fees for an internet plan. Read [how to read the label](/blog/reading-the-broadband-facts-label).

## Phones and devices {#phones-devices}

### Can I add more than one phone line? {#second-line}
Yes. Choose the number of lines on the phone plan. Any discount for extra lines is shown in My bundle.

### Can I pay for a phone in installments? {#device-installments}
Phones can be bought outright, in installments or leased. Installments and leases depend on a credit decision shown at checkout.

### Can I return a phone? {#return-device}
Yes. Request a return from your order page within the return period in the [Shipping and returns policy](/legal/shipping-returns).
```
| Id | de-DE text (question / answer) |
| --- | --- |
| topics | Bestellung und Abrechnung / Internet-Anschluss / Handys und Geräte |
| `when-am-i-charged` | Wann wird mir etwas berechnet? / Monatliche Leistungen werden jeden Monat abgerechnet, sobald Ihr Anschluss startet. Geräte und Telefone, die Sie direkt kaufen, werden bei der Bestellung berechnet. Den genauen Verlauf zeigt Mein Paket vor der Zahlung. |
| `intro-pricing` | Was passiert, wenn ein Einführungspreis endet? / Mein Paket zeigt vor der Bestellung den Einführungszeitraum und den Preis danach. Denselben Verlauf finden Sie auf Ihrer Bestellseite. |
| `cancel-order` | Kann ich meine Bestellung stornieren? / Ja, auf Ihrer Bestellseite bis zum Starttermin Ihres Anschlusses. Details stehen in den [Versand- und Rückgaberichtlinien](/legal/shipping-returns). |
| `check-address` | Woher weiß ich, ob Internet meine Adresse erreicht? / Öffnen Sie einen Kabel- oder Heim-Funk-Tarif und geben Sie Ihre Postleitzahl ein. Die Seite zeigt, welche Tarife dort verfügbar sind. |
| `cable-vs-wireless` | Was ist der Unterschied zwischen Kabel- und Heim-Funk-Internet? / Kabel-Internet kommt über eine feste Leitung und braucht einen Installationstermin. Heim-Funk-Internet nutzt ein Mobilfunknetz und kommt mit einem Empfänger zum Einstecken. Unser Artikel [Kabel oder Heim-Funk](/blog/cable-or-home-wireless) vergleicht beide. |
| `broadband-label` | Was ist das Breitband-Informationsblatt? / Es ist eine einheitliche Zusammenfassung von Preis, Geschwindigkeit und Gebühren eines Internettarifs. Lesen Sie, [wie man es liest](/blog/reading-the-broadband-facts-label). |
| `second-line` | Kann ich mehr als eine Mobilfunkleitung hinzufügen? / Ja. Wählen Sie die Anzahl der Leitungen beim Mobilfunktarif. Ein Rabatt für weitere Leitungen steht in Mein Paket. |
| `device-installments` | Kann ich ein Telefon in Raten bezahlen? / Telefone können direkt gekauft, in Raten bezahlt oder geleast werden. Raten und Leasing hängen von einer Bonitätsprüfung ab, die an der Kasse angezeigt wird. |
| `return-device` | Kann ich ein Telefon zurückgeben? / Ja. Beantragen Sie die Rückgabe auf Ihrer Bestellseite innerhalb der Rückgabefrist aus den [Versand- und Rückgaberichtlinien](/legal/shipping-returns). |

Front matter German: `title: Häufige Fragen`, `description: Antworten zu Abrechnung, Stornierung, Internet und Telefonen bei Malva Telecom.`, `kicker: Hilfe`.

### Support (`/support`) and contact (D-034: `mailto:` only, no form, no storage)
`content/<locale>/support.md` holds front matter and one intro paragraph (en-US: title `Support`, description `Find answers or email Malva Telecom support.`, kicker `Help`, body `Most questions are answered below. If yours is not, email us.`; de-DE: `Support`, `Antworten finden oder dem Malva-Telecom-Support schreiben.`, `Hilfe`, `Die meisten Fragen beantworten wir unten. Wenn Ihre fehlt, schreiben Sie uns.`).
Page body order: H1, intro, `ContactCard`, "Popular questions" (the **first question of each topic** from `getFaq`, rendered with the same `FaqSections` markup so the answers are in the HTML), link "All questions" to `/faq`.
`ContactCard`: heading `content.contact.heading`, the address as visible text (so it can be copied when no mail app is configured) **and** an `<a href="mailto:support@malva.example?subject=<encodeURIComponent(content.contact.subject)>">` styled as the primary Button. No body prefill, no referrer, no account id (**Planner default** for open question "does an authenticated buyer's enquiry carry an identifier": no). Note line `content.contact.note` tells the reader not to send card numbers or passwords (**Planner default** for the retention/consent open question: we store nothing; the email lives in the reader's own mailbox and the supplier's mail system). There is no `<form>`, no `/api/contact` route, no chat script, no offices block (D-034, D-059).

### Policies (`/legal/[policy]`)
`LEGAL_SLUGS = ['shipping-returns', 'terms', 'privacy', 'image-credits'] as const`. `legalPath(policy)` returns `/legal/${policy}` (locale-agnostic; callers use the i18n `Link`).
Version files: `content/<locale>/legal/<policy>/<YYYY-MM-DD>.md`. Seed set (both locales): `shipping-returns/2025-06-01.md` (earlier version), `shipping-returns/2026-01-01.md`, `terms/2026-01-01.md`, `privacy/2026-01-01.md`, `image-credits/2026-01-01.md`.
```ts
export interface PolicyDoc {
  policy: LegalSlug; title: string; description: string; html: string;
  effective: string;              // 'YYYY-MM-DD' of the version shown
  servedLocale: ContentLocale; fallback: boolean;
  superseded: boolean;            // true only when asOf selected an older version
  supersededOn?: string;          // effective date of the next version (the day it was replaced)
  currentEffective: string;       // effective date of the version in force today
  earlier: string[];              // effective dates of all versions older than `effective`, newest first
}
getPolicy(policy: string, locale: ContentLocale, opts?: ContentOptions & { asOf?: string }): PolicyDoc | null
```
Selection rule: `reference = asOf ?? today(UTC from opts.now)`; the version is the file with the **largest `effective` ≤ reference**; none (e.g. `asOf=2020-01-01`) → `null` → `notFound()`. A file dated in the future is invisible until its date (scheduling a new version = commit the file in advance). `asOf` must match `/^\d{4}-\d{2}-\d{2}$/` and be a real date, else it is ignored (treated as today). If the locale has **no** version files at all for the policy, the whole `en-US` set is used with `fallback: true`. The front matter `effective` must equal the file name, else `ContentError`.
Page shows, under the H1: `content.legal.effective` ("In effect since {date}", `formatDate`). When `superseded`: a banner with `content.legal.superseded` and a link `content.legal.viewCurrent` to the plain `/legal/<policy>`. When `earlier.length > 0` or `superseded`: an "Earlier versions" list `content.legal.earlier` linking each date to `/legal/<policy>?asOf=<date>`. This is the answer to the three open questions:
1. **System of record for superseded versions (Planner default):** git history plus the dated files themselves, which are never deleted or edited after their effective date; `?asOf=` produces the text in force on any past order date.
2. **Regional variants (Planner default):** none. One text per locale; `en-US` is the US market and `de-DE` the DE market (D-004), chosen by the URL locale only.
3. **Re-consent for open standing orders (Planner default):** not built. Material changes ship as a new dated file; no consent is recorded (D-059). Orders do not store the policy version in v1.
`export const revalidate = 3600` on this page so a newly effective version appears within an hour. **Pitfall:** the "current version" depends on the date, so these pages must not be fully static forever; do not remove `revalidate`.
`PolicyLink` (`components/content/PolicyLink.tsx`): props `{ policy: LegalSlug; children: ReactNode; className?: string }`, renders the locale-aware `Link` to `/legal/<policy>` with `target="_blank"` and `rel="noopener noreferrer"`. **Checkout (U) must use it for the consent text** so a buyer reading a policy never leaves the checkout tab (spec: "Opened from checkout"); this is a cross-workstream interface not listed in ARCHITECTURE.md.

Policy copy (en-US; each file 120–200 words, written from these outlines, German a faithful translation). Marked as placeholder, real legal text needs the owner (SO-09):
| File | Title | Content outline (no numbers of days or prices, see FAQ rule; link to the shop and My bundle instead) |
| --- | --- | --- |
| `shipping-returns/2025-06-01.md` | Shipping and returns | Earlier version: equipment ships to the order address; returns are accepted for unused equipment (short, differs from 2026 text by saying "returns are accepted on request") |
| `shipping-returns/2026-01-01.md` | Shipping and returns | Equipment and phones ship to the address chosen at checkout; digital items need no shipping; cancel an order from the order page until the service start date; request a phone return from the order page within the return period shown there; processing of returns is described as "we will confirm the return on your order page" |
| `terms/2026-01-01.md` | Terms and conditions | Who may order, plans are monthly service lines billed monthly, contract terms shown before ordering, introductory prices end as shown in My bundle, early termination fee is shown on the plan's label, demo-store notice |
| `privacy/2026-01-01.md` | Privacy policy | What we store (account, addresses, orders), that no marketing email is sent, session cookie purpose, locale/market cookie purpose, no analytics, how to ask for deletion (by emailing support) |
| `image-credits/2026-01-01.md` | Image credits | Text below |

`image-credits` text (en-US body): `Photographs on this site come from [Pexels](https://www.pexels.com). Each photograph belongs to its photographer; the photographer is named in the image description and listed below.` followed by the page-generated list (de-DE: `Die Fotos auf dieser Seite stammen von [Pexels](https://www.pexels.com). Jedes Foto gehört seiner Fotografin oder seinem Fotografen; der Name steht in der Bildbeschreibung und in der Liste unten.`). The page renders `getImageCredits()` as a list `content.credits.photoBy` ("Photo by {name} on Pexels") linking to the photo URL, de-duplicated by photographer name and sorted alphabetically.
`getImageCredits(opts)` reads the lock file written by G (`scripts/seed/data/product-images.json`, D-055; **cross-workstream interface not in ARCHITECTURE.md**): it accepts any JSON object whose values are objects (or arrays of objects) with a string `photographer` and a string `photoUrl` (or `url`); entries without a photographer are skipped; a missing or unparsable file returns `[]` and the page then shows only the generic paragraph. Add `./scripts/seed/data/product-images.json` to `outputFileTracingIncludes` so Netlify bundles it.
Footer: W appends `components/content/FooterLegalLinks.tsx` to `components/layout/SiteFooter.tsx` (owned by I; append only: one extra `<nav aria-label>` row below the existing links, existing markup and tests untouched). Links: About, FAQ, Blog, Shipping and returns, Terms, Privacy, Image credits. Messages `content.footer.*`.

### Blog
```ts
export interface ArticleSummary { slug: string; title: string; description: string; date: string; updated?: string; tags: string[]; servedLocale: ContentLocale; fallback: boolean }
export interface Article extends ArticleSummary { html: string }
export type ArticleResult = { kind: 'article'; article: Article } | { kind: 'withdrawn'; slug: string; topic: string } | null
listArticles(locale, filter: { tags?: string[] }, opts?): { articles: ArticleSummary[]; allTags: string[] }   // published only, newest date first, tags AND-filtered
getArticle(slug: string, locale, opts?): ArticleResult                                                      // null = unknown slug
getRelated(article: ArticleSummary, locale, opts?, limit = 3): ArticleSummary[]
```
- `listArticles` for `de-DE` = union of slugs from both locales, each article using the German file when present, else the English one with `fallback: true`. Withdrawn articles are never listed. `allTags` = sorted unique tags of the unfiltered published set.
- Query parsing in the page: `searchParams.tag` string or array → each value must match `/^[a-z0-9-]{1,30}$/`, de-duplicated, first 3 kept, others dropped. A tag that exists nowhere simply matches nothing.
- **Filter matches nothing:** the page shows `content.blog.noMatch` in an element with `role="status"`, still renders `BlogFilters` with every applied tag as a removable chip (link to the same URL minus that tag, accessible name `content.blog.removeFilter`), and a `content.blog.clearAll` link to `/blog`. Removing one chip at a time works because each chip link keeps the other tags.
- **Article withdrawn:** `getArticle` returns `{ kind: 'withdrawn', topic }` when `status: withdrawn`; the body is never read into the result (a test puts secret text in the file and asserts it is absent). The page renders HTTP 200 (App Router pages cannot set 410; **Planner default**), `robots: { index: false, follow: true }`, H1 `content.blog.withdrawnTitle`, and a link `content.blog.withdrawnLink` to `/blog?tag=<topic>`. The file stays in git (history of what was published).
- **Article without tags:** `tags` empty (or missing) → `getRelated` returns `[]` → the page omits the whole "Related articles" block (no heading either). Related = other published articles sharing at least one tag, newest first, max 3.
- Slugs are the file names: stable, lowercase `[a-z0-9-]+`, identical in both locales, and never renamed after publishing (a rename means a new file; leave the old one as `status: withdrawn` with a `topic`). **Open question "address space collision"**: `/blog/[slug]` has its own prefix and cannot collide with `/shop/[slug]` (D-052). **Open question "gated resources"**: not built (D-034 has no forms).
- `generateMetadata` for an article: `title`, `description`, `alternates: { canonical: `${SITE_URL}/${locale}/blog/${slug}`, languages: { 'en-US': …, 'de-DE': … } }` (a language entry only where that locale's file exists), `openGraph: { type: 'article', title, description, url: canonical, locale, publishedTime: date, modifiedTime: updated ?? date }`. For a fallback-served article, canonical is the `en-US` URL and `robots` is `noindex`.
- JSON-LD (`articleJsonLd`): `{"@context":"https://schema.org","@type":"Article","headline":title,"description":description,"datePublished":date,"dateModified":updated ?? date,"inLanguage":servedLocale,"mainEntityOfPage":{"@type":"WebPage","@id":canonical},"author":{"@type":"Organization","name":"Malva Telecom"},"publisher":{"@type":"Organization","name":"Malva Telecom"}}`. `serializeJsonLd` = `JSON.stringify(obj).replace(/</g, '\\u003c')` placed in `<script type="application/ld+json">` by `JsonLd.tsx` (**pitfall:** without the `<` escape, text containing `</script>` breaks the page).
- Listing page metadata: title/description from messages `content.blog.title` / `content.blog.description`; canonical `${SITE_URL}/${locale}/blog` (the `?tag=` variants canonicalise to the plain listing).

Seed articles (both locales, identical slugs; each 150–220 words written from the outline, no prices, no day counts, no certification claims):
| Slug | `title` (en-US) | `description` | `date` | `tags` | Outline |
| --- | --- | --- | --- | --- | --- |
| `cable-or-home-wireless` | Cable or home wireless: which internet fits you? | A plain comparison of cable and home wireless internet. | 2026-09-02 | `[internet]` | What each is; installation visit vs plug-in receiver; when a wired connection fits; check availability by ZIP code on the plan page |
| `reading-the-broadband-facts-label` | How to read the Broadband Facts label | What the label on every internet plan tells you. | 2026-09-16 | `[internet, labels]` | Monthly price, introductory price, fees, speeds; compare two plans label to label; link to the shop |
| `what-intro-pricing-means` | What an introductory price means | How introductory and stepped prices appear in My bundle. | 2026-09-30 | `[pricing, phone, internet]` | Intro period starts at order date (D-023); price that follows is shown before ordering; where to find the schedule on the order page |
German titles: `Kabel oder Heim-Funk: Welches Internet passt zu Ihnen?`, `So lesen Sie das Breitband-Informationsblatt`, `Was ein Einführungspreis bedeutet`; descriptions faithful translations. Tag labels `content.tags.*`: internet, phone, pricing, labels.

### Messages (add to BOTH `messages/en-US.json` and `messages/de-DE.json`, namespace `content`)
| Key | en-US | de-DE |
| --- | --- | --- |
| `content.fallbackNotice` | This page is not available in this language yet. Showing the English version. | Diese Seite ist in dieser Sprache noch nicht verfügbar. Es wird die englische Version angezeigt. |
| `content.faq.topicsNav` | Topics | Themen |
| `content.faq.allQuestions` | All questions | Alle Fragen |
| `content.support.popular` | Popular questions | Häufige Fragen |
| `content.contact.heading` | Email us | Schreiben Sie uns |
| `content.contact.cta` | Email support | E-Mail an den Support |
| `content.contact.subject` | Malva Telecom support request | Anfrage an den Malva-Telecom-Support |
| `content.contact.note` | Please do not include payment card numbers or passwords in your email. | Bitte senden Sie keine Zahlungskartennummern oder Passwörter per E-Mail. |
| `content.blog.title` | Blog | Blog |
| `content.blog.description` | Guides to internet, phone plans and prices. | Ratgeber zu Internet, Mobilfunktarifen und Preisen. |
| `content.blog.filterLabel` | Filter by topic | Nach Thema filtern |
| `content.blog.clearAll` | Clear filters | Filter zurücksetzen |
| `content.blog.removeFilter` | Remove filter: {tag} | Filter entfernen: {tag} |
| `content.blog.noMatch` | No articles match these filters. | Keine Artikel passen zu diesen Filtern. |
| `content.blog.publishedOn` | Published {date} | Veröffentlicht am {date} |
| `content.blog.related` | Related articles | Weitere Artikel |
| `content.blog.withdrawnTitle` | This article is no longer available | Dieser Artikel ist nicht mehr verfügbar |
| `content.blog.withdrawnLink` | See {topic} articles | Artikel zu {topic} ansehen |
| `content.tags.internet` / `phone` / `pricing` / `labels` | Internet / Phone / Pricing / Labels | Internet / Mobilfunk / Preise / Informationsblätter |
| `content.legal.effective` | In effect since {date} | Gültig seit {date} |
| `content.legal.superseded` | This is a superseded version. It was in effect until {until}. | Dies ist eine ersetzte Version. Sie galt bis {until}. |
| `content.legal.viewCurrent` | View the current version | Aktuelle Version ansehen |
| `content.legal.earlier` | Earlier versions | Frühere Versionen |
| `content.credits.photoBy` | Photo by {name} on Pexels | Foto von {name} auf Pexels |
| `content.footer.label` | Company and legal | Unternehmen und Rechtliches |
| `content.footer.about` / `faq` / `blog` / `shippingReturns` / `terms` / `privacy` / `imageCredits` | About us / FAQ / Blog / Shipping and returns / Terms / Privacy / Image credits | Über uns / Häufige Fragen / Blog / Versand und Rückgabe / Bedingungen / Datenschutz / Bildnachweise |
`{until}` = `formatDate(supersededOn minus one day)`; `{date}` = `formatDate(...)`; `{topic}` = the `content.tags.<topic>` label (raw slug if no label).

### Spec amendment text for `contact-us` (D-034 says W amends the spec)
Task W-09 appends a `## Plan notes` section to `openspec/specs/contact-us/spec.md` (do **not** add `#### Scenario:` lines, `plan/verify-plan.mjs` would then demand new coverage rows). The text to append, verbatim:
```
## Plan notes
D-034 narrows this capability: the contact page is static content with a `mailto:` link, no form and no storage. The four scenarios above are not built. Replacement behaviour (tested in workstream W): (1) the page offers a `mailto:` link to the support address with a localized subject and shows the address as text; (2) the page contains no form and sends nothing, so it never reports an enquiry as delivered; the reader's own mail client reports sending; (3) the page contains no chat script or placeholder; (4) the page lists the email channel for every visitor and never renders an empty offices block.
```
Also append to `openspec/specs/faq/spec.md` a `## Plan notes` paragraph: `The "Was this helpful?" feedback component is not built (no analytics, D-034/D-059); the scenario "Feedback collector unreachable" is replaced by the absence of any vote control.` And to `about-us`: `Content changes are files in git deployed with the site (D-034); the "without a storefront deployment" clause of "Editor publishes a correction" does not apply.` Z-01 only verifies that these three notes exist.

### Pitfalls
- Content is read from disk at request/build time. `next.config.ts` (owned by A, W appends) must contain `outputFileTracingIncludes: { '/**': ['./content/**/*', './scripts/seed/data/product-images.json'] }` or Netlify functions will not find the files (grocery lesson). Merge with an existing `outputFileTracingIncludes` if present; never replace it.
- Markdown internal links must be written without a locale (`/faq`); the renderer adds it. A link written as `/en-US/faq` would break `de-DE`.
- A `<details>` without `open` in the server HTML silently removes the answer from the "readable without expanding" guarantee; the unit test asserts every `<details` in `FaqSections` output contains ` open`.
- `FaqAccordion` must run its collapse in `useEffect` (not during render) or React reports a hydration mismatch.
- Dates are `YYYY-MM-DD` strings compared lexicographically in UTC; never `new Date(string)` local-time comparisons.
- `de-DE` fallback sets `noindex`; do not index duplicate English text under German URLs.
- The Netlify build has no `content/` write access at runtime; nothing here writes files.
- JSON-LD text comes from the same markdown; strip HTML and escape `<` (see above).

## Tasks
- [x] W-01 Add dependency `marked@^18` (`npm install marked@^18`), `lib/content/types.ts`, `frontmatter.ts`, `markdown.ts` (locale-prefixing links, external link attributes, `stripHtml`), `format.ts`, `lib/config/site.ts`, `lib/config/contact.ts`; write `lib/content/frontmatter.test.ts`, `markdown.test.ts`, `format.test.ts`, `lib/config/site.test.ts`, `lib/config/contact.test.ts` (front matter strings/lists/quotes/missing delimiter; link rewrite `/faq` → `/de-DE/faq`, `//x` untouched, `https://` gets `target`/`rel`; `SITE_URL` precedence `SITE_URL` > `URL` > localhost, trailing slash stripped; `formatDate('2026-01-01','de-DE')` = `1. Januar 2026`).
- [x] W-02 Write `lib/content/pages.ts` (`getPage` with locale fallback and slug validation), `components/content/ContentArticle.tsx`, `FallbackNotice.tsx`, `JsonLd.tsx`; add `outputFileTracingIncludes` to `next.config.ts` (append); write `app/[locale]/about/page.tsx` and both `about.md` files; tests `lib/content/pages.test.ts`, `app/[locale]/about/page.test.tsx` (title from front matter; German served for `de-DE`; fallback when the German file is absent; slug `../x` rejected; page module has no `@/lib/ct` import; renders when `@/lib/ct/*` throws; no forbidden words in both about files).
- [x] W-03 Write `lib/content/faq.ts` (parser, per-question merge, `{#id}` enforcement), `components/content/FaqSections.tsx`, `FaqAccordion.tsx`, `lib/content/jsonld.ts` (`faqJsonLd`, `serializeJsonLd`), `app/[locale]/faq/page.tsx`, both `faq.md` files; tests `lib/content/faq.test.ts`, `components/content/FaqSections.test.tsx`, `FaqAccordion.test.tsx`, `app/[locale]/faq/page.test.tsx` (every `<details>` has `open`; topic nav links to every topic; hash collapse behaviour; de-DE merge with a missing question flagged fallback; no vote control; JSON-LD parses and contains 9 questions; no-price/no-days lint over faq files).
- [x] W-04 Write `lib/content/policies.ts` (`LEGAL_SLUGS`, `listVersions`, `getPolicy`, `legalPath`), `components/content/PolicyLink.tsx`, `app/[locale]/legal/[policy]/page.tsx` (`revalidate = 3600`, banner, earlier-versions list), the five seed files per locale under `content/<locale>/legal/`; tests `lib/content/policies.test.ts` (temp-dir fixtures: newest ≤ today wins; future-dated file hidden; `asOf` selects older version and sets `superseded`/`supersededOn`; invalid `asOf` ignored; `asOf` before first version → null; locale without files → English with `fallback`; front matter date ≠ file name throws), `PolicyLink.test.tsx`, `app/[locale]/legal/[policy]/page.test.tsx` (effective date text; banner; unknown policy → `notFound`; no cart/session import).
- [x] W-05 Write `lib/content/credits.ts` (tolerant reader of `scripts/seed/data/product-images.json`), the image-credits page list in `legal/[policy]/page.tsx`, `components/content/FooterLegalLinks.tsx`, append it to `components/layout/SiteFooter.tsx`; tests `lib/content/credits.test.ts` (dedupe + sort; missing file → `[]`; entries without photographer skipped; non-array values accepted), `FooterLegalLinks.test.tsx` (seven links, locale-aware hrefs), and re-run I's footer test unchanged.
- [ ] W-06 Write `lib/content/blog.ts` (`listArticles`, `getArticle`, `getRelated`, `listTags`) and the three article files per locale; tests `lib/content/blog.test.ts` with temp-dir fixtures (published only, newest first, AND filter, withdrawn → `{kind:'withdrawn'}` without body text, tagless article → no related, `de-DE` union with fallback flag, missing slug → null, invalid slug characters rejected).
- [ ] W-07 Write `components/content/BlogCard.tsx`, `BlogFilters.tsx`, `app/[locale]/blog/page.tsx` (filter parsing, no-match state with removable chips, `role="status"`), `app/[locale]/blog/[slug]/page.tsx` (article, JSON-LD, metadata, related block, withdrawn notice), `articleJsonLd`; tests `BlogFilters.test.tsx`, `app/[locale]/blog/page.test.tsx`, `app/[locale]/blog/[slug]/page.test.tsx` (metadata title/description/canonical/openGraph; JSON-LD fields; related block omitted for tagless; withdrawn text absent and topic link present; fallback article `noindex`).
- [ ] W-08 Write `components/content/ContactCard.tsx`, `app/[locale]/support/page.tsx`, both `support.md` files; tests `components/content/ContactCard.test.tsx`, `app/[locale]/support/page.test.tsx` (the Replacement behaviour tests; mailto href exact; no `form`, `script`, `iframe`; one question per topic with `open`; link to `/faq`; no `/api/contact` route file exists: `existsSync('app/api/contact')` is false).
- [ ] W-09 Add all `content.*` messages to both message files with a parity test `messages/content-parity.test.ts` (same key set in both locales, `{placeholders}` equal); write `test/content-lint.test.ts` (no `$`/`€`/`USD`/`EUR`/day-count in faq, about and blog files of both locales; all FAQ ids identical across locales; every blog slug present in both locales; every policy folder has the same version dates in both locales; internal markdown links resolve to existing routes (`/faq`, `/support`, `/about`, `/blog/<existing slug>`, `/legal/<existing policy>`)); append the three `## Plan notes` sections to the `contact-us`, `faq`, `about-us` specs with the exact text above; add the German machine-translation flag lines to `plan/IDEAS.md` (a short "W: German copy needs native review" entry).
- [ ] W-10 Run `npm run verify` and `node plan/verify-plan.mjs`; fill in the Chrome and manual lines (already below), set STATUS `Ready for review`, ask the owner for SO-09.

## Unit tests (scenario → test)
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Commerce tier degraded | `about-us` | `app/[locale]/about/page.test.tsx` → "Commerce tier degraded: the about page renders in full when every lib/ct module throws and imports none" |
| Locale without translation | `about-us` | `lib/content/pages.test.ts` → "Locale without translation: de-DE falls back to the English file and is flagged"; `app/[locale]/about/page.test.tsx` → "Locale without translation: the fallback notice is shown and the page is noindex" |
| Deep link to one question | `faq` | `components/content/FaqAccordion.test.tsx` → "Deep link to one question: only the hash target stays open and the other topics remain linked"; `components/content/FaqSections.test.tsx` → "Deep link to one question: every details element is open in the server HTML" |
| Answer not translated | `faq` | `lib/content/faq.test.ts` → "Answer not translated: a missing German answer is served in English and flagged per question" |
| Filter matches nothing | `blog-resources` | `app/[locale]/blog/page.test.tsx` → "Filter matches nothing: states it, keeps applied filters as chips and each chip link drops only its own tag" |
| Article withdrawn | `blog-resources` | `lib/content/blog.test.ts` → "Article withdrawn: the body is never returned, only the topic"; `app/[locale]/blog/[slug]/page.test.tsx` → "Article withdrawn: notice with link to the topic, noindex, no article text" |
| Article without tags | `blog-resources` | `lib/content/blog.test.ts` → "Article without tags: no related articles"; `app/[locale]/blog/[slug]/page.test.tsx` → "Article without tags: the related block and its heading are omitted" |
| Opened from checkout | `policy-pages` | `components/content/PolicyLink.test.tsx` → "Opened from checkout: the link opens a new tab with noopener so the checkout tab is untouched"; `app/[locale]/legal/[policy]/page.test.tsx` → "Opened from checkout: the policy page imports no cart or session module" |
| Version superseded | `policy-pages` | `lib/content/policies.test.ts` → "Version superseded: the newest effective version is served with its own effective date"; `app/[locale]/legal/[policy]/page.test.tsx` → "Version superseded: asOf shows the old version with the superseded banner and a link to the current one" |
| Policy not translated | `policy-pages` | `lib/content/policies.test.ts` → "Policy not translated: the English version set is served and flagged" |

### Extra tests required by the plan (not spec scenarios)
| Test | File → `it(...)` |
| --- | --- |
| Article metadata and JSON-LD | `app/[locale]/blog/[slug]/page.test.tsx` → "article metadata has title, description, canonical, language alternates and openGraph article fields"; "article JSON-LD has headline, datePublished, dateModified, inLanguage and escapes `<`" |
| FAQ JSON-LD | `app/[locale]/faq/page.test.tsx` → "FAQPage JSON-LD lists every question with its plain-text answer" |
| Stable slugs | `test/content-lint.test.ts` → "every blog slug exists in both locales and matches [a-z0-9-]+" |
| Policy files never edited in place | `lib/content/policies.test.ts` → "front matter effective date must equal the file name" |
| No forbidden claims in About | `app/[locale]/about/page.test.tsx` → "about files contain none of the forbidden claim words" |
| No prices or day counts in prose | `test/content-lint.test.ts` → "faq, about and blog files contain no currency symbol, currency code or day count" |
| Path safety | `lib/content/pages.test.ts` → "getPage rejects slugs with dots, slashes or uppercase" |
| Image credits | `lib/content/credits.test.ts` → "credits are de-duplicated by photographer and sorted"; `app/[locale]/legal/[policy]/page.test.tsx` → "image-credits page links to https://www.pexels.com with rel noopener and lists photographers" |
| Message parity | `messages/content-parity.test.ts` → "content.* keys and placeholders match in en-US and de-DE" |

### Replacement behaviour (D-034): `contact-us` and the FAQ vote
| Replacement behaviour | Replaces | Test (file → `it(...)`) |
| --- | --- | --- |
| Replacement behaviour: the support page offers a mailto link to `support@malva.example` with a localized, URL-encoded subject and shows the address as text | the confirmed-submission scenarios | `app/[locale]/support/page.test.tsx` → "Replacement behaviour: mailto link href and visible address (en-US and de-DE)" |
| Replacement behaviour: the page has no form, no submit button and no `/api/contact` route, so nothing is ever reported as delivered | confirmed submission, routing unavailable | `app/[locale]/support/page.test.tsx` → "Replacement behaviour: no form element, no fetch call on render, no app/api/contact route" |
| Replacement behaviour: the page contains no chat script, iframe or chat placeholder | chat script absent | `app/[locale]/support/page.test.tsx` → "Replacement behaviour: no script, iframe or chat text" |
| Replacement behaviour: the email channel is listed for both locales and there is no offices block | region without an office | `components/content/ContactCard.test.tsx` → "Replacement behaviour: email channel shown, no offices heading" |
| Replacement behaviour: the mailto carries no body, referrer or account identifier | open questions on attribution and identifiers | `lib/config/contact.test.ts` → "Replacement behaviour: supportMailto has only a subject parameter" |
| Replacement behaviour: no helpfulness vote control and no network request from the FAQ | feedback collector unreachable | `components/content/FaqSections.test.tsx` → "Replacement behaviour: no vote button and no fetch call from the FAQ" |
| Replacement behaviour: a content change is a file edit and only the current file is served at the address | editor publishes a correction | `lib/content/pages.test.ts` → "Replacement behaviour: rewriting the about file changes the served text and no old copy is reachable" |

## Chrome verification (run by Claude)
Run against `npm run dev` (port 3000) unless stated. Console must be clean (no errors, no hydration warnings) and no request may fail in every check.
- C-W-1 (needs D, I): `http://localhost:3000/en-US/about` at 1440 px → kicker "About us", H1 "About Malva Telecom", three H2 sections, links "frequently asked questions" and "contact support" go to `/en-US/faq` and `/en-US/support`; the text column measures ≤ 720 px (`evaluate_script` on the article element); `<title>` contains "About Malva Telecom"; `<link rel="canonical">` is `…/en-US/about`; no `noindex` robots meta.
- C-W-2 (needs D, I): start a second dev server with `CTP_API_URL=http://127.0.0.1:9 npm run dev -- -p 3010` (commerce unreachable) and open `http://localhost:3010/en-US/about` and `/en-US/faq` → both pages show their full content; the header shows the signed-out "Log in" and an empty bundle pill; no error overlay; the dev-server log may report commerce errors but the page returns HTTP 200.
- C-W-3 (needs D, I): `http://localhost:3000/de-DE/about` → German H1 "Über Malva Telecom", kicker "Über uns", `<html lang="de-DE">`, no fallback notice; footer and header in German.
- C-W-4 (needs D, I): fallback. Temporarily rename `site/content/de-DE/blog/what-intro-pricing-means.md` to `.bak`, load `/de-DE/blog/what-intro-pricing-means` → the German notice "Diese Seite ist in dieser Sprache noch nicht verfügbar…" above the English article (`lang="en"` wrapper), `<meta name="robots" content="noindex…">`, canonical points to `/en-US/blog/what-intro-pricing-means`; restore the file and reload → German article without notice.
- C-W-5 (needs D, I): `http://localhost:3000/en-US/faq` at 1440 px → H1 "Frequently asked questions", topic nav with "Orders and billing", "Internet service", "Phones and devices"; `evaluate_script(() => fetch(location.href).then(r => r.text()))` returns HTML containing all nine answers' text (for example "Monthly service lines are billed every month") and nine `<details` each with ` open` (this is the indexable server HTML); after hydration every answer is collapsed; clicking a question expands it; Tab to a `summary` and Space/Enter toggles it; the JSON-LD script parses as `FAQPage` with 9 questions.
- C-W-6 (needs D, I): `http://localhost:3000/en-US/faq#cancel-order` → "Can I cancel my order?" is open and scrolled into view (`getBoundingClientRect().top` within the viewport), the other eight are closed; click the topic nav link "Phones and devices" → that section scrolls into view; no element with text "helpful" and no request other than page assets.
- C-W-7 (needs D, I): resize to 375 px and open `/en-US/faq` and `/en-US/support` → no horizontal scroll (`document.documentElement.scrollWidth <= 375`), summaries are at least 44 px tall, text column fills the width with 20 px side padding.
- C-W-8 (needs D, I): `http://localhost:3000/en-US/legal/shipping-returns` → H1 "Shipping and returns", "In effect since January 1, 2026", an "Earlier versions" list with "June 1, 2025"; click it → URL `?asOf=2025-06-01`, banner "This is a superseded version. It was in effect until December 31, 2025." and a link "View the current version" that returns to the plain URL. `?asOf=2020-01-01` → the not-found page. `?asOf=banana` → current version, no error.
- C-W-9 (needs D, I): `/en-US/legal/terms`, `/en-US/legal/privacy`, `/en-US/legal/image-credits` each render with "In effect since January 1, 2026"; image credits shows the link "Pexels" (`href="https://www.pexels.com"`, `target="_blank"`, `rel` contains `noopener`) and, if G's lock file exists, a list "Photo by … on Pexels"; `/en-US/legal/nope` shows the not-found page; `/de-DE/legal/terms` shows "Gültig seit 1. Januar 2026".
- C-W-10 (needs D, I): `http://localhost:3000/en-US/blog` → three article cards, newest first ("What an introductory price means", "How to read the Broadband Facts label", "Cable or home wireless: which internet fits you?"), each with date and topic chips; click chip "Pricing" → URL `?tag=pricing`, 1 article; open `?tag=phone&tag=labels` → "No articles match these filters." (role status), chips "Phone" and "Labels" visible, clicking the remove control on "Phone" gives `?tag=labels` with 1 article; "Clear filters" returns to `/en-US/blog` with 3.
- C-W-11 (needs D, I): `/en-US/blog/reading-the-broadband-facts-label` → article with H1, publish date, body, "Related articles" block with the other article(s) sharing a tag; `evaluate_script` reads `document.title`, `meta[name=description]`, `link[rel=canonical]` (= `${origin}/en-US/blog/reading-the-broadband-facts-label`), `link[rel=alternate][hreflang]` for en-US and de-DE, `meta[property="og:type"]` = `article`, and parses the `application/ld+json` script as `Article` with `datePublished` `2026-09-16`; `/de-DE/blog/reading-the-broadband-facts-label` shows German text and `inLanguage` `de-DE`; `/en-US/blog/nope` shows the not-found page.
- C-W-12 (needs D, I): withdrawn. Temporarily edit `site/content/en-US/blog/what-intro-pricing-means.md` front matter to `status: withdrawn` and add `topic: pricing`; reload its URL → H1 "This article is no longer available", link "See Pricing articles" to `/en-US/blog?tag=pricing`, none of the article body text on the page (search the DOM), robots `noindex`; the article is absent from `/en-US/blog`; revert the file.
- C-W-13 (needs D, I): tagless. Temporarily set `tags: []` in `site/content/en-US/blog/cable-or-home-wireless.md`; reload → no "Related articles" heading and no related cards; revert.
- C-W-14 (needs D, I): `http://localhost:3000/en-US/support` → H1 "Support", the address `support@malva.example` as text, a button "Email support" whose `href` is exactly `mailto:support@malva.example?subject=Malva%20Telecom%20support%20request`, three "Popular questions" (one per topic) with answers open or expandable, link "All questions" to `/en-US/faq`; `document.querySelectorAll('form, script[src*=chat], iframe').length` is 0; `fetch('/api/contact', {method:'POST'})` returns 404; at `/de-DE/support` the subject is `Anfrage%20an%20den%20Malva-Telecom-Support`.
- C-W-15 (needs D, I): from `/en-US` click footer links About us, FAQ, Blog, Shipping and returns, Terms, Privacy, Image credits, and the existing footer "Support" link → each opens under `/en-US/...` (about, faq, blog, legal/shipping-returns, legal/terms, legal/privacy, legal/image-credits, support) with HTTP 200; repeat the first two from `/de-DE` and land on `/de-DE/...`.
- C-W-16 (needs D, I, U): on `/en-US/bundle/checkout` the terms/privacy consent links open `/en-US/legal/terms` and `/en-US/legal/privacy` in a **new tab** (`target="_blank"`); closing it returns to checkout with the address and selections intact.
- C-W-17 (needs D, I): Lighthouse (`lighthouse_audit`, mobile) on `/en-US/faq`, `/en-US/blog/cable-or-home-wireless` and `/en-US/legal/terms` → accessibility ≥ 95, SEO ≥ 95, best practices ≥ 90; no "links do not have discernible text" and no contrast failures on kicker/links.
- C-W-18 (needs D, I): resize to 375 px and open `/en-US/blog` and `/en-US/blog/cable-or-home-wireless` and `/en-US/legal/shipping-returns` → single column, no horizontal scroll, tap targets of chips and links ≥ 44 px high.

## Manual tests (owner only)
- M-W-1 (needs SO-09): Read the en-US and de-DE copy of `about`, `faq`, `support`, the three blog articles and the five legal files in `site/content/`; confirm the About page contains no claim you would not sign, replace the placeholder address `support@malva.example` in `site/lib/config/contact.ts` with a real mailbox (or keep it as a demo), and replace the placeholder legal text with real legal text before any non-demo use → approve or list changes; also approve the Pexels image-credits wording and that German copy is acceptable (it is machine-translated, flagged in `IDEAS.md`).

## Excluded
Each title below is a spec scenario that is **not built as written**; its replacement is in the "Replacement behaviour" table above.
- `about-us`: "Editor publishes a correction": D-034 (static files; a content change is a git commit deployed with the site, so "without a storefront deployment" cannot hold; the clause "previous version no longer reachable at the same address" is kept and tested as Replacement behaviour).
- `faq`: "Feedback collector unreachable": D-034 and D-059 (no feedback endpoint and no analytics) with the Planner default "no vote control"; replaced by the test that no vote control or request exists.
- `contact-us`: "Enquiry accepted downstream": D-034 (contact is a `mailto:` link, no form, no storage).
- `contact-us`: "Routing unavailable": D-034 (no routing exists; nothing is ever reported as sent).
- `contact-us`: "Chat script absent": D-034 and D-059 (no chat widget in v1; replacement test asserts no chat script or placeholder).
- `contact-us`: "Region without an office": D-034 (no offices block exists; replacement test asserts the email channel is shown for every visitor).
- Spec Open questions not built: gated resources behind a form (D-034), re-consent recording for standing orders (D-059), referring-page attribution and account identifier in the enquiry (Planner defaults above).

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] Every scenario row above has a passing test; every Excluded title has its Replacement behaviour test.
- [ ] C- and M- lines present; STATUS set to `Ready for review`.
- [ ] `content/` has both locales for every file (parity tests pass); `next.config.ts` bundles `content/**`.
- [ ] No hex colors, raw px spacing or hard-coded UI strings in components (token and message lints pass); the page copy lives only in `content/` and messages.
- [ ] SO-09 requested from the owner (About claims, copy, image credits).

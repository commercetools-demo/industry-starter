# Workstream W report (content pages: about, FAQ, support, blog, legal)

Branch `ws/w-content-pages`. `npm run verify` passes. Terminal smoke against `next dev -p 3020` (no commercetools credentials needed): `/en-US/about`, `/faq`, `/support`, `/blog`, `/blog?tag=phone&tag=labels`, `/blog/cable-or-home-wireless`, `/legal/shipping-returns` (+ `?asOf=2025-06-01`), `/legal/terms`, `/legal/image-credits`, `/de-DE/faq`, `/de-DE/legal/privacy` all 200; `?asOf=2020-01-01` and `/legal/nope` 404; the FAQ server HTML has every `<details ... open>` and the answer text.

## Done
W-01 … W-10 (W-10: `npm run verify` green; `node plan/verify-plan.mjs` reports 0 uncovered scenarios, its only error is the STATUS count line, which the orchestrator regenerates with `--sync`). Every scenario row and every Replacement-behaviour row in the workstream table has a test with the verbatim name.

## Not done / blocked
Nothing. Chrome checks C-W-1 … C-W-18 were not run by me (C-W-16 waits for U). SO-09 still has to be requested from the owner.

## Questions for the owner
- SO-09: the support mailbox is the placeholder `support@malva.example` (`lib/config/contact.ts`); all legal text is placeholder text (stated at the top of each policy); German copy is machine-translated.
- The footer credit "Photos from Pexels" (I/G) and the image-credits page say Pexels, while the lock file's images are iStock/Getty hosted and every `photographer` is `null` today, so the credits list is empty and only the generic paragraph shows. Decide the wording before release.

## Missed features and deviations
- German "My bundle" is **"Mein Bundle"** (D/I use "Mein Bundle" in `messages/de-DE.json`), not the plan's "Mein Paket"; all German content files use "Mein Bundle".
- All `content.*` messages (both locales) were added in W-01 together (not spread over tasks); W-09 added only the parity test.
- Kicker colour is `text-brand-800` instead of the plan's `brand-700` (`#ae8745` on white fails 4.5:1 at 14 px).
- `getFaq` returns `Faq | null` (null when the English file is missing) instead of always a `Faq`; pages call `notFound()`.
- `lib/content/files.ts` (`readLocaleFile`), `lib/content/metadata.ts` (`contentMetadata`, `absoluteUrl`), `components/content/prose.ts` (shared class constants), `components/content/TagLinks.tsx` and `test/content-fixtures.ts` are new helper files in W's area. `blog.ts` also exports `parseTagFilter` and `availableLocales`; `format.ts` also exports `dayBefore`; `policies.ts` exports `isLegalSlug`.
- `ContentArticle` takes an `intro` slot; the fallback `lang="en"` is on the `<article>` (title and body), the notice stays outside it.
- `asOf` is capped at today, so a future `asOf` can never reveal an unpublished (future-dated) version. A superseded `?asOf=` page is `noindex`.
- `getImageCredits` accepts a photo link from `photoUrl`, then `page`, then `url` (G's real file has `page`/`url`, `photographer: null`) and walks nested objects (`{ term, images: [...] }`).
- `/support` shows the popular questions with `collapsible={false}` (always open); only `/faq` has the client accordion. Popular-question topic titles are `h2` under the "Popular questions" `h2`.
- Contact button is a plain styled `<a href="mailto:...">`: the locale-aware `Button`/`Link` would prefix the locale to a `mailto:` target.
- `--content-width-prose: 720px` appended to the extensions block of `app/globals.css` (C's file).
- Open-graph `locale` is `en_US` / `de_DE` (underscore form).
- I did not run `node plan/verify-plan.mjs --sync` (STATUS is the orchestrator's).

## TODOs for other workstreams
- U: use `PolicyLink` (`components/content/PolicyLink.tsx`, props `{ policy: 'terms' | 'privacy' | 'shipping-returns' | 'image-credits'; children; className? }`) for the consent text so the policy opens in a new tab (C-W-16).
- Y: `SITE_URL` env (optional; falls back to Netlify `URL`, then `http://localhost:3000`); `next.config.ts` now has `outputFileTracingIncludes: { '/**': ['./content/**/*', './scripts/seed/data/product-images.json'] }`.
- Z-01: the three `## Plan notes` sections exist in `openspec/specs/{contact-us,faq,about-us}/spec.md`.
- I: footer "Support" link now has its page.

## Findings
- No commercetools calls anywhere in W. Legal and blog pages read files from disk at request time; `export const revalidate = 3600` on the legal page is nominal because the locale layout reads the session cookie (every page is dynamic).
- A `npm run verify` build failed once on a Google-fonts fetch (same flake as I reported) and passed on retry.

## Manual tests added
M-W-1 (needs SO-09), already in the workstream file.

## Junior design choices
- Content layout from tokens: kicker (Exo, brand-800), H1 `text-5xl`, 720 px column (`--content-width-prose`), prose styles via arbitrary variants in `components/content/prose.ts`.
- FAQ: topic navigation as pill links; each `<details>` row has a chevron icon rotating on open, 44 px minimum summary height, hairline `brand-200` separators.
- Blog: cards use `Card`; topic chips are pill links (dark chip with a close icon for an applied filter, light chips otherwise, disabled-looking chips after three filters).
- Legal page: the superseded notice is a `brand-100` note box; "Earlier versions" is a link list.
- Support: contact card on `brand-50` with the address as text, a primary pill `mailto:` button and the "no card numbers or passwords" note.
- Footer: a second small link row "Company and legal" under the credits line.

## Chrome checks ready
C-W-1 … C-W-15, C-W-17, C-W-18 (C-W-16 needs U). C-W-4, C-W-12, C-W-13 temporarily edit files under `site/content/`.

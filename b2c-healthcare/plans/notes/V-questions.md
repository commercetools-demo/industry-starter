# Workstream V: questions and the defaults chosen

| # | Question | Default chosen |
| --- | --- | --- |
| 1 | The worktree started at an older commit. | Fast-forwarded to `worktree-b2c-healthcare` as instructed. |
| 2 | Front-matter parser or dependency? | Own tiny parser (`lib/content.ts`, `parseFrontMatter`) and Markdown subset (`lib/markdown.ts`: h2/h3, paragraphs, lists, bold, links; unsafe link schemes dropped). No dependency added. |
| 3 | Where do translations live? | `content/<collection>/<name>.md` is en-US; a translation is `<name>.<locale>.md` beside it. A missing one falls back to en-US and sets `fellBack`, shown by a notice. |
| 4 | Policy versions. | `content/policies/<slug>/<yyyy-mm-dd>.md`; the newest not dated in the future is current; `?version=<date>` shows an older one with a "superseded" note and `noindex`. |
| 5 | FAQ accordion? | None: answers are plain visible text with `id` anchors (`/faq#id`, highlighted by `:target`). "Was this helpful?" omitted in v1. |
| 6 | Offices by region. | Office files carry `country:`; the visitor country comes from `COUNTRY_CONFIG`; none for the country means no office block, general block only. |
| 7 | Withdrawn article status. | Page renders "no longer available" with links to its category and the journal, `noindex`; HTTP status stays 200 (Next page cannot set 410). Body is never read into the page. |
| 8 | Site origin for canonical/sitemap. | Optional `SITE_URL` (added to `.env.example`), default `http://localhost:3000`. Set it in production. |
| 9 | Runtime file reads vs deployment. | `outputFileTracingIncludes` for `./content/**/*` added in `next.config.ts`; `CONTENT_ROOT` uses `turbopackIgnore` to avoid whole-project tracing. |
| 10 | Footer labels namespace. | Footer reads `shell.footer.*`, so the four new labels (faq, shipping, terms, privacy) were added there (additive); all page copy is in `content` and `static`. |
| 11 | Header journal link. | `Header hasArticles` is now passed from the locale layout via `showJournal(locale)` (3+ published articles). M still owns the home journal row; `hasJournalRow` is exported for it. |
| 12 | Footer link test vs other workstreams. | `lib/routes.test.ts` checks Company links resolve to real pages; Care/Pharmacy links (doctors, prescriptions, labs) are exempt until those pages are merged. |
| 13 | Existing tests edited. | `lib/nav.test.ts` and `components/layout/Footer.test.tsx` (H) updated because Company links are now live. |

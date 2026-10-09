# Workstream V: todos

## Browser check (`PORT=3108 npm run dev`, placeholder env with unreachable commerce URLs, killed afterwards)
- `/en-US/faq`, `about`, `contact`, `journal`, `journal/sleep-basics`, `journal/retired-article`, `policies/terms[?version=2025-06-01]` all return 200 with the page-specific `<title>` and an absolute canonical.
- curl of the FAQ HTML contains the answer text (no JS needed); `/en-US/faq#delivery-times` scrolls to the card and `:target` matches (azure border).
- Contact has no `<form>`; withdrawn article HTML does not contain its text; `/sitemap.xml` and `/robots.txt` render.
- About renders with commerce unreachable (nothing in its import graph touches commerce; the shell is H's).
- Lighthouse (desktop) on the FAQ: accessibility 96, best practices 100, SEO 100.
- Not done: visual compare of journal list/article, mobile viewport of journal, JS-disabled rendering in a real browser (curl only), screenshots saved under `plans/evidence/`.

## For others
- Owner: SO-03 (look and copy), SO-04 (policy/legal wording; all content is marked draft, front matter `draft: true`, remove when approved).
- Checkout workstream: link consent text with `PolicyLink` (`components/content/PolicyLink.tsx`, opens a new tab so checkout state is untouched).
- M: use `hasJournalRow(locale)` / `getPublishedArticles` from `lib/content` for the home journal row, `getSiteImage` for covers.
- Seed owner: `scripts/seed/data/site-images.json` is `{}`; once `seed:images` fills `journal-1..3` the covers appear automatically.
- Set `SITE_URL` in production.

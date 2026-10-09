# Workstream M: gaps and things that may bite others

- Doctor card links go to `/doctor/<product key>?m=<mode>` (workstream L); until L merges they 404. The prescriptions page (N) and `/account`, `/account/labs` pages are linked but may not exist yet; the home link test exempts them (same list as `lib/routes.test.ts`) and must be tightened when they land.
- The home snapshot reads availability for up to 50 candidates per mode (two modes, one Custom Object query each) at most once per 60 s per server instance. Fine for 8 doctors; a larger catalog needs a precomputed next-slot attribute.
- `getPublishedArticles` (workstream V) includes `draft: true` articles, so the home journal row (and the journal page) can show the placeholder draft; the row appears when 3 non-withdrawn articles exist (`JOURNAL_ROW_MIN`). V decides whether drafts should be hidden in production.
- All messages are shipped to the client (`IntlProvider`), so strings of gated claims (same-day, auto-refill) are present in the page payload even when the line is not rendered. The rendered HTML has no such claim; a payload grep will find the text.
- The header search link is hidden below 900 px; the mobile menu has no search row (adding one changes H's menu tests).
- The doctor count chip/band uses "available today", not "now", because of the 2 hour booking lead time (M-questions 1). If the owner wants a true "now", `MIN_LEAD_MS` and the slot rules would have to allow same-hour bookings.
- Hero image alt text is empty (decorative); the photographer credit from `site-images.json` is not displayed anywhere on the home page yet.
- The `home-cta` slot is in the seed list and in `content/images.ts` but the closing band does not use a photo.
- 390 px layout is covered by class tests only (no viewport resize available), same as K.
- No Lighthouse run was possible here (no Chrome DevTools connection).

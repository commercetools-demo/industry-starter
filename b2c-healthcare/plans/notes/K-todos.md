# Workstream K: live checks (BLOCKED on seeded data and OA-01..03)

Everything below needs a seeded project and credentials. Browser checks were done with fixtures:
`MALVA_FIXTURES=1 DOCTOR_PAGE_SIZE=3 PORT=3107 npm run dev` (dummy CTP_* values suffice; see K-questions 1).

1. Run one Product Search with `buildSearchRequest` for a doctor: `filters.modes=['office']`. Confirm `variants.attributes.modes.key` with `fieldType: set_enum`, `variants.attributes.specialty.key` / `city.key` with `enum`, and that the distinct facets named `specialty`, `city`, `modes` return buckets (K-questions 2).
2. Confirm `masterVariant.prices[*].channel` expands on search results (fees per mode); otherwise pass `channelKeysById` to `mapDoctorCard`.
3. `/en-US/doctors/remote`: 8 doctors with remote fees; `/office`: clinic in the meta line, office fees, city filter. The Dermatology filter updates the URL and Back restores it. "Available today" shows only doctors with a slot today (compare with the badge). `DOCTOR_PAGE_SIZE=3` shows the pager; `?page=99` redirects to the last page.
4. Text search: `/search?q=okafor` (Doctors), `?q=amox`, `?q=amoxicilin` (typo, expect the medicine), `?q=derm` (specialty match on /doctors), `?q=zzzz`, `?q=MED-amoxicillin-500-mg` (exact SKU first, "Matched part number"). Verify the API accepts the `fuzzy` + `fullText` (with `boost`) `or`, and `caseInsensitive` on `exact variants.sku`.
5. If workstream W adds a second project language, extend `SCRIPT_BY_LANGUAGE` in `lib/ct/search-all.ts`.
6. Lighthouse accessibility >= 95 on `/en-US/doctors/remote` and `/en-US/search?q=okafor`; 390 px layout (card right column under the text); Network tab: no commercetools call from the browser.
7. Check the API client has `view_products` (and the Custom Object read scope for availability).

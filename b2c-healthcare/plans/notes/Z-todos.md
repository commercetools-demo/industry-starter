# Z todos

- Z-03 live part: Lighthouse performance on a production build against a live project (dev-server numbers are not representative: home 75, doctors 82, profile 83, cart 93, checkout 53, account 74, labs 95 in dev with fixtures). See `LIVE-TODOS.md`.
- Z-05 live part: re-run the X-06 health-data audit (`npm run privacy:audit`) on the deployed project.
- Z-04 gaps: journey (5) "erase patient" needs a live project; "register" has no fixture.
- Fix checkout CLS (0.62) and cart CLS (0.11): reserve space for the skeleton on client-fetched pages.
- Doctors page: axe `heading-order` (card h3 after h1), moderate.
- `appointments/page.tsx` calls `new Date()` during render (oxlint purity warning, pre-existing).
- Owner: OA-01..OA-06, SO-01..SO-04, M-Q-1, M-T-1 in `TODO-MANUAL-TESTING.md`.

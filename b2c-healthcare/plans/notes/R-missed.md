# Workstream R: gaps noticed in the plan

- The plan's path `app/[locale]/account/layout.tsx` clashes with the `(protected)` group that already owns `account/*`; the layout lives inside the group (R-questions 2).
- The overview tile for orders only counts; the orders list is S. `/account/orders` is a stub with the empty state, so a patient who has orders sees "No orders yet." there until S ships.
- Reschedule does not exist (v1). Cancelling is by 2 h rule only; there is no cancel for guests (a guest has no account area). A guest with a booking can still open the confirmation page by cookie, but cannot cancel it.
- Appointment details never show the reason for the visit (health-data rule), so the card has less than the confirmation page.
- `listBookingsForPatient` and `labSource.listForPatient` read all of a patient's objects with `queryObjects` (pages of 200) on every overview, labs and appointments render; fine for the demo, an index or a per-patient container is the next step for real volumes.
- The overview does four platform reads (customer, labs, bookings, orders) plus one product read per appointment doctor on the appointments page, none cached (per patient, `no-store`).
- The session cookie lives 30 days and sign-out cannot revoke other browsers (J-missed); the account area therefore stays readable from another browser until the cookie expires.
- `account.labs.pdf` texts and the whole PDF are English only (one locale today).
- PDF: standard Helvetica only (WinAnsi); characters outside it print as `?`. The file name carries the lab id (`lab-results-LAB-50302.pdf`), not the test name.
- R-07 finds guest bookings by exact-case email predicate (plus the lowercase form); a guest who typed mixed case that differs from both is only attached through the cookie.
- The attach hook runs on every sign-in (one customer read and one booking query per login, even for patients with no guest bookings). A cheap pre-check (cookie empty and no guest bookings by email) is not possible without that query; acceptable for the demo.
- Sign-in scenarios under "design-account-area › Sign-in and create account card" are J's; they stay unticked in R's file with N/A reasons.
- No dev-only fake session for the browser fixtures (R-questions 13), so every signed-in view is verified by unit tests only until a seeded project exists.
- The header "Lab tests" link (`/account/labs`, NAV_LINKS from H) now resolves.

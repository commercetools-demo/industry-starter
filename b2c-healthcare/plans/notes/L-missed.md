# Workstream L: gaps and things that may bite others

- `/account/appointments` (R) does not exist yet: the "My appointments" button on the confirmation page links to it and 404s until R is built. Attaching a guest's booking to a new account by verified-email match is R-07; until then a guest who registers still opens the booking from the same browser (cookie), not from the account.
- No purge of expired guest bookings or old slot claims (F-missed); an expired guest booking is unreadable but still stored.
- `POST /api/bookings` has no rate limit. Guests can create bookings without an account, so someone can hold many slots; a throttle on client address using `lib/ct/ratelimit` is the obvious next step.
- No cancel or reschedule UI (R). `cancelBooking` exists in F.
- Booking stores no fee: the confirmation shows today's price of the mode.
- Video sessions have no join link or provider in v1; the confirmation says so without promising email (L-questions 3).
- The profile page runs `getDoctorByKey` (projection + reviews) per request and, for a signed-in patient, one customer read. Fine for the demo; a cache would have to be keyed by currency.
- A doctor page for a product that is not a doctor (any other product key) renders as a doctor with empty fields; only product keys of doctors are linked, and the slots route returns 404 without a schedule. A product-type check was not added.
- Times are shown in the clinic zone, not the visitor's (L-questions 11).
- The browser could not be driven (Chrome DevTools MCP unavailable): focus return and trap are tested with Testing Library and the existing `Modal` tests, not in a real browser.
- `use-account` is not used on the profile (the server passes the patient name and email as a prop). If H/J later give `AccountUser` an email in the seed, the panel could read it client-side.

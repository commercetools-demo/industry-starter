# U live checks and follow-ups
- Re-seed the project: the order and line custom types gained fields, plus new allowance and credential data (`scripts/seed/README.md`).
- Live: confirm Checkout payment amount when tender Payments already exist on the cart (session is created for the card remainder only).
- Live: confirm that omitting `externalPrice` in `setLineItemPrice` reverts the line to the platform price.
- Live: confirm the API client has `manage_payments`.
- Netlify: set `RELOAD_ALLOWANCES_SECRET` and `SITE_URL`; confirm the cron in `reload-allowances-scheduled.ts` is registered; never set `RESOLVER_FORCE_FAIL` in production.
- Dev-server check (fixtures, curl, port 3119, done): Sam's cart shows covered and owed figures; the checkout tender view shows the allowance and the restricted option; placing drew the allowance down from 5000 to 4397; cancelling restored it to 5000; the allowance page renders. Not run in a browser (Chrome DevTools unavailable); the forced-fail state and the controlled-product states were covered by unit tests only (the prescription lookup route I guessed returned 404).

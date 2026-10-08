# Workstream R: live checks and todos (BLOCKED on OA-02/OA-03: no commercetools credentials or seeded project)

Checked without credentials (`npm run dev` on port 3113 with placeholder env, killed afterwards): signed out, `/en-US/account` answers 200 with `Cache-Control: no-store` and the sign-in prompt ("Sign in to Malva" link, no patient data); `GET /api/account/overview` answers 401 `no-store`; `/en-US/labs` answers 307 to `/en-US/account/labs`. `npm run build` passes, `check-bundle` and `check-no-health-in-release` pass. Not done: any signed-in rendering, screenshots, 390 px (no way to sign in without the platform; Chrome DevTools MCP unavailable).

## Live checks (seeded project, `.env.local` filled, `npm run dev`)
1. Sign in as Sam (`/en-US/login`): lands on `/en-US/account`. Header avatar links there. Side nav lists Overview, Lab tests, Appointments, Orders, Addresses, Profile, then "Sign out".
2. Overview as Sam: "Hello, Sam", tiles 4 ready / 1 appointment (only if Sam has an upcoming booked one; the seed has one past completed booking, so book one first or expect 0) / 0 orders; "Latest lab results" shows 3 rows. As Alex: all tiles 0 and "No lab results yet.".
3. `/en-US/account/labs`: five rows with "<date> · <laboratory>" and badges. `Lipid panel`: LDL "High" badge, danger track, marker at 96 %; `Thyroid panel (TSH)`: header and note only. "Download PDF" opens a PDF with the results (check the `×10³/µL` and `·` characters render). "Discuss with a doctor" opens Dr. Marchetti's profile (`mlv-doc-sofia-marchetti`).
4. As Alex open `/en-US/account/labs/LAB-50301` (Sam's) and `/en-US/account/labs/l999`: the same "Not found." page, both 404. `GET /api/account/labs/LAB-50301` and `/pdf` as Alex: 404 `{error:'Not found.'}`. Response headers of any `/api/account/*` call contain `Cache-Control: no-store`.
5. Cancel: book a slot more than 2 h away as Sam (`/doctor/<key>`), open `/account/appointments`, "Cancel appointment", confirm: toast, the card moves to Past as "Cancelled", the slot is bookable again on the doctor page. A booking less than 2 h away has no cancel button; calling `POST /api/bookings/<ref>/cancel` directly answers 409 `code: 'too-late'`. In the MC (`read_custom_objects`, container `malva-slot-claim`) the claim for that time is gone.
6. R-07: as a guest book a slot with `sam.rivera@example.com` (verified account email), then sign in as Sam: the booking appears on `/account/appointments`; in `malva-booking` it has `patientRef`, no `guest`, no `expiresAt`. A guest booking made with another email stays a guest booking. Check that `getObject`+`putObject` with `version` is accepted for an existing object (the unit fake models it).
7. Confirm the predicate `value(guest(email in ("a@b.c", "A@b.c")))` is accepted by the platform for Custom Objects (nested field predicate with `in`); if not, switch `lib/ct/bookings-attach.ts` to `value(guest is defined)` plus an in-memory filter.
8. `countOrders()` uses `orders().get({ where: customerId="...", limit: 1, withTotal: true })`; confirm `total` comes back and that the client's scopes allow `view_orders`.
9. Sign out: "Sign out" ends the session, header shows "Sign in", `/login` opens; cart and account keys cleared (open the cart as the next user: empty).
10. 390 px: the side nav stacks above the content; the result table scrolls horizontally inside its card.
11. A very long clinician note and a result with an unusual character in the PDF (WinAnsi only; anything else prints `?`).

## For other workstreams
- S (orders): replace `app/[locale]/(protected)/account/orders/page.tsx` (it is a stub, empty state only). Use `AccountHeading` from `components/account/AccountShell`. `countOrders(customerId)` is in `lib/ct/account-summary.ts`.
- T/U: add your entry to `lib/account-nav.ts` (`key`, `href`, `labelKey` under `account.nav` in the catalog) in the same commit as your page; `account-nav.test.ts` expects the exact list of keys today and will need your key added.
- Pages under `/account` render inside the shell; do not add your own page head band. The shell renders no `<main>` (the locale layout does).

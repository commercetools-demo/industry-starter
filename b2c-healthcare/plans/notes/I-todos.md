# Workstream I: follow-ups for other workstreams

- Pages with a resource id (doctor profile, order page) should render `<NotFoundView kind="doctor|order|generic" />` (or call `notFound()` and let the generic page show) so unknown and other-patient ids look the same.
- Patient pages (cart, prescriptions, checkout, order, account, labs) should start with `requireSessionOrPrompt(reason)`; client hooks should wrap their content in `SignInOnUnauthorized` and use `fetchJson` from `lib/http.ts` so a 401 shows the prompt.
- Other `console.*` calls added later should use `log` from `lib/log.ts`.
- Owner check SO-03 (look of the error pages).

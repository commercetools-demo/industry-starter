# Workstream Y: missed or limited

- Y-05 (deploy) is blocked on OA-06 and was not attempted; no URL exists.
- Headers, CSP and `x-powered-by` were verified only as configuration (toml parser test); they were not observed on a live response. The Next adapter must honour `netlify.toml` headers for dynamic routes (expected). Check with the post-deploy checklist.
- The CSP was not exercised against the real Checkout widget / Stripe iframe (needs OA-04); it may need extra hosts.
- `typescript.ignoreBuildErrors` applies to every release build; type safety then rests on `npm run check` running first inside `verify:build`.
- The `commercetools:nextjs-deploy-netlify` skill began with a telemetry `curl` to docs.commercetools.com; it was deliberately not run (not part of the task). Its other points (Frontend client, no admin client, health route absent) are covered here.
- The skill's sample scope list lacks `manage_key_value_documents`, `manage_payments`, `manage_recurring_orders` and others; the authoritative list is `.env.example`.
- X-todos says the retention function needs `manage_custom_objects`; `.env.example` lists `manage_key_value_documents` for Custom Objects. Confirm which name the project accepts.
- The retention and reload functions build their own client from `CTP_*` with no seed project guard (by design).
- The non-scheduled functions `/.netlify/functions/reload-allowances` and `/retention` are publicly routable; they are protected only by the secret header (401/503), tested in `netlify/functions/guards.test.ts`.

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence: workstream D (Server core)

The dev server ran offline with dummy environment values passed on the command line (no `.env.local`, no real credentials). The dev session route never calls commercetools, so this is a valid check of session, cookies and errors.

- `dev-session-initial.json`: first `GET /api/dev/session`: empty session, market en-US/USD/US.
- `set-cookie-flags.txt`: POST response header with the cookie value removed: `HttpOnly`, `SameSite=lax`, `Max-Age=2592000`, `Path=/`, no `Secure` in dev. In Chrome `document.cookie` did not contain `malva-session` (HttpOnly proven).
- `tampered.txt`: a garbage `malva-session` cookie gives HTTP 200 and `session: {}`.
- `D-session-market-1440.png`, `D-session-375.png`: the JSON page after posting `{market:"en-CA"}`: market en-CA/CAD/CA, `cartId` gone, `customerId` kept.
- Chrome script result (recorded here): POST cartId/customerId gives `{ok:true}` and the GET shows both; POST market en-CA drops `cartId`, keeps `customerId`. Console showed no messages.
- curl: `?simulate=503` gives HTTP 503 `{"error":{"code":"upstream_unavailable","message":"..."}}`; `?simulate=409` gives HTTP 409 `conflict`.
- `probe.json`: not produced. **blocked: OA-01** (live probe `npm run test:live` needs `storefront/.env.local`; without it the probe stops at "Missing environment variable CTP_PROJECT_KEY").

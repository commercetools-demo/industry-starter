<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Spike: `server-only` module imported from `proxy.ts` (storefront G-06)

Result: **kept** (no fallback route needed). `proxy.ts` imports `@/lib/ct/stores` (which starts with `import 'server-only'` and imports `lib/ct/client.ts`) directly.

- `next build` (Next 16.4.0, Turbopack) compiled, listed `ƒ Proxy (Middleware)` and finished without a `server-only` error.
- `next dev` against a local fake of the commercetools API (offline, dummy credentials, not the real project): `/api/health` 200 `{"ok":true,"projectKey":"fake-project"}`; `/de-DE/mau-store-north` 200 with `Set-Cookie: malva_session=...; HttpOnly; SameSite=lax; Path=/`; `/de-DE/mau-store-nope` 404 (the `status: 404` option of `NextResponse.rewrite` is honoured); `/de-DE` 404; locale switch POST returned `{"locale":"en-US","currency":"USD","country":"US"}`; a tampered cookie fell back to the de-DE defaults with status 200; an unsupported locale gave 400.
- `SESSION_SECRET=short npm run dev`: the server stopped at the instrumentation hook with `SESSION_SECRET must be at least 32 characters` (the value is not printed).
- Not proven offline (see `plans/TODO-MANUAL-TESTING.md` M-G-01 to M-G-03): the shape of the real Store response, real credentials, the least-privilege scopes.

# Security review (U-07)

Manual review (no `security-review` skill was available). Scope: the BFF, session, auth, forms, headers and dependencies.

| Area | Finding | Status |
| --- | --- | --- |
| Secrets | Server-only env (`lib/env.ts`, `server-only` guard); `scripts/check-bundle-secrets` finds no secret or commercetools host in the client bundle or HTML | OK |
| Session | jose-signed HttpOnly `malva_session` cookie, allow-listed fields, `SameSite=Lax` | OK |
| Cross-site writes | `handle()` refuses non-GET requests with `Sec-Fetch-Site` other than same-origin/none, or a foreign `Origin`, with 403 (added in this review; 3 tests; verified live) | Fixed |
| Input | Every Route Handler validates the body with zod (`parseBody`); `app/api/validation-audit.test.ts` fails on a route without it | OK |
| Authorisation | `requireCustomer`/`requireBusinessUnit` on all account routes; ownership checks in `lib/ct/ownership.ts`; as-associate calls so commercetools enforces roles | OK |
| Abuse | Durable rate limiter (hashed keys, fails open with a log), honeypot, minimum fill time | OK |
| Errors | Handlers return sanitised errors only (no SDK text, no tokens) — tested | OK |
| Headers | CSP, HSTS, frame-ancestors, nosniff, referrer policy | OK, with `'unsafe-inline'` for scripts (D27) |
| Passwords | Length and common-password check; no reset flow by owner decision | OK |
| Dependencies | `npm audit --omit=dev`: 0 vulnerabilities on Next 16.4.0 | OK |
| Dev scope | Dev runs on the seed client with `manage_project` (D25); production must use the narrow scopes in `lib/scopes.ts` (OA-02/OA-04) | Owner item |

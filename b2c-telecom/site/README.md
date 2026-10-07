# Malva Telecom storefront

Next.js 16 (App Router) storefront on commercetools. Everything below runs in `site/` with Node 22 and npm only.

## Getting started

```bash
nvm use                       # Node 22, from ../.nvmrc
npm ci                        # install exactly what package-lock.json says
cp .env.example .env.local    # then fill in the values; never commit .env.local
npm run dev                   # http://localhost:3000
```

## Verify

```bash
npm run verify                # lockfile + version gates, lint, typecheck, tests, build
```

The order of the steps in `verify` is fixed (see `test/verify-script.test.ts`); each workstream inserts its own step at its position.

## Where code goes

Adding an endpoint and its client hook touches three layers. Each has one location and one existing example to copy.

| Layer | Location | Example to copy |
| --- | --- | --- |
| commercetools helper (server-only) | `lib/ct/<area>.ts` | `lib/ct/session.ts` |
| Route Handler | `app/api/<area>/route.ts` | `app/api/auth/session/route.ts` |
| SWR hook (client) | `hooks/use<Thing>.ts` | `hooks/useSession.ts` |

The three example files are built by workstream E. The boundary rules are enforced by `npm run lint` and `npm run check:boundaries` (both part of `npm run verify`):

- Client code (`components/`, `hooks/`, `context/`, any `'use client'` file) never imports, directly or through a helper, anything under `lib/ct/` or `lib/mappers/`, the commercetools SDK, `jose` or `next/headers`.
- Components get their types from `@/lib/types`, never from `@commercetools/platform-sdk` or `lib/ct/`.
- Pages and layouts under `app/[locale]` are Server Components that call `lib/ct/*` directly (independent reads in parallel); they are never `'use client'` and never fetch their own `/api`.
- `Link`, `useRouter` and `redirect` come from `@/i18n/routing`, and `redirect()` / `notFound()` are never wrapped in `try/catch`.
- Every module under `lib/ct/` and `lib/mappers/` starts with `import 'server-only'`; `lib/offers/` and `lib/pricing/` stay pure TypeScript.

Mutable user state (cart, signed-in customer) is read through a SWR hook that calls a Route Handler: never `fetch('/api/…')` inline in a component.

## Environment variables

All variables are server-only; none may carry the `NEXT_PUBLIC_` prefix (`npm run check:secrets` and `validateEnv` refuse it). Locally they live in `site/.env.local` (copy `.env.example`); on Netlify they are set in the site's environment settings (workstream Y). Values are never printed by any check or error message.

| Variable | Secret | Purpose |
| --- | --- | --- |
| `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL` | no | commercetools project and region endpoints |
| `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET` | yes | storefront API client (restricted scopes) |
| `CTP_SCOPES` | no | space-separated scopes of that client |
| `CTP_CHECKOUT_APP_KEY` | no | Checkout application key; required for Netlify builds and the checkout |
| `SESSION_SECRET` | yes | signs the session cookie; at least 32 characters (`openssl rand -base64 48`) |
| `DEMO_SHOW_RESET_LINK`, `SERVICEABILITY_STUB` | no | optional demo switches |
| `CTP_SEED_CLIENT_ID`, `CTP_SEED_CLIENT_SECRET`, `CTP_SEED_SCOPES` | yes | seed scripts only, in `site/.env.seed`, never configured for the app |

When validation runs: `next start` (production, Node runtime) stops at boot naming the first missing variable (`instrumentation.ts`); builds on Netlify (`NETLIFY=true`) fail by name; in development and local builds the first commercetools call throws the same error.

The sign-in rate limiter keeps its counters in memory per server instance (accepted risk on serverless).

## More

The implementation plan, decisions and workstreams are in `../plan/README.md`.

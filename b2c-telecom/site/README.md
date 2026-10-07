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

## More

The implementation plan, decisions and workstreams are in `../plan/README.md`.

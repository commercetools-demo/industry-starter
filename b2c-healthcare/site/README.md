# Malva Healthcare storefront

Next.js 16 (App Router) + React 19 + Tailwind v4 + next-intl, backed by commercetools. Route Handlers under `app/api/` are the BFF.

## Run

```bash
npm ci
cp .env.example .env.local   # fill in values; never commit this file
PORT=3000 npm run dev
```

## Environment

All variables are listed, without values, in `.env.example`. They are server-only: none may carry a `NEXT_PUBLIC_` prefix. Seed scripts use `.env.seed.example` (copy to `.env.seed.local`).

## Quality gate

`npm run check` runs type-check, lint, the version gate, the token parity check and the unit tests. `npm run verify:build` runs the gate and then `npm run build`. A commit must pass the gate.

## Server versus client (rule stub)

- `lib/ct/**` and `lib/session.ts` are server-only (`import 'server-only'`); components, hooks and context never import them, only types from `lib/types.ts`.
- Client code talks to the BFF over `fetch('/api/...')` through hooks.
- Never put secrets or health data in URLs, logs or client bundles.

## Route Handler template (BFF)

Every handler under `app/api/` does three things: validate the session, call **one** function in `lib/ct/<namespace>.ts`, return JSON. No `apiRoot` or SDK import in the handler.

```ts
import { handle, requireCustomer } from '@/lib/api';
import { getOrders } from '@/lib/ct/orders';

export async function GET() {
  return handle(async () => {
    const { customerId } = await requireCustomer(); // 401 { error } before any commercetools call
    return getOrders(customerId);
  });
}
```

- `handle(fn)` returns the value as JSON and maps any thrown error to a safe `{ error }` (never the raw SDK error, request body or credentials). Throw `new ApiError(status, 'safe message')` for your own errors.
- Public endpoints (catalog) skip `requireCustomer()`.
- Tests: mock `@/lib/session` and `@/lib/ct/*`; use `expectUnauthenticated(handler, [ctMock])` and `expectSanitizedError(handler, ['secret text'])` from `@/test/api`. Session/JWT tests need `// @vitest-environment node` (jose does not accept jsdom `Uint8Array`).
- Session cookie: `malva_session` (HTTP-only, SameSite=Lax, 30 days) holds `customerId`, `cartId`, `country`, `currency`, `locale` only; use the helpers in `lib/session.ts` (`getSession`, `updateSession`, `setCustomer`, `setCart`, `clearCustomer`, `clearCart`).

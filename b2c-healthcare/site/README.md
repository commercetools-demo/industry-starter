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

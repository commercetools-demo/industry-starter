<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Malva Coffee storefront

Next.js 16 (App Router), React 19, Tailwind v4, next-intl 4 and the commercetools TypeScript SDK. Shopper-facing online store for the US (en-US, USD) and Canada (en-CA, CAD) markets. Scaffolded with `/commercetools:nextjs-setup-project`.

## Setup

Requires Node 22 (`.nvmrc`).

```bash
cp .env.example .env.local   # fill in the values; .env.local is git-ignored
npm ci
npm run check
npm run build
```

Credentials live only in `.env.local`. `.env.example` lists names only.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (includes the BFF boundary rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (includes the version gate and secret checks) |
| `npm run check` | lint, typecheck and test |
| `npm run predeploy` | Fails while `app/api/health/route.ts` exists |
| `npm run verify:build` | Build, then scan the client bundle for secret values |

## Plans

The plans, decisions and workstreams are in [`../plans/`](../plans/). Start with `../plans/JUNIOR-GUIDE.md`.

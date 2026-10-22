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
| `npm run predeploy` | The deploy gate: fails while the dev routes exist or the environment is not fit for production (names only, never values) |
| `npm run verify:build` | Build, then scan the client bundle for secret values |

## Deploying

Hosting is Netlify (`../netlify.toml`: base directory `storefront`, `npm run build`, publish `.next`, Node 22). The runbook with every environment variable name, the dev routes to remove, the preview and production steps and the rollback is [`../plans/DEPLOY-NETLIFY.md`](../plans/DEPLOY-NETLIFY.md). In short: `npm run check`, `npm run verify:build`, delete the dev routes, `npm run predeploy`, then `/commercetools:nextjs-deploy-netlify`, which hands over to Netlify's `netlify-deploy` skill. To roll back, publish the previous deploy in Netlify.

The server stops with a message naming the variable when its environment is wrong; set `SESSION_SECRET` to at least 32 random characters and keep `EXPECTED_PROJECT_KEY` equal to `CTP_PROJECT_KEY`. The demo sign-in (`DEMO_LOGIN_ENABLED`, `DEMO_LOGIN_PASSWORD`) lists seeded customers who share one known password: enable it on a demo site only (decision SO-Q2).

## Plans

The plans, decisions and workstreams are in [`../plans/`](../plans/). Start with `../plans/JUNIOR-GUIDE.md`.

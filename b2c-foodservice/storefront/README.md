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

## Shopping assistant

A conversational assistant (port of Anthropic's Apache-2.0 [commerce-agents](https://github.com/anthropics/commerce-agents) reference, see `NOTICE`) that can search the catalogue, keep its own cart and look up the signed-in shopper's old orders. It never places an order. It calls **only** the storefront's own commercetools modules (`lib/ct/*`), with the shopper's cookie session; its cart **is** the shopper's bag (the Shopper MCP was removed in workstream T2, D-055). Layout and rules: `lib/agent/README.md`; plans: `../plans/workstreams/T-shopping-assistant.md` and `../plans/workstreams/T2-assistant-storefront-backend.md`; specs: `../openspec/changes/add-shopping-assistant/`.

- **Environment** (names only, see `.env.example`): `ASSISTANT_ENABLED` (off unless `true`), `ANTHROPIC_API_KEY`, `ASSISTANT_MODEL`, `ASSISTANT_TRANSPORT` (`sse` or `buffered`), `ASSISTANT_SHOWCASE` (never in production; the deploy gate fails on it).
- **Routes**: `POST /api/assistant/session`, `POST /api/assistant/turn` (body `{ message }` only), `POST /api/assistant/card/add`, `GET /api/assistant/card/product`. (`/api/assistant/adopt-cart` was retired in T2.)
- **Run without a model**: the unit tests use fakes (`lib/agent/testing.ts`: `FakeBackend`, `FakeModelClient`); `npx vitest run lib/agent components/assistant context`. In `next dev` the session store is in memory; production uses Netlify Blobs.
- **Card showcase**: set `ASSISTANT_SHOWCASE=true` and open `/malva-coffee/en-US/assistant-showcase`.
- **Refresh the verbatim checks** against an upstream clone: `UPSTREAM_DIR=<clone> npx vitest run lib/agent/shopping/tools`.
- **Boundaries (lint)**: `lib/agent/**` imports no `lib/ct`, `lib/session` or `@commercetools/*`; the Anthropic and Blobs SDKs are importable only under `lib/agent/**`; UI code never imports `lib/agent/**`.
- **Before a release**: `plans/RELEASE-CHECKLIST.md` section G (spend cap, token expiry, showcase off, per-instance rate limit).

## Deploying

Hosting is Netlify (`../netlify.toml`: base directory `storefront`, `npm run build`, publish `.next`, Node 22). The runbook with every environment variable name, the dev routes to remove, the preview and production steps and the rollback is [`../plans/DEPLOY-NETLIFY.md`](../plans/DEPLOY-NETLIFY.md). In short: `npm run check`, `npm run verify:build`, delete the dev routes, `npm run predeploy`, then `/commercetools:nextjs-deploy-netlify`, which hands over to Netlify's `netlify-deploy` skill. To roll back, publish the previous deploy in Netlify.

The server stops with a message naming the variable when its environment is wrong; set `SESSION_SECRET` to at least 32 random characters and keep `EXPECTED_PROJECT_KEY` equal to `CTP_PROJECT_KEY`. The demo sign-in (`DEMO_LOGIN_ENABLED`, `DEMO_LOGIN_PASSWORD`) lists seeded customers who share one known password: enable it on a demo site only (decision SO-Q2).

## Plans

The plans, decisions and workstreams are in [`../plans/`](../plans/). Start with `../plans/JUNIOR-GUIDE.md`.

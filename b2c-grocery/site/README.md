# MALVA grocery storefront

Next.js 16 storefront on commercetools. The plan, decisions and specs live in `../plan/` and `../openspec/`.

## Setup
```bash
nvm use            # Node 22 (.nvmrc at the repo root)
npm ci
cp .env.example .env.local   # fill in the values you were given; never commit .env.local
npm run dev        # http://localhost:3000
npm run verify     # lockfile check, lint, typecheck, unit tests, build
```

Start with `../plan/README.md` and `../plan/JUNIOR-GUIDE.md`.

## Environment variables
All variables are read on the server only; none may ever be prefixed `NEXT_PUBLIC_` (`npm run check:secrets` and `npm run check:bundle`, both part of `npm run verify`, fail if a secret could reach the browser). The app refuses to start (and Netlify builds fail) naming the first missing required variable.

| Variable | Required | Secret | Notes |
| --- | --- | --- | --- |
| `CTP_PROJECT_KEY` | yes | no | commercetools project key |
| `CTP_AUTH_URL` | yes | no | region auth URL |
| `CTP_API_URL` | yes | no | region API URL (also derives the region) |
| `CTP_CLIENT_ID` | yes | **yes** | API client with the storefront scopes |
| `CTP_CLIENT_SECRET` | yes | **yes** | API client secret |
| `CTP_SCOPES` | yes | no | space-separated, each suffixed `:<project key>` |
| `CTP_CHECKOUT_APP_KEY` | yes | **yes** (treat as secret) | commercetools Checkout application key |
| `SESSION_SECRET` | yes | **yes** | at least 32 random characters; signs the session cookie |
| `HOME_LAYOUT`, `HOME_CONTACT_STRIP`, `HERO_IMAGE_URL`, `FEATURE_SUBSCRIPTIONS` | no | no | optional content and feature switches |

Where to set them: locally in `site/.env.local` (copy `.env.example`; never commit it, only `.env.example` is tracked and its secret values stay empty); on Netlify in the site's environment variables (Site configuration, Environment variables).

## Delivery slots (stub)
Delivery windows come from an in-repo stub service (`lib/slots/stub-service.ts`, configured in `lib/config/slots.ts`: 7 days, six 2-hour windows from 08:00, capacity 10 per window, 15-minute holds; times are UTC). Its state lives **in memory** of the server process: a cold start or redeploy (Netlify serverless) resets all holds and bookings, and separate serverless instances do not share capacity. The chosen slot itself is stored on the commercetools cart (`cart-delivery` custom fields), so the cart keeps it, but its capacity hold is gone until it is picked again or V re-holds it when the checkout session is created. This is an accepted limitation for v1 (SO-12, D-033, D-042); replace `getSlotService()` in `lib/slots/index.ts` with a persistent service to remove it. Delivery cost is the commercetools shipping method `standard` (D-046, D-049); slots have no price.

## Deploying to Netlify
Hosting is Netlify (D-003). The root `netlify.toml` sets base directory `site`, build command `npm run build`, publish directory `.next` and `NODE_VERSION = "22"`. Netlify applies its Next.js runtime automatically; do not add plugins. There is no `vercel.json`. `content/**` is traced into the serverless bundle (`outputFileTracingIncludes`), and `/api/health` and every other dev-only route are absent or 404 in production.

### Before every release
1. `cd site && npm run verify:release` must pass. It runs `verify` and `check:release`, which fails if `app/api/health` exists, a `dev` route lacks the `NODE_ENV === 'development'` + `notFound()` guard, `netlify.toml` differs from the template, a `vercel.json` exists, or an `.env*` file (other than `.env.example`) is tracked.
2. Use the **Frontend B2C**-style API client with the storefront scopes only. The seed/admin client must not be used in production and is deleted from the project before launch (Z).

### First deploy (owner, OA-06)
1. In Netlify create a site from this repository. Base directory `site` (taken from `netlify.toml`). Leave the build command and publish directory as in `netlify.toml`.
2. Site configuration, Environment variables: set `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`, `CTP_CHECKOUT_APP_KEY` and `SESSION_SECRET` (at least 32 random characters and different from your local value). Optional: `HOME_LAYOUT`, `HOME_CONTACT_STRIP`, `HERO_IMAGE_URL`, `FEATURE_SUBSCRIPTIONS`. Mark the secrets as secret values. Never put values in the repository, in `netlify.toml` or in chat.
3. Netlify builds set `NETLIFY=true`, so the build validates the environment and fails naming the first missing variable.
4. In the commercetools Checkout application (Merchant Center), add the Netlify URL (and the custom domain, if any) to the allowed origins, otherwise the hosted checkout is blocked.
5. Deploy and run the checklist M-Y-1 to M-Y-5 in `../plan/TODO-MANUAL-TESTING.md`.

### Rollback
In Netlify, Deploys: open the last good deploy and choose "Publish deploy". No rebuild is needed. Environment variable changes only take effect on the next build, so after changing one, trigger a new deploy.

### Known and accepted
- Extra shipping methods (D-049): `standard-shipping` (500.00) and `express-shipping` (750.00) stay active next to `standard`; hosted Checkout lists every applicable method, so shoppers can see them. Revisit before launch (Z-05 checklist).
- Accepted risks (D-047): the session cookie holds the customer email and name for 30 days with no server-side revocation; rate limiting and the slot stub are in memory per serverless instance; the 15-minute slot hold can expire while a shopper pays, so oversell is possible until a real capacity system exists.

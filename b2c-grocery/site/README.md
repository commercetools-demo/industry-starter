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

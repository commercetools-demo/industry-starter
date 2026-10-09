# Malva B2B Plumbing and Waste management storefront (`site/`)

Next.js 16 (App Router) + commercetools. Specs: `../openspec/changes/{bootstrap-malva-storefront,malva-website}`; plan: `../plans/` (start with `JUNIOR-GUIDE.md`).

## Setup
```bash
npm ci
cp .env.example .env.local   # fill in (see ../plans/TODO-MANUAL-TESTING.md OA-02..04); never commit it
npm run dev                  # http://localhost:3000
```
Requirements: Node 22+. Seed data for the commercetools project: `../seed/README.md`.

## Scripts
| Script | What |
| --- | --- |
| `npm run check` | The quality gate: `tsc --noEmit`, `eslint .`, version / Tailwind / secrets / server-only checks, `vitest run`. Must pass before every commit. |
| `npm run build` | Production build (separate from the gate; fails on type errors). |
| `npm test` | Unit tests only. |

## Rules that are enforced by lint
- Client code (`'use client'`, `components/`, `hooks/`, `context/`) never imports `@/lib/ct/*` or `@/lib/session`.
- `@commercetools/platform-sdk` and `ts-client` only inside `lib/ct/**` and `lib/mappers/**`.
- `next/link` and `redirect`/`useRouter`/`usePathname` from `next/navigation` are banned in locale UI; use `@/i18n/routing`.
- No `fetch` against a commercetools host.

## Decisions to remember
- Tailwind v4 has no config file; tokens live in `app/globals.css` (`@theme`).
- Root layout never reads the session (design decision 9): per-visitor data comes from SWR → Route Handlers. Do not paste the skill's `SWRConfig fallback` layout snippet.
- `images.unoptimized: true`; Image URLs are stored clean, size parameters are added when rendering.

## Route Handler template

Every handler validates the session, calls one function in `lib/ct/<namespace>.ts`, and returns JSON. Never call `apiRoot` here.

```ts
import { handle, ok, requireBusinessUnit } from '@/lib/api';
import { listQuotes } from '@/lib/ct/quotes';

export const GET = handle(async () => {
  const session = await requireBusinessUnit(); // 401 without a customer, 400 "No active business unit" without a unit
  return ok(await listQuotes(session));
});
```

Test it with `expectUnauthenticated`, `expectNoBusinessUnit` and `expectSanitizedError` from `test/api-helpers.ts`.

## Local credentials

`site/.env.local` is git-ignored. In development it may reuse the seed client, which can only request `manage_project`: that hides missing-scope bugs. The scope list the real Frontend client needs is in `lib/scopes.ts`; create it (OA-02) before deploying.

## Data loading: server versus client

- **Server (async Server Components, `lib/ct/*`)**: everything public and the same for every visitor: categories, services, listings, detail pages, managed content. Independent fetches use `Promise.all`; `params` and `searchParams` are always awaited; a function used by both `generateMetadata` and the page is wrapped in React `cache()`; `notFound()` is called outside any `try/catch`. Listings use Product Search (`apiRoot.products().search()`) scoped to the default store, never the deprecated projections search.
- **Client (SWR hooks in `hooks/`, calling Route Handlers)**: everything that depends on the visitor: account, quote list, Business Units, portal lists. Read hooks return `null` or `[]` on failure; mutations throw and update the cache from the response (`mutate(KEY, data, { revalidate: false })`). Business-Unit-scoped keys are `[KEY, businessUnitKey]` tuples (`lib/cache-keys.ts`); sign-out and company switch clear them (`lib/client-state.ts`).

| Data | Cache | TTL |
| --- | --- | --- |
| Project configuration (locale validation) | `unstable_cache` | 300 s |
| Category tree | `unstable_cache` | 60 s |
| Public pages | ISR (`revalidate`) | per page |
| Managed content | JSON in `content/`, bundled at build; edit and redeploy | — |
| Quote list, account, portal | never cached; `Cache-Control: no-store` on `/api/*` and `/<locale>/account/*` | — |

**Why the root layout does not read the session.** The commercetools skill hydrates the account in the root layout. Here that would make every page dynamic, so public pages could not be static or revalidated and would differ per visitor. Layouts therefore never call `cookies()`, `headers()` or `getSession()` (lint rule in `eslint.config.mjs`); the sign-in state and quote-list count are SWR fetches after hydration into space reserved in the header. `npm run verify:build` builds and fails when a public route is dynamic.

## Managed content (for content owners)

Proof content lives in `site/content/*.json`: `stats.json`, `accreditations.json`, `testimonials.json`, `audiences.json` and `contact.json`. Text fields hold one string per language (`"en-US"` is required, `"de-DE"` is shown on the German site). Every item has `"sample": true|false`.

- Edit the wording, then set `"sample": false` once the owner has confirmed the item. While it is `true` the page shows a visible "Sample content" tag next to it.
- Remove an item to unpublish it. If a file becomes an empty list (`[]`) its section is left out of the page, never shown empty.
- `node scripts/check-sample-content.mjs` lists every item still flagged as sample (it runs in `npm run check`). `--strict` fails while any remain and is used for the release build.
- Banner photos come from `seed/src/data/site-images.json`; `node scripts/sync-site-images.mjs` (run by `prebuild`) copies them to `content/site-images.json`.

## Deploy (Netlify)

1. Create the site from this repository; base directory `site`. `netlify.toml` sets the build (`npm run build`, publish `.next`, Node 22). Previews build with `npm run build`; **production** first runs `npm run check:release`, which fails while any content item still has `sample: true` (SO-04) or a dev page is present.
2. Set these environment variables in Netlify (names only here; none has a public prefix):

| Variable | Scope | Owner |
| --- | --- | --- |
| `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL` | all | project owner |
| `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES` | Frontend API client, scopes as in `.env.example` (OA-02) | project owner |
| `CTP_PROV_CLIENT_ID`, `CTP_PROV_CLIENT_SECRET`, `CTP_PROV_SCOPES` | Provisioning client, server only (OA-04) | project owner |
| `CTP_DEFAULT_STORE_KEY` | `mpw-web` | project owner |
| `SESSION_SECRET` | at least 32 random characters (`openssl rand -base64 48`) | project owner |
| `SITE_URL` | the public origin, for canonical, hreflang and the sitemap | project owner |

   Never deploy with the seed or any admin (`manage_project`) client: `lib/scopes.ts` lists the least-privilege scopes.
3. Smoke test the preview: home, a listing, a service, register, add a service, request a quote, portal list; then delete the test company (`seed: npm run delete-test-company -- <key>`).
4. **Roll back**: Netlify, Deploys, choose the previous good deploy, "Publish deploy". No data migration is involved.

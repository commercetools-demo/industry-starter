<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream A (Bootstrap)

Format: `Q-<L>-<n> | question | default | blocks? | status`. Draft; the lead consolidates into `plans/QUESTIONS.md`.

Q-A-1 | The skill command creates `site/`; the spec wants `storefront/`. | Use `storefront/` (rename during or right after the command) | no | Open
Q-A-2 | Where does `netlify.toml` live? The command writes it at the project root (`b2c-foodservice/`). | Keep it at the project root with `base = "storefront"` and delete `vercel.json` (D-038); revisit in Q with OA-05 | no | Open
Q-A-3 | Locale cookie name. | `malva-locale` instead of the command's `your-shop-country-locale` | no | Open
Q-A-4 | Detect language from `Accept-Language` on first visit? | No: cookie, else `en-US` | no | Open
Q-A-5 | `next` range: exact pin or caret? | Caret `^16` resolved to the latest 16.x; the lockfile pins it | no | Open
Q-A-6 | `@types/node` version. | `^22` (Node 22) | no | Open
Q-A-7 | Empty folders from the spec layout. | `.gitkeep` files until the folder gets a real file | no | Open
Q-A-8 | Which `next/navigation` exports stay allowed in locale UI? | `notFound`, `useSearchParams`, `unstable_rethrow` allowed; `redirect`, `permanentRedirect`, `useRouter`, `usePathname` and all of `next/link` forbidden | no | Open
Q-A-9 | Raw-hex lint scope. | `components/**` and `app/**/*.tsx`, excluding tests; CSS files are the token layer (E) | no | Open
Q-A-10 | Extra dev packages (`vitest` family, `vite-tsconfig-paths`, `server-only`). | Allowed (guide and Next docs name them); anything else needs a question | no | Open
Q-A-11 | Is the version gate part of `check`? | Yes, as a Vitest test inside `npm run test`; also runnable as `node scripts/check-versions.mjs` | no | Open
Q-A-12 | Disable `/api/health` at runtime in production too? | No: deleted before deploy; the predeploy script fails while it exists | no | Open
Q-A-13 | Should the health route also check the key the API reports against `EXPECTED_PROJECT_KEY`? | Yes (second half of the project guard) | no | Open
Q-A-14 | Fonts and tokens in A? | No: `globals.css` is `@import 'tailwindcss'` only; E adds tokens and fonts | no | Open
Q-A-15 | Forbid `.env` and `.env.development` files in `storefront/`? | Yes, `check-secrets` fails if they exist (Next would load them; the spec says credentials only from `.env.local`) | no | Open
Q-A-16 | The workstream browser step 4 says `/de-DE` and `/en-GB` must be 404, but section 3.7 and the Unknown locale scenario say a locale-shaped unsupported segment redirects to the default or cookie locale. | Follow 3.7 and the spec: `/de-DE` redirects to `/en-US` (tested in `proxy.test.ts`) | no | Open
Q-A-17 | The spec says collection is enabled by a per-market flag in `COUNTRY_CONFIG` (true for US, false for CA, D-035) but the workstream's `CountryConfig` has no such field. | Not added in A (signature fixed in the workstream); D or F adds a `collectionEnabled` field and tests it | no | Open
Q-A-18 | `proxy.ts` forwards `x-next-intl-locale` on the request as well as the response, so Server Components (root layout `getLocale`) read the locale. | Done; both headers are set and tested | no | Open
Q-A-19 | Next 16.4.2 `next dev` rewrites the `nextjs-agent-rules` block in `AGENTS.md` (adds prose). | Commit the rewritten block; the test only needs the BEGIN marker | no | Open
Q-A-20 | `/en-US/<unknown route>` renders the default Next 404, not `app/[locale]/not-found.tsx` (that file only handles `notFound()` thrown inside the locale tree). | A leaves it; P adds a root `app/not-found.tsx` or catch-all with the locale shell | no | Open

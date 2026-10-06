# B — Project structure and lint rules

**Specs:** `storefront-project-structure` (all requirements)
**Depends on:** A · **Unblocks:** D, E, H (and every later workstream) · **Decisions:** D-023

## Goal
The folder layout from the spec exists, and ESLint plus two tiny scripts make the layering rules fail the build instead of relying on review.

## Design

### Directories (create with a `.gitkeep` where empty)
```
site/app/[locale]/        site/app/api/{auth,account,cart,checkout}/
site/lib/ct/  site/lib/mappers/  site/hooks/  site/context/
site/components/{ui,layout,product}/  site/i18n/  site/messages/  site/test/
```
Files created later: `lib/session.ts`, `lib/types.ts`, `lib/cache-keys.ts`, `lib/utils.ts`, `proxy.ts`.

### `server-only`
Every file in `lib/ct/**`, `lib/session.ts`, `lib/mappers/**` and `lib/env.ts` starts with `import 'server-only';`. In Vitest, add alias `server-only` → `test/server-only-stub.ts` (empty module) in `vitest.config.ts`, otherwise tests that import those files throw.

### ESLint (flat config `eslint.config.mjs`) — add these blocks
1. **No server code in client layers** — files `components/**`, `hooks/**`, `context/**`: `no-restricted-imports` patterns `@/lib/ct/*`, `@/lib/session`, `@/lib/mappers/*`, `@commercetools/platform-sdk`, `@commercetools/ts-client`. Message: "Import app types from @/lib/types; talk to the server through hooks and /api."
2. **One ClientBuilder** — all files except `lib/ct/client.ts`: restrict `@commercetools/ts-client`.
3. **Locale-aware navigation** — all files except `i18n/**`: restrict `next/link` (default import) and, from `next/navigation`, the names `useRouter`, `usePathname`, `redirect`, `permanentRedirect`. Message: "Use Link/useRouter/redirect from @/i18n/routing." (`notFound`, `useSearchParams`, `useParams` stay allowed.)
4. **No navigation control-flow in try/catch** — `no-restricted-syntax` with selector
   `TryStatement[handler] > BlockStatement.block CallExpression[callee.name=/^(redirect|notFound|forbidden|unauthorized|permanentRedirect)$/]` and message "Call outside try/catch or rethrow with unstable_rethrow."
5. **No raw commercetools fetch** — `no-restricted-syntax` selectors `CallExpression[callee.name='fetch'] > Literal[value=/commercetools\.com/]` and `CallExpression[callee.name='fetch'] > TemplateLiteral[quasis.0.value.raw=/commercetools\.com/]` (string and template-literal URLs; allowed only in `lib/ct/checkout-session.ts` via a per-file override).
6. **Components never fetch the API directly** — in `components/**` only: selectors `CallExpression[callee.name='fetch'] > Literal[value=/^\/api\//]` and `CallExpression[callee.name='fetch'] > TemplateLiteral[quasis.0.value.raw=/^\/api\//]`. Components call hooks (`hooks/*`), hooks call `fetchJson`/`sendJson` (`lib/fetcher.ts`).

### Token check script
`scripts/check-tokens.mjs` exports `findHardcodedColors(dir)` and fails the build if any `.ts`, `.tsx`, `.css` file under `app/`, `components/` contains a hex colour `#[0-9a-fA-F]{3,8}\b` — except `app/globals.css`, `*.test.*` and `app/icon*`/`opengraph-image*`. Wired into `verify` as `check:tokens` before `lint`.

## Tasks
- [x] B-01 Create the directory structure above (with `.gitkeep`). Build still passes.
- [x] B-02 Add the `server-only` alias stub for Vitest and a unit test proving a file importing `server-only` can be imported under Vitest (`test/server-only.test.ts`).
- [x] B-03 Add ESLint blocks 1 and 2; write `eslint-rules.test.ts` using ESLint's `Linter`/`ESLint` API on in-memory snippets: client file importing `@/lib/ct/cart` errors; component importing `@commercetools/platform-sdk` errors; a second `ClientBuilder` import errors; `lib/ct/client.ts` does not.
- [x] B-04 Add ESLint blocks 3 and 4 and tests (note: flat config replaces a rule per file group, so `eslint.config.mjs` lists the full restriction set per group; `scripts/seed/lib.ts` is allowed a ClientBuilder for the admin client): `next/link` errors, `@/i18n/routing` import ok, `useRouter` from `next/navigation` errors, `notFound` allowed, `redirect()` inside `try {} catch {}` errors, `redirect()` outside ok, `unstable_rethrow` inside catch ok.
- [x] B-05 Add blocks 5 and 6 and tests: `fetch('https://api…commercetools.com/x')` and a template-literal URL are both flagged outside `lib/ct/checkout-session.ts`; `fetch('/api/cart')` inside `components/` is flagged, inside `hooks/` it is allowed.
- [x] B-06 Add `scripts/check-tokens.mjs` with `scripts/check-tokens.test.ts` (temp-dir fixtures: a `.tsx` with `#fff` fails; `globals.css` ignored) and append `npm run check:tokens` to `verify`.

## Unit tests (scenario → test)
| Spec scenario | Test |
| --- | --- |
| Scaffold complete | `test/structure.test.ts`: every directory in the spec exists |
| Client importing server code | B-03 lint test |
| SDK types in a component | B-03 lint test |
| Redirect in try block | B-04 lint test |
| Interactive control (function props) | covered by convention + review; note in H |
| Unknown product (notFound) | tested in L |

## Manual tests to report
- M-B-1: "Open `site/components/ui/x.tsx`, add `import { apiRoot } from '@/lib/ct/client'`, run `npm run lint` → expect an error naming the rule; undo."

## Definition of done
All five rules are proven by lint tests; `verify` includes `check:tokens`; structure test passes.

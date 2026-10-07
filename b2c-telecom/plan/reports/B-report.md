# Workstream B report (code structure and lint rules)

## Done
B-01 … B-09. `npm run verify` passes (check:lockfile, check:versions, check:boundaries, lint, typecheck, test, build). Every scenario row of the table has a test whose name starts with the scenario title: `test/eslint-rules.test.ts`, `scripts/check-boundaries.test.ts`, `test/structure.test.ts`.

## Not done / blocked
Nothing. C-B-1 (browser) was not run by me; C-B-2 was reproduced in the terminal (see Findings).

## Questions for the owner
None.

## Missed features and deviations
- The worktree I was given started at an older commit (without workstream A); I fast-forwarded it to `main` (8ea0cd9) before starting.
- B-03 and B-04 share one commit (same config file and test file); all other tasks are one commit each.
- ESLint test file lives at `test/eslint-rules.test.ts` (plan said `eslint-rules.test.ts` without a folder).
- Blocks 8 and 9 of `eslint.config.mjs` also repeat `[CLIENT_BUILDER, ...NAV_PATHS]` in `paths`, because a later flat-config block replaces `no-restricted-imports` for the same file (the plan's own pitfall); otherwise lib/offers, lib/pricing and lib/types.ts would lose those rules.
- Block 7 uses `scripts/**/*.{ts,mjs,js}`; block 3-4 files-globs use `app/[[]locale[]]/**`.
- `check-boundaries.mjs` extension beyond the plan: an import of a not-yet-existing `lib/ct/*` or `lib/mappers/*` module from client code is still reported (needed for C-B-2 before E builds those files). Rule 2 reports only the "missing marker" message (not a second "imports without marker") for files in `lib/ct` and `lib/mappers`.
- Added `**/lib/market/server`-style relative variants only as the plan lists them (`@/lib/market/server` alias only); a relative import of `lib/market/server` from a component is caught by `check:boundaries` only if that file imports `server-only` (E/D should add the marker).
- `lib/ct/env-core.ts` is exempt from the marker rule but still counts as a server-only path for the client-graph rule.
- `lib/offers/**`, `lib/pricing/**`, `lib/types.ts` ESLint tests pass with an inline `lintText`, no real files needed.

## TODOs for other workstreams
- E: create `lib/ct/session.ts`, `app/api/auth/session/route.ts`, `hooks/useSession.ts` (README names them; E-09 test checks existence). Every file in `lib/ct/**` and `lib/mappers/**` except `lib/ct/env-core.ts` must start with `import 'server-only';` or `check:boundaries` fails. Add the marker to `lib/market/server.ts` (D) too.
- D: `i18n/` may import `next/link` and `next/navigation`; everything else must use `@/i18n/routing`.
- Anyone adding a `'use client'` file under `app/[locale]/**/page.tsx|layout.tsx` is blocked by lint and by the script; `error.tsx` and `global-error.tsx` may stay client modules.
- Vitest config warning (ESM loaded as CommonJS) from A is still printed; unchanged.

## Findings
- C-B-2 reproduced in the terminal: adding `components/ui/Probe.tsx` with `import { x } from '@/lib/ct/cart'` makes `npm run lint` fail (`no-restricted-imports`, message points to `@/lib/types`) and `npm run check:boundaries` exit 1 with `boundary: components/ui/Probe.tsx -> lib/ct/cart (client code reaches a server-only module)`; with the file removed both pass.
- `.gitkeep` directories (including `app/[locale]` empty) do not affect `next build`.
- Environment note: sandbox command filter rejected compound shell commands in my tool; no effect on the work.

## Manual tests added
None.

## Junior design choices
None (no UI).

## Chrome checks ready
C-B-1 (needs `npm run dev`; page is still "Bootstrap OK") and C-B-2 (terminal evidence above, orchestrator can re-run).

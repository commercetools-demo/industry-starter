# Workstream A report (scaffold, tooling, verify)

## Done
A-01 … A-10. `rm -rf node_modules .next && npm ci && npm run verify` passes (9 test files, 27 tests, build OK). Both scenario rows have tests: "Clean clone to running storefront" (`test/bootstrap.test.ts`) and "Framework version below the gate" (`scripts/check-versions.test.ts`).

## Not done / blocked
Nothing. The Chrome checks C-A-1 to C-A-3 were not run (I do not drive a browser); they are ready for the orchestrator.

## Questions for the owner
None.

## Missed features and deviations
- The git root is the worktree root; the plan's "repo root" is `b2c-telecom/` (where `.nvmrc` and `.gitignore` live). `test/gitignore.test.ts` runs `git check-ignore` from `b2c-telecom/`.
- `create-next-app` ignored `--tailwind=false` and installed `tailwindcss` + `@tailwindcss/postcss` anyway; I removed them with `npm uninstall` in A-02 and re-added the pinned versions in A-03. `postcss.config.mjs` was rewritten in A-09 as designed.
- Resolved versions: next 16.2.6, react 19.2.4, next-intl 4.14.9, platform-sdk 8.27.0, ts-client 4.10.0, vitest 5.0.3.
- Scaffold left `site/README.md`, `AGENTS.md`, `CLAUDE.md` (kept; README replaced per A-10). Removed `public/*.svg` and the Geist font imports; `favicon.ico` kept.
- `app/layout.tsx` has no `metadata` export (no hard-coded user-visible strings); D adds it.

## TODOs for other workstreams
- B: add the `server-only` alias in `vitest.config.ts`.
- C: add the `next/font/google` mock in `vitest.setup.ts`; replace `app/globals.css`.
- Vitest prints a harmless warning that `vitest.config.ts` is ESM loaded as CommonJS (`configLoader: native`). Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` or rename to `.mts` if it becomes noisy; I left it as the plan specifies.
- `npm audit` reports 8 vulnerabilities (7 high, 1 critical) in the transitive tree after install; not triaged.

## Findings
- `npx create-next-app@^16` resolved Next 16.2.6 and works non-interactively with the given flags.

## Manual tests added
None.

## Junior design choices
None (no UI beyond the "Bootstrap OK" heading).

## Chrome checks ready
C-A-1, C-A-2, C-A-3.

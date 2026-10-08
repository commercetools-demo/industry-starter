# Workstream A: gaps noticed in the plan or specs

- Spec scenario "Reproducible install" says build "with the variables of `.env.example`", but the file has no values (A-04). Clarify: the build must succeed with empty variables, or `.env.example` needs safe placeholders.
- Spec scenario "No public prefix on secrets" includes "none appears in a client bundle"; the plan has no task for a bundle scan. Added `scripts/check-bundle.mjs` (run by `verify:build`); it is not in `npm run check` because it needs a build.
- Spec scenario "Server-only modules guarded at build time" cannot be proven until `lib/ct` and `lib/session.ts` exist. A guard test exists (vacuous now). D/G should add a test that imports a client component pulling `lib/ct` and expects a build failure if they want true proof.
- Workstream D/H need the session cookie name; `test/request.ts` defaults to `session`.
- `next-env.d.ts` is git-ignored (Next generates it); a clean clone's `tsc --noEmit` still passes, so no change needed, but `.next/types` is only present after a build.
- `eslint-config-next` pulls its own `eslint-plugin-react-hooks` rules (strict React 19 rules such as `set-state-in-effect`); workstream H hooks may trip them.
- Test config does not set `globals: true`; tests must import `describe/it/expect` from `vitest` (matches the type-check setup).
- `npm audit` reports vulnerabilities in transitive dev deps after install; not triaged (D-002 pins old SDK majors).

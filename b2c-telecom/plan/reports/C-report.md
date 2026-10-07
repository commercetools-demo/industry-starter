# Workstream C report (design tokens, fonts, styling)

## Done
C-01 … C-08. `npm run verify` passes (16 test files, 53 passed, 1 skipped; build OK). The build route list is `/` and `/_not-found` only (no `/dev/tokens`). All five scenario rows of the workstream table have a test named after them.

## Not done / blocked
Nothing. The Chrome checks C-C-1 to C-C-6 were not run (I do not drive a browser); they are ready.

## Questions for the owner
None.

## Missed features and deviations
- Task numbering: the task list (C-02 fonts, C-03 parity, C-04 violations + verify step) differs from the Goal text; I followed the task list.
- **Workstream B is not merged yet**: `eslint.config.mjs` has no `NAV_CONTROL_FLOW` / `RAW_CT_FETCH` / `COMPONENT_API_FETCH`. I defined `DESIGN_SYNTAX` near the top of the file (so B's blocks can reference it without a temporal dead zone) and appended one block at the end with `no-restricted-syntax: ['error', ...DESIGN_SYNTAX]`. **When B merges, its `no-restricted-syntax` arrays for `app/**` and `components/**` must spread `...DESIGN_SYNTAX`**, otherwise the last block (C's) replaces B's rules or vice versa. The test "keeps workstream B's raw fetch rule in components" in `eslint-design.test.ts` is skipped until the config contains `RAW_CT_FETCH`; it then runs automatically.
- Deviation from the oxlint original: the font-family regex is `font-family\s*:\s*(?!\s|['"]?(?:Exo|Inter|Roboto))`. The original backtracks `\s*` to zero spaces and therefore flags valid `font-family: Exo`. Messages are verbatim.
- `check-tokens` skips `*.test.*` files in all four scans (several tests legitimately contain `fonts.googleapis.com`, `text-white`, hex values).
- The expected contrast figures in the plan were not all right: white on `pink-950` is 15.74 and on `pink-900` 11.73 (plan listed 12.79). The test asserts the AA threshold for all of them and the exact planner values only where they matched (7.82, 6.01, 5.18, 6.87).
- `app/layout.tsx` keeps `lang="en"`; D replaces it with `lang={locale}` and must keep `className={fontVariables}`.

## TODOs for other workstreams
- B: spread `...DESIGN_SYNTAX` into the existing `no-restricted-syntax` arrays (see above); `check:boundaries` goes after `check:tokens` in `verify`.
- D: keep `className={fontVariables}` (from `./fonts`) on `<html>`; let `/dev/` through the proxy untouched.
- I: set `data-surface="dark"` on the footer and any `brand-950` background.
- Appending to the extensions block of `app/globals.css` needs a one-line comment and an `--ext-` prefix (parity script fails otherwise).

## Findings
- `@theme static` emits all tokens (checked via build); tailwind 4.3.3 resolved.
- `vi.mock('next/font/google')` factories using `vi.fn()` are reset between tests in this Vitest version when module-level imports are used; `fonts.test.ts` therefore uses `vi.resetModules()` and a dynamic import.

## Manual tests added
None.

## Junior design choices
- Layout of `/dev/tokens`: swatch grid with `auto-fill, minmax(9rem, 1fr)`, plain sections with Exo headings, classes `on-brand`, `on-dark`, `breadcrumb`, `error` added as hooks for the Chrome checks.

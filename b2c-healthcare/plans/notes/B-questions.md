# Workstream B: questions and the defaults chosen

| # | Question | Default chosen |
| --- | --- | --- |
| 1 | oxlint 1.87 has no `no-restricted-syntax` and rejects unknown keys (`x-omelette`), so the adherence file cannot be loaded by oxlint. | `site/.oxlintrc.json` holds the adherence rules verbatim plus the generated `x-omelette.tokens` allow-list. ESLint executes its three selectors through the local rule `design/adherence` (`eslint/design-lint.mjs`, warnings). `npm run lint` now runs `oxlint -c eslint/oxlint.json` (a minimal loadable config); a bare `oxlint` in `site/` would fail to parse `.oxlintrc.json`. |
| 2 | Design lint severity: spec says "warns". | Warnings, not errors; `npm run check` does not fail on them. Make it fail with `eslint --max-warnings 0` if the owner wants a hard gate. |
| 3 | The design's font tokens name "Poppins" etc., but next/font self-hosts faces under generated names. | next/font exposes `--font-poppins/--font-lato/--font-roboto`; the storefront-extensions block re-declares `--font-display/--font-meta/--font-body` to point at them (parity ignores the block; the verbatim declarations stay above it). |
| 4 | `@theme inline` maps tokens to themselves (`--color-x: var(--color-x)`) because names equal Tailwind's namespaces. | Works: the unlayered `:root` in tokens.css wins over Tailwind's layered theme output (verified in a build: utilities emit `var(--color-brand-500)`, computed value `#2aa7ff`). `--color-*: initial` removes Tailwind's default palette so only design colors exist. |
| 5 | Plan says 84 tokens; the file has 90 custom properties. | Parity covers all 90. |
| 6 | White-on-azure fails; navy-900 on `--color-action-hover` (brand-600) is 4.38:1, also under AA. | Added extension token `--color-action-label-hover` = navy-950 (5.54:1). Recorded in DECISIONS.md evidence section. SO-01 owner decision still open. |
| 7 | Verbatim font rule `font-family\s*:\s*(?!['"]?(?:Lato\|Poppins\|Roboto))` fires on `font-family: 'Poppins'` (space after the colon), because `\s*` backtracks to zero. | Kept verbatim; only the no-space form passes. See B-missed.md. |
| 8 | `--focus-ring` colour. | `2px solid var(--color-brand-700)` (4.74:1 on white; brand-500 would be 2.3:1) with `outline-offset: 2px`. |

# Workstream B: gaps noticed in the plan or specs

- The adherence file's rules cannot run in oxlint (no `no-restricted-syntax`), contrary to the plan wording "site/.oxlintrc.json"; they run via ESLint (see B-questions 1).
- Adherence font rule false positive: `font-family: 'Poppins'` (with a space) is flagged because of `\s*` backtracking; only strings, not CSS or `style={{ fontFamily }}`, are checked, and `font-family: var(--font-display)` in a string is also flagged. Suggest fixing the regex upstream in the design file (`font-family\s*:\s*(?![\s'"]*(?:var\(--font-|Lato|Poppins|Roboto))`).
- The hex rule matches any string containing `#abc`-like text (e.g. `href="#add"`), and the px rule matches `sizes="(max-width: 768px) 100vw"`; expect occasional warnings that need an eslint-disable with a reason.
- Rules only see string Literals, not template literals or Tailwind arbitrary values in templates.
- navy-900 on the hover fill (brand-600) fails AA (4.38:1); added `--color-action-label-hover`. White on brand-700 would pass (4.74:1) if the owner prefers a darker fill.
- `--text-*` tokens map to Tailwind font-size utilities without line heights (`--text-sm--line-height` is undefined), so `text-sm` falls back to inherited line height.
- Spacing tokens (`--space-*`) have no Tailwind mapping (Tailwind spacing is one `--spacing` base); components should use `var(--space-n)` or the standard scale deliberately.
- `design/DESIGN.md` hover/active states and exact tokens-per-element were not re-audited beyond the spec scenarios.

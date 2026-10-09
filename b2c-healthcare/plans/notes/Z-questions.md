# Z questions (release readiness)

| # | Question | Default chosen |
| --- | --- | --- |
| 1 | The Chrome DevTools connector was down for most of the build. May Playwright (`npm run e2e`, fixtures mode) replace it for browser verification? | Yes; e2e added under `site/e2e/`, not part of `npm run check`. |
| 2 | Link, muted-text and nav-link colours failed 4.5:1 contrast. May the token extensions block override `--color-text-link` (brand-800), `--color-text-muted` (neutral-600) and nav active colours (brand-700)? | Yes, in the "storefront extensions" block only (`tokens.css` parity unaffected). Needs design-owner sign-off with SO-01. |
| 3 | Z-06 requires every workstream `Done`, all OA/SO done. Not possible without credentials and owner sign-offs. | Z-06 left unticked; see FINAL-REPORT.md. |

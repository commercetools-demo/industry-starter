# Evidence for workstream Q (shopper account area)

Made by J23 with a headless Chrome driven over the DevTools protocol against a scratchpad fake commercetools (no live project, no Chrome MCP: ENV-01).

- `Q-run1.txt`: register, reseller binding, cart and garage merge, on-screen reset (known, unknown, real, used and decoy links), demo login with the flag on.
- `Q-run2.txt`: the signed-in account area, de-DE spot checks, console check.
- `Q-run3.txt`: demo login with the flag off.
- `storefront-Q-<step>-<page>-<width>.png`: 375, 768, 1024 and 1440 px. Steps follow the browser recipe of `plans/workstreams/Q-shopper-account-area.md` (03 register and overview, 04 reset and orders, 05 order detail, invoice and reorder, 06 returns, 07 garage, 08 addresses, 09 payment methods, 10 profile and security, 11 subscriptions, 12 German, 13a demo login).
- Not done: the MCP read-backs (no live project). They are rows M-Q02 and M-Q04 to M-Q08 in `plans/TODO-MANUAL-TESTING.md`.
- The gate run: `npm run check` green (241 files, 2208 tests); `npm run verify:build` green in a scratchpad copy of the app.

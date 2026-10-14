<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence B (portal)

Dev server `npm run dev -- -p 3100` in `portal/`, Chrome DevTools MCP, no console errors.

| File | Proves |
| --- | --- |
| `portal-tokens-light-1440.png` | Specimen in light theme. Computed: `--color-bg-page` `#f7f7f7`, top bar `rgb(48, 48, 48)`, surface card `rgb(255, 255, 255)`, Inter only |
| `portal-tokens-dark-1440.png` | After the toggle: `data-theme="dark"`, `--color-bg-page` `#1a1a1a`, surface card `rgb(48, 48, 48)`, top bar still `rgb(48, 48, 48)` |
| `portal-tokens-light-375.png` | Specimen at 375 px |
| `portal-network-fonts.txt` | Fonts self-hosted, no Google host, only Inter faces |
| `portal-check-tokens-fail.txt` | A deliberate raw hex, raw font, raw px and default palette class fail `check-tokens`, each naming the token to use |
| `tokens-diff-portal.txt` | `app/tokens.css` differs from `design/export/tokens.admin.css` only by the removed Google Fonts `@import` line |

Reload persistence: after the toggle `localStorage['malva-portal-theme']` was `dark` and `data-theme` was `dark` after reload.

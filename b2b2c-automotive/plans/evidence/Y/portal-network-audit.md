<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Portal network audit (task Y-08, portal half)

Method: headless Chrome over the DevTools protocol (`Network.requestWillBeSent`) against the dev fixture server (`PORTAL_DEV_FIXTURES=on`, `next dev --webpack`, port 3170), signed in as `adminA`, `de-DE`, one visit per route, every request host recorded. No live commercetools call exists in fixture mode; the check is that the browser itself never contacts one.

| Route | Hosts |
| --- | --- |
| `/`, `/catalog` and its five tabs, `/bundles`, `/import`, `/store/channels`, `/store/share`, `/marketing`, `/email`, `/customers`, `/subscriptions`, `/returns`, `/reviews`, `/partnership`, `/company/users`, `/account/general` | `localhost:3170` only |
| `/store/settings` (branch map) | `localhost:3170`, `tile.openstreetmap.org` (the allowed OpenStreetMap tile host, decision D6) |
| `/store/theme`, `/content/pages`, `/content/blocks` (Contentools managers) | `localhost:3170` and `rsms.me` |

Result: no request to a commercetools API host and none to a Contentools service host; the managers reach Contentools only through the same-origin `/api/contentools` proxy (the fake Contentools was not connected in this run, so the editors showed their not-connected state).

Finding (third party, not fixed): the Nimbus layer inside the Contentools managers links the Inter stylesheet from `rsms.me` when an editor route mounts. The portal's production CSP (`lib/csp.ts`: `style-src 'self' 'unsafe-inline'`, `font-src 'self' data:`) does not allow that host, so in a production build the browser should refuse it and the editors fall back to the self-hosted Inter; check with `list_console_messages` in M-X-05 and add the host to the CSP only if the editors look wrong without it. Listed in `plans/MISSED-FEATURES.md`.

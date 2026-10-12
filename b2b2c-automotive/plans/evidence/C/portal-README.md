<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence C (portal)

| File | Proves |
| --- | --- |
| `curl-portal.txt` | `/` 307 to `/de-DE`; with cookie `en-US` 307 to `/en-US`; wrong case canonicalised; `/de-DE` and `/en-US` 200; `/fr-FR` 404; `/dev/tokens` 200 in development without a locale redirect |
| `portal-de.png` | German placeholder (`lang="de-DE"`, cookie `your-shop-country-locale=de-DE`, tokens applied: page `rgb(247, 247, 247)`, card white, Inter) |
| `portal-en.png` | English placeholder (`lang="en-US"`, cookie `en-US`) |
| `portal-fr-notfound.png` | `/fr-FR` renders the static root not-found page (404) |
| `check-portal.txt` | Tail of the final `npm run check` (all gates OK, 25 test files, 128 tests) |

Bare `/` with the `en-US` cookie landed on `/en-US` in Chrome. No console errors on `/de-DE`, `/en-US`.

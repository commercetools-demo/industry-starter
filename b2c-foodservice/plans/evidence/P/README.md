# Evidence: workstream P

Run on 2026-10-21 against `scripts/mock-ct-server.mjs` (no real project), dev server on port 3000, Chrome DevTools MCP, viewport 1440 px. The browser tool cannot write screenshots into the repository (path outside its workspace roots) and cannot go below 1440 px, so there are no PNG files; results below are the recorded read-backs. Screenshots were inspected inline (About, 404, Journal empty state).

| Step | Result |
| --- | --- |
| 6.2 About | Renders hero, story, three value cards, recycling note, store band, closing band. Console clean except `GET /api/auth/me` 404 (J not built). |
| 6.3 Contact success | Form submitted: confirmation showed `Reference MC-20261021-P93NUG`, `Received by Customer care`. Receiver terminal printed the same reference. Dev server log has the JSON line `{route:contact, reference, topic, status:202}` and no message text. |
| 6.4 Contact failure | Receiver answering 500: `role=alert` text with email and phone, message text kept, button enabled. Empty submit: errors under fields, focus on Name. Fifth rapid call in the same window: 429 with `Retry-After`. |
| 6.5 FAQ | 18 `details`, all closed answers non-empty, `?q=capsules-descale` opens only that one, `#question-account-delete` opens, scrolls into view and focuses the summary. FAQPage JSON-LD lists 18 questions. Threshold text shows `$75.00`, equal to the promise bar. `POST /api/faq-feedback` answers 202 `{recorded:true}`. |
| 6.7 Journal | `?tag=brewing&tag=machines` shows the empty message with two removable chips and Clear all. The withdrawn slug redirects (307) to `/en-US/journal?tag=capsules`; unknown slug 404. |
| 6.8 404 | `/en-US/does-not-exist`, `/en-CA/does-not-exist`, unknown policy and article slugs: document status 404 with shell, search form and five category links. `/xx/foo` redirects to the default locale then 404. `/api/nothing` JSON 404. |
| 6.9 Degraded commerce | Dev server with `CTP_API_URL` unreachable: About, Contact, FAQ, all four policies, Journal and an article returned 200 in under 350 ms with the shell and token fallback text. The listing check is blocked: G has not merged. |
| 6.11 Responsive | Window cannot resize, so pages were framed in iframes of 1080, 900, 700, 520 and 375 px. No overflow from P pages; the same horizontal overflow (1132 px at 1080 and 900, 467 px at 375) appears on every page and comes from F's shell (see PROJECT-FINDINGS). Contact is two columns at 900 and up, channels above the form at 375. |
| Lighthouse | About, Contact, FAQ (desktop): accessibility 100, best practices 96, SEO 100. The two failures are not in P: `/api/auth/me` 404 (J) and the header country button label (F). |
| Sitemap | `/sitemap.xml` and `/robots.txt` return 200. |

Not done: 6.1 footer tour by clicking (covered by unit test and snapshot of footer hrefs), 6.6 checkout (K not built), 6.10 expired session (L not built), 404 status of a product route (H not built), Lighthouse for Terms, Journal and the 404 page (same templates).

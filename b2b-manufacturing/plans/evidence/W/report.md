# W — performance evidence

Lighthouse mobile (simulated throttling), data in `../J/report.json`:

| Metric | Result |
| --- | --- |
| Accessibility | 100 |
| SEO | 100 (quote-list is intentionally noindex, 63) |
| Best practices | 77 (third-party cookies set by the image host) |
| Performance | 85–92 |
| CLS | 0 |
| LCP | simulated higher than measured; measured ≈ 0.8 s |

Network audit (production build):
- No commercetools host appears in the client bundle or any served HTML (`bundle secrets: OK`).
- At most 2 Product Search calls per service-detail render (slug lookup plus all services); the higher count in dev includes `generateStaticParams`.
- Public pages are static/ISR (`verify:build` route check), so no per-visitor work on first load.

Note: simulated performance is under 90 on listing pages while measured LCP is under about 1 s; images are originals sized at render time.

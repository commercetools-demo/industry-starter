# Workstream B: left for later, live checks, owner actions

- SO-01 screenshot pair (white vs navy-900 label on azure) is NOT saved: the Chrome DevTools screenshot tool refused every path I could write to ("not within any of the configured workspace roots"). Computed-style check was done on a temporary page (not committed) rendering `TokenSwatches` on `PORT=3102`: `--color-brand-500` = `#2aa7ff`; button 1 background `rgb(42,167,255)` with colour `rgb(16,40,81)` (navy-900); button 2 same background with `rgb(255,255,255)`; Network: 7 `.woff2` requests, all from `localhost:3102/_next/static/media` (same origin, no Google). To produce the images: once H-10 adds `app/[locale]/_tokens/page.tsx`, open it and save `plans/evidence/SO-01-navy.png` / `SO-01-white.png`.
- `app/[locale]/_tokens/page.tsx` is H-10; it should render `<TokenSwatches />` from `components/dev/TokenSwatches`.
- Scenarios "Action color", "Green means available or free", "Radius by element" are marked N/A in B-design-tokens.md (need real components); H and later should add the tests (and tick them).
- Owner: SO-01 (label colour) needs the owner's decision; also confirm the hover label token `--color-action-label-hover`.
- No PR created; for the PR description, B-08 proof is in `plans/evidence/B-08-parity-failure.txt`.

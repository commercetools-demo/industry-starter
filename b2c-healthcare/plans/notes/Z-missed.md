# Z missed / defects found and fixed by the e2e sweep

Fixed (each with a test):
1. Order pages nested a second `<main>` inside the layout `<main>` (`components/orders/no-nested-main.test.tsx`).
2. Colour contrast below 4.5:1: link (brand-500), muted text (neutral-500), nav active/hover (brand-600), services icon tile, guest-nudge link, "(optional)" hint. Tests: `app/tokens.test.ts`, `components/a11y-contrast.test.tsx`, Header test.
3. Lab results table scroll region not keyboard-focusable (now labelled, `tabIndex=0`).
4. Doctor list and profile lacked canonical/hreflang (now `pageMetadata`).
5. Fixture-only: monotonic fixture cart version (idempotency key), `getActiveCartSafe` TypeError in fixture mode, `/account/profile` crash in fixture mode (new `lib/ct/dev-root.ts`).

Known, unfixed: checkout CLS 0.62 / cart CLS 0.11; doctors heading order; erase-patient and register journeys not in e2e; Lighthouse performance only measured on the dev server; low SEO on private pages is the expected `noindex`.

Security review (Z-05): nothing at confidence >= 8/10 (session JWT, internal endpoints and Netlify guards, `?next` sanitiser, lab PDF route, dev-only demo doors); secrets scan of tracked files clean (only a throwaway e2e `SESSION_SECRET`).

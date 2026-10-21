<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Ideas (parked, not scheduled)

- Search suggestions and typo tolerance (Q-023).
- Recipes and brew guides content linked from products.
- Capsule recycling programme page and returns labels.
- Machine and capsule "starter bundles" as one product.
- Store pages with local events and live opening hours.
- Gift cards.
- French for the Canada market (`fr-CA`); provincial tax (HST/PST) for Canada (D-030, D-036).
- Transactional email (order confirmation, password reset, email verification, subscription reminders) once an email provider is chosen (D-032).
- Review moderation (D-037 removed it).
- Collection in Canada once Canadian stores exist (D-035).
- Replace `vite-tsconfig-paths` with Vite's native `resolve.tsconfigPaths` (vitest prints a deprecation hint); needs the spec's package list updated first (workstream A).
- `app/[locale]` routes are dynamic because the root layout reads the locale from request headers; static rendering would need `setRequestLocale` in a root-level layout (performance, workstream O/Q).
- (E) Replace the local rating rounding in `components/ui/Rating.tsx` with `roundRating` from `lib/utils.ts` once workstream D is merged.
- (E) Vitest globals are off, so Testing Library cleanup is registered in `test/setup.ts`; keep it if A's setup changes.
- (E) Give `ColorSwatch` a documented list of colour keys once the seed `COLOURS` enum is final (an unknown key falls back by CSS `var()` today).
- (F) Remove `app/[locale]/dev/store-picker` (dev harness) and `storefront/scripts/mock-ct-server.mjs` in workstream Q; the mock server is only a local aid for browser checks without credentials.
- (F) Footer links to /contact, /faq, /policies/*, /about, /journal and /account/orders go to `/` until P and J land; then add the paths to `BUILT_ROUTES` in `lib/nav/footer-config.ts`.
- (F) Pull the search icon pill input and suggestions into G once the search page exists; add axe-core to devDependencies (Q-F-13).
- (J) When workstream I lands: replace `AuthCart` with its `CartView`, mutate `KEY_CART` in `useAuthActions`, and add a real guest-bag browser check (B6) instead of the `/api/dev/session` simulation.
- (J) Rate limiter is per instance (`lib/rate-limit.ts`); move to a shared store when hosting runs several instances (Q-J-12, OA-05).
- (J) `scripts/mock-ct-server.mjs` now answers `POST /login`, `POST /customers`, `GET /customers/:id` (six demo customers, password `MOCK_DEMO_PASSWORD`, default `mock-demo-pass-1`); remove with the rest of the mock in Q.

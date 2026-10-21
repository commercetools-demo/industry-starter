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

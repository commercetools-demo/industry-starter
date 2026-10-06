## Why

The MALVA design covers a generic storefront. Decisions D-010…D-044 (`plan/DECISIONS.md`) put grocery behaviors in v1 — delivery slots, weight-based pricing, substitutions, subscriptions — plus auth pages, address book, saved lists, search and static pages, none of which are drawn. The commercetools project `spec-test-b2c` also needs a defined catalog data model (product types, categories, custom types, shipping, tax, recurrence policies) before any page can be built against it.

## What Changes

- Add `catalog-data-model`: the target model for products, product types, variants (weight increments), categories, inventory, custom types, shipping, tax and recurrence policies in `spec-test-b2c`, with a verify-and-seed procedure.
- Add experience specs for the grocery behaviors using Organic components: weight pricing, delivery slots (stub capacity service), substitutions (Order Edits), subscriptions (recurring orders).
- Add design specs for pages the MALVA prototype does not draw: sign-in/register/reset, address book, saved lists, search, static pages.
- All designs here are proposals built from existing Organic components and need owner sign-off (tracked in `plan/TODO-MANUAL-TESTING.md`).

## Capabilities

### New Capabilities
- `catalog-data-model`: commercetools data model and seed/verify rules for `spec-test-b2c`.
- `weight-pricing-experience`: per-unit price, increments, provisional totals.
- `delivery-slot-experience`: address + slot picker in the cart, stub capacity service, revalidation at checkout handoff.
- `substitution-experience`: per-line preference and Order Edit consent on order detail.
- `subscription-experience`: cadence selection and recurring order management.
- `auth-pages-design`: sign-in, registration (auto-verified), password reset, protected account routes.
- `address-book-design`: address list and dialog editing.
- `saved-lists-design`: sign-in-gated save and the saved page.
- `search-design`: search entry, suggestions, results.
- `static-pages-design`: About, FAQ, policies, Contact us, journal placeholder.

### Modified Capabilities
<!-- None in openspec/specs/. Edits to the sibling changes are made in those changes. -->

## Impact

- Requires access to `spec-test-b2c` (via commerce MCP or a Frontend B2C API client) to verify and seed data.
- Adjusts `malva-storefront-design` (checkout becomes hosted; stock status replaces made-to-order; contact link replaces stylist) and `bootstrap-nextjs-storefront` (Vitest, npm, Netlify only, two locales, no CI).
- Deviates from `delivery-slot-booking`: hosted Checkout creates the order, so slot exhaustion is caught at session creation, not placement (D-042).

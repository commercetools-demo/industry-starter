# Follow-up AC: owner and live to-dos

## OA-01 / OA-02: the exact scopes to paste (D-036)

The scope names below were checked against the commercetools Scopes reference (docs.commercetools.com/api/scopes) in this workstream. Replace nothing: the project key is already in each entry.

### OA-02 storefront (Frontend) API client, `CTP_SCOPES` in `site/.env.local` (21 scopes)

```
view_published_products:spec-test-b2c-healthcare view_products:spec-test-b2c-healthcare view_categories:spec-test-b2c-healthcare view_stores:spec-test-b2c-healthcare view_shipping_methods:spec-test-b2c-healthcare view_tax_categories:spec-test-b2c-healthcare view_cart_discounts:spec-test-b2c-healthcare view_discount_codes:spec-test-b2c-healthcare view_types:spec-test-b2c-healthcare manage_customers:spec-test-b2c-healthcare manage_orders:spec-test-b2c-healthcare manage_payments:spec-test-b2c-healthcare manage_sessions:spec-test-b2c-healthcare manage_shopping_lists:spec-test-b2c-healthcare manage_checkout_payment_intents:spec-test-b2c-healthcare manage_recurring_orders:spec-test-b2c-healthcare view_recurrence_policies:spec-test-b2c-healthcare manage_payment_methods:spec-test-b2c-healthcare manage_key_value_documents:spec-test-b2c-healthcare view_project_settings:spec-test-b2c-healthcare view_states:spec-test-b2c-healthcare
```

In the Merchant Center, Settings, Developer settings, Create new API client: pick the template **B2C storefront / Frontend** (it brings the first fourteen, up to `manage_shopping_lists`), then add by hand (if the template lacks them): `manage_sessions`, `manage_checkout_payment_intents`, `manage_recurring_orders`, `view_recurrence_policies`, `manage_payment_methods`, `manage_key_value_documents`, `view_project_settings`, `view_states`. The scope names are the same in the "custom" scope picker (Manage/View per resource) and the Composable Commerce API. If the template is not available in your Merchant Center, tick the 21 above one by one. A reason for each is in `site/.env.example`.

Not requested, deliberately: `manage_custom_objects` (not a scope; Custom Objects are `manage_key_value_documents`), `view_standalone_prices`, any `manage_my_*`, any `manage_project` or `manage_products` (admin).

### OA-01 seed admin API client, `SEED_CTP_SCOPES` in `site/.env.seed.local`

Simplest (one scope):

```
manage_project:spec-test-b2c-healthcare
```

Narrow alternative (22 scopes, each with the script that needs it in `site/.env.seed.example`):

```
manage_products:spec-test-b2c-healthcare manage_categories:spec-test-b2c-healthcare manage_types:spec-test-b2c-healthcare manage_states:spec-test-b2c-healthcare manage_shipping_methods:spec-test-b2c-healthcare manage_tax_categories:spec-test-b2c-healthcare manage_stores:spec-test-b2c-healthcare manage_zones:spec-test-b2c-healthcare manage_orders:spec-test-b2c-healthcare manage_customers:spec-test-b2c-healthcare manage_key_value_documents:spec-test-b2c-healthcare manage_shopping_lists:spec-test-b2c-healthcare manage_payments:spec-test-b2c-healthcare manage_recurring_orders:spec-test-b2c-healthcare manage_recurrence_policies:spec-test-b2c-healthcare manage_quotes:spec-test-b2c-healthcare manage_quote_requests:spec-test-b2c-healthcare manage_staged_quotes:spec-test-b2c-healthcare manage_business_units:spec-test-b2c-healthcare manage_discount_codes:spec-test-b2c-healthcare view_messages:spec-test-b2c-healthcare view_project_settings:spec-test-b2c-healthcare
```

Never reuse the seed client for the storefront.

## Live checks added by this workstream (for `LIVE-TODOS.md` phase A, in the order to run them)

| Id | Do | Expect |
| --- | --- | --- |
| AC-L1 | `npm run seed:full -- --dry-run` (needs `.env.seed.local`) | lists every deletion (customers, recurring orders, orders, carts, reviews, products ..., `malva-*` objects) and every create; `verify and wait-for-search are skipped`; nothing written |
| AC-L2 | `npm run seed:full` | stages `reset`, `cleanup-sample`, `seed`, `images`, `verify` (45+ checks PASS, incl. `every attribute the storefront searches is isSearchable (incl. clinicName)`), `wait-for-search` (28 products); a second `npm run seed` prints `0 change(s)` |
| AC-L3 | `read_product_types` (MC MCP) for `mlv-doctor` | `clinicName` has `isSearchable: true` (D-039) |
| AC-L4 | on the live index: `/en-US/search?q=Austin%20Central` and the doctor list filter text "Central" | doctors of "Malva Clinic · Austin Central" match (the clinic full-text clause `fullText { field: variants.attributes.clinicName, fieldType: text }` is unverified against a live index; if the API rejects `fieldType: text` there, drop `fieldType` in `buildClinicMatch`) |
| AC-L5 | open `/en-US` (home) and `/en-US/doctors/remote` on the live project | every doctor card shows a portrait, the hero, prescription-delivery block and the closing band show photos, `/en-US/journal` covers show photos (no gradient); browser console shows no CSP image violations (host `media.istockphoto.com` is allowed in `netlify.toml`) |
| AC-L6 | A seed on an older project (one seeded before AC): `npm run seed` | prints `updated` for `product type mlv-doctor` (changeIsSearchable / new attributes), `type mlv-rx-line` (new fields), `product mlv-doc-tomas-alvarez`/`mlv-doc-leila-haddad` (prices) instead of stopping |

## Owner decision needed (also in `AC-questions.md`)

- Image licence: see `AC-questions.md` Q1 (the no-key endpoint serves iStock thumbnails, not Pexels licence photos).

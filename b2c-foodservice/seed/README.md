<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# seed/

Idempotent scripts that put everything the Malva Coffee shop (B2C online coffee retailer, markets US and Canada, D-030) needs into its commercetools project, and remove the sample data the project came with, only through a reviewed manifest. Data model: `../plans/SEED-PLAN.md`. Decisions: `../plans/DECISIONS.md`. Open questions: `../plans/notes/questions-seed.md`. Owner-only items: `../plans/notes/todo-seed.md`.

**Status:** type-checked and unit-tested offline (`npm run check`: `tsc --noEmit` and vitest, the SDK is replaced by an in-memory fake API). **Never run against a project** (no credentials where it was written). The first live run needs an API client in `seed/.env.local`.

## Quick start

1. **Env.** `cp .env.example .env.local` and fill in `SEED_CTP_PROJECT_KEY`, `SEED_CTP_AUTH_URL`, `SEED_CTP_API_URL`, `SEED_CTP_CLIENT_ID`, `SEED_CTP_CLIENT_SECRET`, `SEED_CTP_SCOPES`, `EXPECTED_PROJECT_KEY` (the project key typed again) and `SEED_DEMO_PASSWORD` (at least 10 characters, the password of the six demo customers). Optional `IMAGE_SOURCE_URL`. Never commit or paste these.
2. **Check offline.** `npm install && npm run check`, then `npm run seed -- --dry-run --offline` (the full plan against an in-memory API, 1115 changes, no credentials).
3. **Run order against the project:** see below.

## Safety rules

- Credentials only from `seed/.env.local` (then `seed/.env`), both git-ignored; the template `.env.example` has names only. Secrets are never printed, logged or committed.
- Every script aborts unless `SEED_CTP_PROJECT_KEY` equals the separately typed `EXPECTED_PROJECT_KEY` **and** the key the API itself reports (it prints both keys on a mismatch). A key containing `health` (another team's project) is always refused.
- Every script supports `--dry-run`: it prints the plan and writes nothing.
- Everything the seed creates has the key prefix `mcf-`. The keys other code reads by fixed name (order states, review states, custom types) are listed in `CONTRACT_KEYS` in `src/data/base.ts` (they carry the prefix too). `reset` deletes only keys from the data files that match `mcf-` or `CONTRACT_KEYS`.
- **Cleanup is manifest-based, never a wildcard.** `seed:inventory` reads the project and writes `cleanup-manifest.json` (git-ignored); you review it and delete lines that must stay; `seed:cleanup` deletes only what the manifest lists. It refuses, before any request, a wrong `--confirm`, a manifest of another project and a manifest older than 24 hours; it refuses and reports any entry whose key starts with `mcf-`. Orders and carts are never listed or deleted (the API cannot delete them).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run check` | `tsc --noEmit` and all tests (offline) |
| `npm test` / `npm run lint` | tests only / type check only |
| `npm run seed:settings` | Product Search indexing on (`changeProductSearchIndexingEnabled`, mode `ProductsSearch`, waits for `Activated`), `changeCountryTaxRateFallbackEnabled` true, countries US CA, currencies USD CAD, languages en-US en-CA (added, never removed) |
| `npm run seed:inventory` | reads the project, writes `cleanup-manifest.json` (type, key or id, name, version, depth, count per type, createdAt); deletes nothing |
| `npm run seed:cleanup -- --manifest <file> --confirm <projectKey>` | deletes the manifest entries in dependency order (reviews, lists, customers, discount codes, discounts, inventory, products unpublished then deleted, shipping methods, tax categories, zones, categories deepest first, product types, recurrence policies, channels, types, states) |
| `npm run seed` | idempotent upsert of everything, in dependency order (steps below); a second run says `0 change(s)` |
| `npm run seed:images` | GETs `IMAGE_SOURCE_URL`, records clean image URLs into `src/data/images.json` (no commercetools access) |
| `npm run verify` | read-back checks, exit 1 on any mismatch (including prices and review statistics) |
| `npm run reset -- --confirm <projectKey>` | deletes the seed's own resources so `seed` can rebuild from nothing |

Seed steps (`--only a,b`): `settings tax shipping states types product-types categories channels recurrence products prices inventory discounts customers shopping-lists reviews`. A step whose prerequisites are neither in the run nor in the project is skipped and reported, never created silently. `products` creates products (names, descriptions, attributes, images); `prices` sets the embedded prices of every variant including the recurrence prices of subscribable products.

## Run order (live)

```bash
cd seed && cp .env.example .env.local        # fill in; never paste secrets in chat
npm install && npm run check
npm run seed:inventory                        # 1. read the project, write cleanup-manifest.json
# 2. review the manifest (open it, delete entries that must stay)
npm run seed:cleanup -- --manifest cleanup-manifest.json --dry-run
npm run seed:cleanup -- --manifest cleanup-manifest.json --confirm <projectKey>   # 3. within 24 hours
npm run seed:settings -- --dry-run && npm run seed:settings                       # 4.
npm run seed -- --dry-run                     # 5. review the plan
npm run seed                                  # 6.
npm run seed                                  # 7. second run must report 0 change(s)
npm run seed:images                           # 8. needs the image endpoint (OA-03), then:
npm run seed                                  # 9. adds the images to the existing products
npm run verify                                # 10.
```

No credentials? `npm run seed -- --dry-run --offline` runs the whole seed against an in-memory API and prints the plan a fresh project would get (1112 changes: 41 products, 41 price updates, 805 inventory entries, 162 reviews, 20 categories, 6 stores, 6 customers, ...).

## Images

`seed:images` sends exactly one `GET <IMAGE_SOURCE_URL>` (never a browser, never a retry, never a bypass). The response must have the shape of `sample-data/image.json`: `pageProps.initialData.data[].attributes.image.download_link` (fallback `image.large`), `attributes.width`, `attributes.height`, `attributes.description`. It stores **clean** URLs (scheme, host and path only: query and fragment are stripped) with width, height and description in `src/data/images.json`. On HTTP 403 or an answer that is not JSON it stops with a message that points to OA-03 in `plans/TODO-MANUAL-TESTING.md`. `seed` uses the recorded file when present and otherwise seeds without images; re-running `seed` after the file exists adds images to the existing products (variant images) and categories (assets), round-robin by tag (capsule, coffee, machine, cup) matched from the photo description. Resizing happens at render time only.

## Reviews

No moderation (D-037): there are no review states and no `mcf-review-pending`; every review is published on creation and counts in statistics at once. 162 reviews on 25 top products (3 to 12 each, none on the other 16, so the empty state is testable), keyed `mcf-review-<sku>-<n>`, written through the Reviews API (target product, customer, rating, title, text, locale en-US or en-CA, authorName). Reviews 1 to 6 of a product come from the six demo customers, reviews 7 to 12 have no customer (synthetic author names). `verify` compares each product's `reviewRatingStatistics.count` and average with the seeded review count and average; the fake API computes the statistics deterministically.

## Demo customers (password `SEED_DEMO_PASSWORD`, at least 10 characters)

Created already verified (`isEmailVerified: true`, no email flow, D-032): `maya.okonkwo@example.com`, `liam.carter@example.com`, `noah.patel@example.com` (US) and `priya.nair@example.com`, `lucas.tremblay@example.com`, `ava.mackenzie@example.com` (CA). Maya has the saved-items list `mcf-saved-maya`.

## Files

`src/lib.ts` env, guards, runner · `src/api.ts` thin API layer over the SDK · `src/fake-api.ts` in-memory API for tests and `--offline` · `src/sync.ts` pure "what differs" planners · `src/seed.ts` · `src/settings.ts` · `src/inventory.ts` · `src/cleanup.ts` · `src/reset.ts` · `src/verify.ts` · `src/images.ts` · `src/data/*` the data · tests next to the code · `src/fixtures/image-source.json` complete invented fixture of the documented image endpoint shape.

## Markets, tax, shipping and stores (D-030, D-035, D-036)

Countries US and CA, currencies USD and CAD, languages en-US and en-CA. CAD prices are about 1.37 times USD, rounded to 5 cents. Tax (all tax-exclusive): food 0% in both markets; standard 8% US country rate (New York 8.875%) and 5% GST for Canada as a country-level rate, so `changeCountryTaxRateFallbackEnabled` covers every province. Zones `mcf-zone-us` and `mcf-zone-ca`; standard shipping 6.95 USD (free above 75) and 8.95 CAD (free above 99), express 14.95 USD and 19.95 CAD; `mcf-collect` exists for the US zone only. Six stores, all in New York City, each ready in 30 minutes, with inventory per store. The line-item field `fulfilment` takes `collect`, `delivery` or `subscribe`.

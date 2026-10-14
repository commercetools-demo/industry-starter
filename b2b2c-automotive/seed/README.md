<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# seed/

Idempotent scripts that put everything the Malva B2B2C automotive sites (reseller storefront and partner portal) need into the commercetools project `spec-test-b2b2c-automotive`, and remove the sample data it came with. Plan, data model and decisions: `../plans/SEED-PLAN.md`. Open questions: `../plans/notes/questions-seed.md`.

**Status:** type-checked and unit-tested offline (`npm run check`: `tsc --noEmit` and 100+ vitest tests, SDK mocked by an in-memory fake API). **Never run against a project** (no credentials where it was written). The first live run needs OA-01 (an API client in `seed/.env.local`).

## Quick start

1. **Env.** `cp .env.example .env.local` and fill in `SEED_CTP_PROJECT_KEY`, `SEED_CTP_AUTH_URL`, `SEED_CTP_API_URL`, `SEED_CTP_CLIENT_ID`, `SEED_CTP_CLIENT_SECRET`, `SEED_CTP_SCOPES` (an API client with manage scopes for the project, OA-01), `EXPECTED_PROJECT_KEY` (the project key typed again, must be `spec-test-b2b2c-automotive`) and `SEED_DEMO_PASSWORD` (at least 10 characters; the demo login password of the apps, `DEMO_LOGIN_PASSWORD` there). Optional `PEXELS_BUILD_ID`. Never commit or paste these.
2. **Check offline.** `npm ci && npm run check` (type check and all tests, no network) then `npm run seed -- --dry-run --offline` (full plan against an in-memory API, 645 changes).
3. **Order against the project:** `seed:cleanup -- --dry-run`, `seed:cleanup -- --confirm <projectKey>`, `seed:settings`, `seed -- --dry-run`, `seed`, `seed` again (must say `0 change(s)`), `verify`. Images last: `seed:images` (OA-03), then `seed` once more.
4. **Start over:** `npm run reset -- --confirm <projectKey>` then `npm run seed`.

## Safety rules

- Credentials only from `seed/.env.local` (then `seed/.env`), both git-ignored; the template is `.env.example`. Never print or commit them.
- Every run aborts unless `SEED_CTP_PROJECT_KEY` equals the separately typed `EXPECTED_PROJECT_KEY`, always aborts for a key containing `healthcare`, and compares the key the API itself reports.
- Everything the seed creates has the key prefix `mau-` (custom object containers `mau-vehicles`, `mau-assortment`, `mau-site`; plus the one Contentools key `configuration/default-theme`). Exceptions, because the apps read them by fixed key: the custom types `store-settings`, `branch-info`, `malva-customer`, `malva-checkout`, `malva-line`, `malva-return-item` and the order state `ready-for-pickup` (list `CONTRACT_KEYS` in `src/data/base.ts`), and standalone prices, whose keys are `<sku>__...` (`isSeedPriceKey` in `src/data/prices.ts`). `reset` deletes only keys that match one of these three rules. One contract custom object is seeded outside the `mau-` containers: `malva-local-review/mau-reseller-south--mau-local-sk-2002` (only written when missing; `reset` deletes exactly that key).
- `seed:cleanup` deletes **only** keys from the explicit allow-list `src/data/sample-allowlist.ts` (read from the project on 2026-10-12). No wildcard, anything not listed stays, anything with `mau-` is refused. A real run needs `--confirm <projectKey>`.
- `reset` deletes only the seed's own keys (from the data files).
- `--dry-run` on every script prints the plan and writes nothing.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run check` | `tsc --noEmit` and all tests (offline) |
| `npm test` / `npm run lint` | tests only / type check only |
| `npm run seed:settings` | Product Search indexing on (waits for `Activated`), `countryTaxRateFallbackEnabled` kept true |
| `npm run seed:cleanup` | delete the known sample data (order: standalone prices, products, discounts, shipping, tax, zones, categories deepest first, product types, recurrence policies, channels) |
| `npm run seed` | idempotent upsert of everything, in dependency order (steps below) |
| `npm run seed:images` | record clean Pexels image URLs into `src/data/*-images.json` (no commercetools access) |
| `npm run verify` | read-back checks, exit 1 on any mismatch |
| `npm run reset` | delete the seed's own resources so `seed` can rebuild from nothing |
| `npm run purge:test-data` | dry run by default: deletes only records listed in `plans/evidence/*/test-data.md` (rows `\| kind \| id \| note \|`) that still carry the `TST-` marker and not the `mau-` prefix; `-- --apply --confirm <projectKey>` to delete (workstream Z-07, M-Z-03). `src/purge-test-data.test.ts` also proves that `reset` removes everything the seed creates. |

Seed steps (`--only a,b`): `settings tax-shipping product-types categories types states channels recurrence vehicles products prices inventory reviews stores selections roles customers business-units discounts tailoring content`. All prices are standalone prices (step `prices`, Q-003); there is no price floor, no wholesale store, no customer group, no territory rule and no email or outbox data.

## Run order (live)

```bash
cd seed && cp .env.example .env.local        # fill in (OA-01); never paste secrets in chat
npm ci && npm run check
npm run seed:cleanup -- --dry-run            # review the counts, then:
npm run seed:cleanup -- --confirm spec-test-b2b2c-automotive
npm run seed:settings -- --dry-run && npm run seed:settings
npm run seed -- --dry-run && npm run seed
npm run seed                                  # second run must report 0 change(s)
npm run seed:images                           # needs OA-03 (pexels.com reachable), then: npm run seed
npm run verify
```

No credentials? `npm run seed -- --dry-run --offline` runs the whole seed against an in-memory API and prints the plan a fresh project would get (645 changes: 55 products, 220 standalone prices, 209 inventory entries, 22 reviews, 26 vehicles, 33 categories, 5 tailorings, ...).

## Images

`seed:images` sends exactly `GET https://www.pexels.com/_next/data/<buildId>/en-US/search.json?q=<query>` (default build id `8mTEncX7SLQB15n9Vvhgq`, override with `PEXELS_BUILD_ID` or `--build-id`; the id changes whenever pexels.com deploys). It stores **clean** URLs (no query, no fragment) for products, categories and banners, landscape photos first, with the original photo's width and height. It never uses a browser and never tries to get around Cloudflare: on HTTP 403 or a "Just a moment" page it stops with a message that points to OA-03 in `plans/TODO-MANUAL-TESTING.md`. Options: `--dry-run` (print requests, no network), `--only <key[,key]>`, `--count <1-6>`. `seed` uses the recorded JSON when present and leaves images empty otherwise; re-running `seed` after recording images adds them to existing products.

## Demo users (password `SEED_DEMO_PASSWORD`, at least 10 characters)

Shoppers (store-bound): `anna.schneider@example.com`, `jonas.weber@example.com` (north), `mia.fischer@example.com`, `liam.carter@example.com` (south, US). Partner portal (Admin and Buyer only, Approver and wholesale are out of scope): `north.admin|buyer@example.com`, `south.admin|buyer@example.com`, `malva.admin@example.com`.

## Files

`src/lib.ts` env, guards, runner · `src/api.ts` thin API layer over the SDK · `src/fake-api.ts` in-memory API for tests and `--offline` · `src/sync.ts` pure "what differs" planners · `src/seed.ts` · `src/settings.ts` · `src/cleanup.ts` · `src/reset.ts` · `src/verify.ts` · `src/images.ts` · `src/drafts.ts` · `src/data/*` the data (`sample-allowlist.ts` is the cleanup allow-list) · tests next to the code · `src/fixtures/pexels-search.json` invented fixture of the documented Pexels shape.

# seed/

Idempotent scripts that put everything the Malva site needs into a commercetools project, and remove the sample data it came with. Plan and data model: `../plans/SEED-PLAN.md`. Decisions: `../plans/DECISIONS.md` (D10, D12, D14–D19).

**Status:** type-checked and unit-tested offline (`npm run check`, 49 tests). **Not yet run against a project** — blocked on OA-01 (the `spec-b2b-manufacturing` project/MCP and a seed API client).

## Safety rules
- Credentials only from `seed/.env (or .env.local)` (git-ignored; template `.env.example`). Never print or commit them.
- The run aborts unless `SEED_CTP_PROJECT_KEY` equals the separately typed `EXPECTED_PROJECT_KEY`, and **always** aborts for a project key containing `healthcare` (another team's project). It also reads the project and compares the key the API reports.
- Everything created has the key prefix `mpw-`.
- **No wildcard deletion.** `inventory-sample` writes a manifest of every non-`mpw-` resource; it is reviewed; `cleanup-sample` deletes exactly the manifest and refuses entries owned by the seed. `reset-seed` deletes only the seed's own explicit key lists.
- `--dry-run` on every script prints the plan and writes nothing (neither the project nor the JSON files).

## Run order
```bash
cd seed && cp .env.example .env.local   # fill in (OA-01); never paste secrets in chat
npm ci && npm run check
npm run configure -- --dry-run && npm run configure   # Product Search indexing, tax-rate fallback, GB/GBP/en-GB
npm run inventory                                       # writes src/data/sample-inventory.json  -> REVIEW IT
npm run cleanup -- --manifest src/data/sample-inventory.json --confirm <projectKey> --dry-run
npm run cleanup -- --manifest src/data/sample-inventory.json --confirm <projectKey>
npm run seed -- --dry-run && npm run seed               # steps: tax zone shipping product-types categories types roles products related store selection demo portal
npm run seed                                            # second run must report 0 change(s)
npm run verify
```
Rebuild from nothing: `npm run reset -- --confirm <projectKey>` then `npm run seed`.

## Images
Product and banner images are the clean URLs in `src/data/product-images.json` and `src/data/site-images.json`; `npm run seed` applies them. **Stored URLs are clean (no query string, no fragment).**

## Demo users
`demo.admin@example.com` (admin), `demo.site@example.com` (site contact), `demo.finance@example.com` (finance) of company `mpw-demo-co`; `other.admin@example.com` of `mpw-other-co`. Password: `SEED_DEMO_PASSWORD`.

## Files
`src/lib.ts` safety + helpers · `src/data/*` the data · `src/configure-project.ts` · `src/inventory-sample.ts` · `src/cleanup-sample.ts` · `src/seed.ts` · `src/verify.ts` · `src/reset-seed.ts` · `src/delete-test-company.ts` · tests next to them.

## Removing a test company

Companies registered through the site while testing are named `Test …` so their key starts with `mpw-test-`. Remove one, with its customers, using:

```bash
npm run delete-test-company -- mpw-test-<suffix>
```

The script refuses any other key.

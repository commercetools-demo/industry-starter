# Workstream E: what is left (live work, blocked on OA-01)

E-01..E-09 are implemented and unit-tested offline (fake project, no network). **E-10 is NOT done and not ticked**: it needs the seed admin API client (OA-01). Nothing was run against any real project.

## Preconditions (owner)
1. Create an API client in `spec-test-b2c-healthcare` with the scopes listed in `site/.env.seed.example` (best guess: manage_products, manage_categories, manage_orders, manage_project or the narrower manage_* set).
2. Copy `site/.env.seed.example` to `site/.env.seed.local` and fill `SEED_CTP_*` (never commit, never paste in chat). `SEED_CTP_PROJECT_KEY` must be `spec-test-b2c-healthcare`; the scripts refuse anything else.
3. Product Search indexing is already Activated (project findings).

## Run instructions (E-10), from `b2c-healthcare/site/`
```
npm ci
npm run seed:inventory                       # record the table in plans/PROJECT-FINDINGS.md (customers/orders/carts counts are the empty rows)
npm run seed:cleanup -- --dry-run            # review the list: only unprefixed resources; usa and europe zones stay
npm run seed:cleanup -- --confirm spec-test-b2c-healthcare
npm run seed -- --dry-run                    # review
npm run seed                                 # must finish without STOP
npm run seed                                 # second run must print "0 change(s) in N step(s)"
npm run seed:wait                            # polls Product Search until 28 products are indexed (5 min timeout)
npm run seed:images -- --dry-run             # review the picks (needs internet, no credentials used for pexels)
npm run seed:images                          # replaces images, republishes, writes data/product-images.json + data/site-images.json
git diff scripts/seed/data/*.json            # commit the generated JSON (currently `{}` placeholders)
npm run seed                                 # still 0 changes? (images are not compared, products exist)
npm run seed:verify                          # all checks PASS
npm run seed:inventory                       # final counts for PROJECT-FINDINGS.md
```
Then tick E-10 and fill the empty rows of `plans/PROJECT-FINDINGS.md` (no secrets).

## Placeholders generated live
- `scripts/seed/data/product-images.json` and `data/site-images.json` are committed as `{}`. `seed:verify` fails the "every product has images" check until `seed:images` ran (use `--no-images` before). `site/content/images.ts` (workstream G/H) must tolerate empty `site-images.json`.

## Things to confirm live (see E-questions.md)
- Zone `usa` has the key `usa`; Product Search `prefix` on `key` and `fullText` language `en-US` are accepted; `seed:images` endpoint still answers (undocumented); the first `seed` run may stop on a diff if the sample project already holds an `mlv-` resource.
- Browser recipe (Claude with `spec-b2c-health` MCP): `read_products`, `read_product_search` ("Okafor", facets specialty/modes), `read_shipping_methods`, `read_states`, `read_types`, `read_product_types`, `read_categories`; open image URLs in a browser.

## Not in E (owned elsewhere)
- Patients, prescriptions, labs, reviews, schedules, custom objects (`malva-*` containers): workstream F.

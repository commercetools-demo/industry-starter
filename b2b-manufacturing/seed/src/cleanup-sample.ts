import { readFileSync } from 'node:fs';
import { getAdminRoot, parseArgs, Runner, sleep, type Root } from './lib';
import { deletionOrder, validateManifest, type Manifest, type ManifestEntry } from './sample-manifest';

/**
 * Deletes EXACTLY the entries of a reviewed manifest (see inventory-sample.ts) and nothing else.
 *
 *   npx tsx src/cleanup-sample.ts --manifest src/data/sample-inventory.json --confirm <projectKey> [--dry-run]
 *
 * Refuses: a manifest for another project, an entry owned by the seed (`mpw-`), a missing/incorrect --confirm.
 */
async function remove(root: Root, e: ManifestEntry): Promise<void> {
  const v = { version: e.version };
  switch (e.kind) {
    case 'orders': await root.orders().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'quotes': await root.quotes().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'staged-quotes': await root.stagedQuotes().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'quote-requests': await root.quoteRequests().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'carts': await root.carts().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'inventory': await root.inventory().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'business-units': await root.businessUnits().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'customers': await root.customers().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'product-selections': await root.productSelections().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'stores': await root.stores().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'products': {
      // A published product must be unpublished before it can be deleted.
      const p = (await root.products().withId({ ID: e.id }).get().execute()).body;
      let version = p.version;
      if (p.masterData.published) version = (await root.products().withId({ ID: e.id }).post({ body: { version, actions: [{ action: 'unpublish' }] } }).execute()).body.version;
      await root.products().withId({ ID: e.id }).delete({ queryArgs: { version } }).execute();
      break;
    }
    case 'categories': await root.categories().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'product-types': await root.productTypes().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'shipping-methods': await root.shippingMethods().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'tax-categories': await root.taxCategories().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'zones': await root.zones().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'types': await root.types().withId({ ID: e.id }).delete({ queryArgs: v }).execute(); break;
    case 'custom-objects': await root.customObjects().withContainerAndKey({ container: e.container ?? '', key: e.key ?? '' }).delete().execute(); break;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest) throw new Error('--manifest <file> is required (run inventory-sample.ts first and review it)');
  const { root, env } = await getAdminRoot();
  if (args.confirm !== env.projectKey) throw new Error(`--confirm must equal the project key "${env.projectKey}"`);
  const manifest = JSON.parse(readFileSync(args.manifest, 'utf8')) as Manifest;
  const errors = validateManifest(manifest, env.projectKey);
  if (errors.length > 0) throw new Error(`Manifest rejected:\n- ${errors.join('\n- ')}`);
  const run = new Runner(args.dryRun);
  let failed = 0;
  for (const e of deletionOrder(manifest.entries)) {
    try {
      await run.act(`delete ${e.kind} ${e.key ?? e.id}${e.name ? ` (${e.name})` : ''}`, () => remove(root, e));
      await sleep(80);
    } catch (err) {
      failed += 1;
      console.error(`FAILED ${e.kind} ${e.key ?? e.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`${args.dryRun ? 'dry run: ' : ''}${run.changes} deletion(s), ${failed} failed`);
  if (failed > 0) process.exit(1);
}

if (process.argv[1]?.endsWith('cleanup-sample.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

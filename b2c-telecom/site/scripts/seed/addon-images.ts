// Puts the recorded photo (data/product-images.json) on every add-on offer of a live project, and nothing else:
//   seed:addon-images                                       read-only: lists what would change (default)
//   seed:addon-images -- --execute --confirm-project <key>  adds the missing images, removes the ones the lock no longer has, republishes
// The full seed does the same as part of the catalog; this is the narrow, safe way to refresh add-on pictures alone. Idempotent.
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { addonOffers } from './data/offers/addons';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { getByKey, postUpdate, type UpdateAction, type Versioned } from './reconcilers/util';

export interface AddonImagesDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  log?: Log;
}

type Variant = { sku?: string; images?: { url: string }[] };
type ExistingAddon = Versioned & { masterData: { published: boolean; hasStagedChanges?: boolean; staged: { masterVariant: Variant; variants?: Variant[] } } };

export interface AddonImagePlan {
  key: string;
  sku: string;
  /** `missing` = the product is not in the project yet (run the seed first). */
  status: 'missing' | 'ok' | 'change';
  actions: UpdateAction[];
  existing?: ExistingAddon;
}

/** What every add-on should show: the images the manifest draft carries (from the lock). An add-on without one is a data error. */
export function wantedAddonImages(): { key: string; sku: string; images: { url: string; label?: string; dimensions: { w: number; h: number } }[] }[] {
  return addonOffers.map((draft) => ({ key: draft.key, sku: draft.masterVariant.sku, images: (draft.masterVariant.images ?? []) as { url: string; label?: string; dimensions: { w: number; h: number } }[] }));
}

export async function planAddonImages(api: CtApi): Promise<AddonImagePlan[]> {
  const plans: AddonImagePlan[] = [];
  for (const wanted of wantedAddonImages()) {
    const existing = await getByKey<ExistingAddon>(api, 'products', wanted.key);
    if (!existing) {
      plans.push({ key: wanted.key, sku: wanted.sku, status: 'missing', actions: [] });
      continue;
    }
    const have = (existing.masterData.staged.masterVariant.images ?? []).map((image) => image.url);
    const actions: UpdateAction[] = [
      ...wanted.images.filter((image) => !have.includes(image.url)).map((image): UpdateAction => ({ action: 'addExternalImage', sku: wanted.sku, image })),
      ...have.filter((url) => !wanted.images.some((image) => image.url === url)).map((url): UpdateAction => ({ action: 'removeImage', sku: wanted.sku, imageUrl: url })),
    ];
    // A product that is live stays live: the staged change is published with it.
    if (actions.length > 0 && existing.masterData.published) actions.push({ action: 'publish' });
    plans.push({ key: wanted.key, sku: wanted.sku, status: actions.length > 0 ? 'change' : 'ok', actions, existing });
  }
  return plans;
}

export async function main(argv: string[], deps: AddonImagesDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  const execute = args.flags.has('execute');
  try {
    const empty = wantedAddonImages().filter((entry) => entry.images.length === 0);
    if (empty.length > 0) {
      log(`No image in data/product-images.json for: ${empty.map((entry) => entry.key).join(', ')}`);
      return EXIT.FAILED;
    }
    const { api } = await getAdminApi({ mode: execute ? 'write' : 'read', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const plans = await planAddonImages(api);
    let failed = 0;
    for (const plan of plans) {
      if (plan.status === 'missing') {
        log(`missing    ${plan.key}: not in the project, run the seed first`);
        failed += 1;
      } else if (plan.status === 'ok') {
        log(`unchanged  ${plan.key}`);
      } else if (!execute) {
        log(`would set  ${plan.key} (${plan.actions.filter((action) => action.action !== 'publish').length} image change(s))`);
      } else {
        try {
          await postUpdate(api, 'products', plan.existing as Versioned, plan.actions);
          log(`updated    ${plan.key}`);
        } catch (error) {
          failed += 1;
          log(`failed     ${plan.key}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    if (!execute && plans.some((plan) => plan.status === 'change')) {
      log('Read-only: nothing was changed. Run `npm run seed:addon-images -- --execute --confirm-project <key>` to apply (the `--` matters: without it npm swallows the flags).');
    }
    return failed > 0 ? EXIT.FAILED : EXIT.OK;
  } catch (error) {
    return exitCodeForError(error, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}


// npx tsx scripts/demo/set-offer-published.ts --confirm-project spec-test-b2c-telecom <offerKey> <true|false>
// Workstream T, for the Chrome checks: publishes or unpublishes the `malva-offer` product with this key, so a saved-list line becomes
// "No longer available". Run again with `true` to restore. The catalog cache lasts one minute (H). Allow-listed project, `malva-` keys only (D-054).
import { consoleLog, exitCodeForError, parseArgs, type Log } from '../seed/cli';
import { EXIT, isOwnedKey } from '../seed/config';
import { getAdminApi, loadSeedEnv, type CtApi } from '../seed/lib';

export async function setOfferPublished(api: CtApi, offerKey: string, published: boolean): Promise<void> {
  if (!isOwnedKey('product', offerKey)) throw new Error(`Refusing: ${offerKey} is not a malva- key`);
  const product = (await api.get(`products/key=${offerKey}`)) as { version: number } | null;
  if (!product) throw new Error(`No product with key ${offerKey}`);
  await api.post(`products/key=${offerKey}`, { version: product.version, actions: [{ action: published ? 'publish' : 'unpublish' }] });
}

export async function main(argv: string[], deps: { api?: CtApi; source?: Record<string, string | undefined>; log?: Log } = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  const positional = argv.filter((arg, i) => !arg.startsWith('--') && argv[i - 1] !== '--confirm-project');
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const [offerKey, flag] = positional;
    if (!offerKey || (flag !== 'true' && flag !== 'false')) throw new Error('Usage: <offerKey> <true|false>');
    await setOfferPublished(api, offerKey, flag === 'true');
    log(`${offerKey}: ${flag === 'true' ? 'published' : 'unpublished'}`);
    return EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

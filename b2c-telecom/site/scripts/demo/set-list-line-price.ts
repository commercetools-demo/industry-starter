// npx tsx scripts/demo/set-list-line-price.ts --confirm-project spec-test-b2c-telecom <listKey> <lineIndex> <savedAmountCents>
// Workstream T, for the Chrome checks: sets the saved price (custom field `savedAmountCents`) of the n-th line (0-based) of a saved list,
// so the list page shows a "Price changed" badge. Allow-listed project only (D-054).
import { consoleLog, exitCodeForError, parseArgs, type Log } from '../seed/cli';
import { EXIT } from '../seed/config';
import { getAdminApi, loadSeedEnv, type CtApi } from '../seed/lib';

interface ListRow {
  id: string;
  version: number;
  lineItems: Array<{ id: string }>;
}

export async function setListLinePrice(api: CtApi, listKey: string, index: number, cents: number): Promise<string> {
  const list = (await api.get(`shopping-lists/key=${listKey}`)) as ListRow | null;
  if (!list) throw new Error(`No shopping list with key ${listKey}`);
  const line = list.lineItems[index];
  if (!line) throw new Error(`The list has ${list.lineItems.length} lines; there is no line ${index}`);
  await api.post(`shopping-lists/key=${listKey}`, { version: list.version, actions: [{ action: 'setLineItemCustomField', lineItemId: line.id, name: 'savedAmountCents', value: cents }] });
  return line.id;
}

export async function main(argv: string[], deps: { api?: CtApi; source?: Record<string, string | undefined>; log?: Log } = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  const positional = argv.filter((arg, i) => !arg.startsWith('--') && argv[i - 1] !== '--confirm-project');
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const [listKey, indexText, centsText] = positional;
    const index = Number(indexText);
    const cents = Number(centsText);
    if (!listKey || !Number.isInteger(index) || index < 0 || !Number.isInteger(cents) || cents < 0) throw new Error('Usage: <listKey> <lineIndex> <savedAmountCents>');
    log(`updated line ${await setListLinePrice(api, listKey, index, cents)} of ${listKey}`);
    return EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

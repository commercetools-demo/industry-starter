// npm run seed:customer-fields -- --confirm-project spec-test-b2c-telecom
// Workstream R: makes sure the custom type `malva-customer` has the field `sessionsValidAfter` (DateTime) that the password reset
// uses to invalidate earlier sessions. Idempotent: creates the type when it is missing, adds only the missing field, nothing is sent
// when it is there (D-054: allow-listed project, `malva-` key only). The same field is part of G's manifest, so `npm run seed` agrees.
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { customerType } from './data/custom-types/customer';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { typeReconciler } from './reconcilers/type';

export type CustomerFieldsResult = 'created' | 'updated' | 'unchanged';

export async function ensureCustomerFields(api: CtApi): Promise<CustomerFieldsResult> {
  const existing = await typeReconciler.fetch(api, customerType.key);
  if (!existing) {
    await typeReconciler.create(api, customerType, { zoneKeys: {} });
    return 'created';
  }
  const { changes, conflict } = typeReconciler.diff(existing, customerType, { zoneKeys: {} });
  if (conflict) throw new Error(`Custom type ${customerType.key}: ${conflict}`);
  if (changes.length === 0) return 'unchanged';
  await typeReconciler.update(api, existing, changes, customerType, { zoneKeys: {} });
  return 'updated';
}

export interface CustomerFieldsDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  log?: Log;
}

export async function main(argv: string[], deps: CustomerFieldsDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    log(`${(await ensureCustomerFields(api)).padEnd(9)} ${customerType.key}`);
    return EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

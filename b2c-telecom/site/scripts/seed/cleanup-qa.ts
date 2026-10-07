// npx tsx scripts/seed/cleanup-qa.ts --confirm-project spec-test-b2c-telecom [--dry-run]
// Removes what create-qa-order.ts (and the Chrome checks) made: customers whose email matches ^(qa|chrome)-.*@example\.com$ with their
// recurring orders, orders and carts, and the temporary product `malva-qa-discontinued-addon`. It never touches anything else and refuses
// to run against a project that is not allow-listed (D-054).
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { QA_DISCONTINUED_KEY, QA_EMAIL_PATTERN, QA_KEY_PREFIX } from './create-qa-order';
import { CtHttpError, getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { getAll } from './reconcilers/util';

type Res = { id: string; version: number; email?: string; recurringOrderState?: string };

const sanitize = (id: string): string => id.replace(/["\\]/g, '');

export const isQaEmail = (email: string | undefined): boolean => typeof email === 'string' && QA_EMAIL_PATTERN.test(email);
export const isQaKey = (key: string): boolean => key.startsWith(QA_KEY_PREFIX);

async function remove(api: CtApi, collection: string, item: Res, log: Log, dryRun: boolean, preActions: unknown[] = []): Promise<number> {
  if (dryRun) {
    log(`would remove ${collection} ${item.id}`);
    return 0;
  }
  try {
    let version = item.version;
    if (preActions.length > 0) version = ((await api.post(`${collection}/${item.id}`, { version, actions: preActions })) as { version: number }).version;
    await api.del(`${collection}/${item.id}`, { version });
    log(`removed    ${collection} ${item.id}`);
    return 0;
  } catch (error) {
    if (error instanceof CtHttpError && error.statusCode === 404) return 0;
    log(`failed     ${collection} ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

export interface CleanupDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  log?: Log;
}

export async function cleanupQa(api: CtApi, log: Log, dryRun = false): Promise<number> {
  let failed = 0;
  const customers = ((await getAll(api, 'customers')) as unknown as Res[]).filter((customer) => isQaEmail(customer.email));
  for (const customer of customers) {
    const id = sanitize(customer.id);
    const recurring = (await getAll(api, 'recurring-orders', { where: `customer(id="${id}")` })) as unknown as Res[];
    for (const item of recurring) {
      const cancel = ['Canceled', 'Expired'].includes(String(item.recurringOrderState)) ? [] : [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason: 'QA cleanup' } }];
      failed += await remove(api, 'recurring-orders', item, log, dryRun, cancel);
    }
    for (const collection of ['orders', 'carts'] as const) {
      for (const item of (await getAll(api, collection, { where: `customerId="${id}"` })) as unknown as Res[]) failed += await remove(api, collection, item, log, dryRun);
    }
    failed += await remove(api, 'customers', customer, log, dryRun);
  }
  log(`${customers.length} QA customer(s) found.`);

  const product = (await api.get(`products/key=${QA_DISCONTINUED_KEY}`)) as (Res & { key: string; masterData: { published: boolean } }) | null;
  if (product && isQaKey(QA_DISCONTINUED_KEY)) {
    const unpublish = product.masterData.published ? [{ action: 'unpublish' }] : [];
    failed += await remove(api, 'products', product, log, dryRun, unpublish);
  }
  return failed;
}

export async function main(argv: string[], deps: CleanupDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const failed = await cleanupQa(api, log, args.flags.has('dry-run'));
    return failed > 0 ? EXIT.FAILED : EXIT.OK;
  } catch (error) {
    return exitCodeForError(error, log);
  }
}

if (process.argv[1]?.endsWith('cleanup-qa.ts')) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

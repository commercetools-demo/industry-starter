// npm run probe:payment-default -- --confirm-project spec-test-b2c-telecom
// Workstream T: does the platform clear the previous default Payment Method when another one gets `setDefault true`? The storefront
// clears explicitly either way (lib/ct/payment-methods.ts), so the answer cannot break the feature; it only documents the platform.
// A platform that refuses the second default (400) also counts as "does not clear". Creates a throwaway customer and two Payment Methods, tests, prints PLATFORM_CLEARS_PREVIOUS_DEFAULT=true|false, deletes everything.
import { randomUUID } from 'node:crypto';
import { consoleLog, exitCodeForError, parseArgs, type Log } from '../seed/cli';
import { EXIT } from '../seed/config';
import { CtHttpError, getAdminApi, loadSeedEnv, type CtApi } from '../seed/lib';

interface Versioned {
  id: string;
  version: number;
  default?: boolean;
}

export async function probe(api: CtApi): Promise<boolean> {
  const stamp = Date.now();
  const created = (await api.post('customers', { email: `probe-pm-${stamp}@example.com`, password: `Pw-${randomUUID()}-aA1`, key: `malva-probe-pm-${stamp}` })) as { customer: Versioned };
  const customerId = created.customer.id;
  const ids: string[] = [];
  try {
    for (const suffix of ['a', 'b']) {
      const pm = (await api.post('payment-methods', {
        key: `malva-probe-pm-${suffix}-${stamp}`,
        customer: { typeId: 'customer', id: customerId },
        method: 'card',
        paymentInterface: 'malva-demo',
        paymentMethodStatus: 'Active',
        default: false,
      })) as Versioned;
      ids.push(pm.id);
    }
    const setTrue = async (id: string): Promise<void> => {
      const current = (await api.get(`payment-methods/${id}`)) as Versioned;
      await api.post(`payment-methods/${id}`, { version: current.version, actions: [{ action: 'setDefault', default: true }] });
    };
    await setTrue(ids[0] as string);
    try {
      await setTrue(ids[1] as string); // deliberately without clearing the first
    } catch (error) {
      // Live finding (2026-10-07): the platform REFUSES a second default (400 InvalidOperation "Customer can only have one default PaymentMethod").
      if (error instanceof CtHttpError && error.statusCode === 400) return false;
      throw error;
    }
    const first = (await api.get(`payment-methods/${ids[0]}`)) as Versioned;
    return first.default === false;
  } finally {
    for (const id of ids) {
      const current = (await api.get(`payment-methods/${id}`)) as Versioned | null;
      if (current) await api.del(`payment-methods/${id}`, { version: current.version });
    }
    const customer = (await api.get(`customers/${customerId}`)) as Versioned | null;
    if (customer) await api.del(`customers/${customerId}`, { version: customer.version });
  }
}

export async function main(argv: string[], deps: { api?: CtApi; source?: Record<string, string | undefined>; log?: Log } = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    log(`PLATFORM_CLEARS_PREVIOUS_DEFAULT=${String(await probe(api))}`);
    return EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

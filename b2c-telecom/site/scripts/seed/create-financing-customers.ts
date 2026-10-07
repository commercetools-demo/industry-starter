// npx tsx scripts/seed/create-financing-customers.ts --confirm-project spec-test-b2c-telecom
// Workstream Q: two throwaway customers for the Chrome checks of the financing decision, one the stub approves and one it declines
// (`creditApproved = false`). Emails carry a random hex so every run adds new ones; the passwords are generated and printed to the console
// ONLY. Both carry the demo marker, so `npm run seed:reset -- --demo` removes them. Nothing is deleted here (D-054).
import { randomBytes } from 'node:crypto';
import { checkPassword } from '../../lib/config/password';
import { DEMO_MARKER_VALUE } from '../../lib/config/demo';
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { ensureCustomerFields } from './customer-fields';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';

export interface FinancingCustomerDraft {
  key: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isEmailVerified: true;
  custom: { type: { typeId: 'type'; key: 'malva-customer' }; fields: { creditApproved: boolean; demoMarker: string } };
}

/** A password that satisfies the shop's policy (10 to 128 characters, lower, upper, digit) and never contains the email's local part. */
export function generatePassword(random: (size: number) => Buffer = randomBytes): string {
  return `Qa${random(8).toString('hex')}X9`;
}

export function buildFinancingCustomers(hex: string, passwords: { ok: string; declined: string }): FinancingCustomerDraft[] {
  const make = (kind: 'ok' | 'declined', creditApproved: boolean): FinancingCustomerDraft => ({
    key: `qa-fin-${kind}-${hex}`,
    email: `qa-fin-${kind}-${hex}@example.com`,
    password: passwords[kind],
    firstName: 'Fin',
    lastName: kind === 'ok' ? 'Approved' : 'Declined',
    isEmailVerified: true,
    custom: { type: { typeId: 'type', key: 'malva-customer' }, fields: { creditApproved, demoMarker: DEMO_MARKER_VALUE } },
  });
  return [make('ok', true), make('declined', false)];
}

export interface CreatedCustomer {
  email: string;
  password: string;
  creditApproved: boolean;
}

export async function createFinancingCustomers(api: CtApi, random: (size: number) => Buffer = randomBytes): Promise<CreatedCustomer[]> {
  await ensureCustomerFields(api); // the customer type (with `creditApproved`) must exist; nothing is sent when it does
  const hex = random(4).toString('hex');
  const drafts = buildFinancingCustomers(hex, { ok: generatePassword(random), declined: generatePassword(random) });
  const created: CreatedCustomer[] = [];
  for (const draft of drafts) {
    const policy = checkPassword(draft.password, { email: draft.email });
    if (!policy.ok) throw new Error(`Generated password breaks the policy: ${policy.failed.join(', ')}`);
    await api.post('customers', draft);
    created.push({ email: draft.email, password: draft.password, creditApproved: draft.custom.fields.creditApproved });
  }
  return created;
}

export interface FinancingCustomersDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  log?: Log;
  random?: (size: number) => Buffer;
}

export async function main(argv: string[], deps: FinancingCustomersDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    for (const customer of await createFinancingCustomers(api, deps.random)) {
      log(`${customer.creditApproved ? 'approved' : 'declined'}  ${customer.email}  ${customer.password}`);
    }
    log('Passwords are shown once. Remove the customers with: npm run seed:reset -- --demo --confirm-project spec-test-b2c-telecom');
    return EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

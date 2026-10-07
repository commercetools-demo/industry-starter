// npm run seed:payment-methods -- --confirm-project spec-test-b2c-telecom --email <customer email>
// Workstream T (D-032): the account page only LISTS stored payment methods, so demos and Chrome checks need records. This makes sure the
// custom type `malva-payment-method` exists, then gives the customer two demo cards (Visa 4242, default; Mastercard 5454). The token
// values are fake strings, never a real card. Idempotent: a second run changes nothing; a removed (Inactive) card is brought back.
// D-054: allow-listed project only, keys start with `malva-`.
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { paymentMethodType } from './data/custom-types/payment-method';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { typeReconciler } from './reconcilers/type';

export interface DemoCard {
  slug: string;
  brand: 'visa' | 'mastercard';
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  token: string;
  name: { 'en-US': string; 'de-DE': string };
}

export const DEMO_CARDS: readonly DemoCard[] = [
  { slug: 'visa-4242', brand: 'visa', last4: '4242', expMonth: 3, expYear: 2030, isDefault: true, token: 'tok_demo_visa_4242', name: { 'en-US': 'Visa ending 4242', 'de-DE': 'Visa endet auf 4242' } },
  { slug: 'mc-5454', brand: 'mastercard', last4: '5454', expMonth: 11, expYear: 2029, isDefault: false, token: 'tok_demo_mc_5454', name: { 'en-US': 'Mastercard ending 5454', 'de-DE': 'Mastercard endet auf 5454' } },
];

interface CustomerRow {
  id: string;
}
interface MethodRow {
  id: string;
  version: number;
  paymentMethodStatus: string;
  default: boolean;
}

/** Keys are project-wide, so they carry the first eight characters of the customer id: two customers never collide. */
export const methodKey = (card: DemoCard, customerId: string): string => `malva-pm-${card.slug}-${customerId.slice(0, 8)}`;

export function methodDraft(card: DemoCard, customerId: string): Record<string, unknown> {
  return {
    key: methodKey(card, customerId),
    name: card.name,
    customer: { typeId: 'customer', id: customerId },
    method: 'card',
    paymentInterface: 'malva-demo',
    token: { value: card.token },
    paymentMethodStatus: 'Active',
    default: card.isDefault,
    custom: { type: { typeId: 'type', key: paymentMethodType.key }, fields: { brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear } },
  };
}

export async function ensurePaymentMethodType(api: CtApi): Promise<'created' | 'updated' | 'unchanged'> {
  const existing = await typeReconciler.fetch(api, paymentMethodType.key);
  if (!existing) {
    await typeReconciler.create(api, paymentMethodType, { zoneKeys: {} });
    return 'created';
  }
  const { changes, conflict } = typeReconciler.diff(existing, paymentMethodType, { zoneKeys: {} });
  if (conflict) throw new Error(`Custom type ${paymentMethodType.key}: ${conflict}`);
  if (changes.length === 0) return 'unchanged';
  await typeReconciler.update(api, existing, changes, paymentMethodType, { zoneKeys: {} });
  return 'updated';
}

export async function findCustomer(api: CtApi, email: string): Promise<CustomerRow | null> {
  const found = (await api.get('customers', { where: `email="${email.replace(/["\\]/g, '')}"`, limit: 1 })) as { results?: CustomerRow[] } | null;
  return found?.results?.[0] ?? null;
}

export type CardResult = 'created' | 'restored' | 'unchanged';

export async function ensureCard(api: CtApi, card: DemoCard, customerId: string): Promise<CardResult> {
  const key = methodKey(card, customerId);
  const existing = (await api.get(`payment-methods/key=${key}`)) as MethodRow | null;
  if (!existing) {
    await api.post('payment-methods', methodDraft(card, customerId));
    return 'created';
  }
  const actions: Array<Record<string, unknown>> = [];
  if (existing.paymentMethodStatus !== 'Active') actions.push({ action: 'setPaymentMethodStatus', paymentMethodStatus: 'Active' });
  if (existing.default !== card.isDefault) actions.push({ action: 'setDefault', default: card.isDefault });
  if (actions.length === 0) return 'unchanged';
  await api.post(`payment-methods/key=${key}`, { version: existing.version, actions });
  return 'restored';
}

export interface PaymentMethodsDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  log?: Log;
}

export async function main(argv: string[], deps: PaymentMethodsDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project', 'email']);
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const email = (args.values.get('email') ?? '').trim().toLowerCase();
    if (!email) throw new Error('Pass --email <the email of an existing customer>.');
    const customer = await findCustomer(api, email);
    if (!customer) throw new Error(`No customer with that email exists in the project: register one first (the account must exist before cards can be seeded).`);
    log(`${(await ensurePaymentMethodType(api)).padEnd(9)} ${paymentMethodType.key}`);
    for (const card of DEMO_CARDS) log(`${(await ensureCard(api, card, customer.id)).padEnd(9)} ${methodKey(card, customer.id)}`);
    return EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

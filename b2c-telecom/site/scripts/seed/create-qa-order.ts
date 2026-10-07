// npx tsx scripts/seed/create-qa-order.ts --confirm-project spec-test-b2c-telecom [--scenario design-demo|devices|empty|cancelled|many]
//                                         [--orders N] [--discontinued] [--customer qa-xxxx@example.com]
// Creates a throwaway QA customer with realistic orders so the account pages (dashboard, order list, order detail, "Buy again") can be
// checked before checkout exists (workstream S). Only the allow-listed project is touched (D-054). Prints non-secret ids, the QA email
// and a generated password (printed once, never stored). `cleanup-qa.ts` removes everything this script makes.
import { randomBytes } from 'node:crypto';
import { consoleLog, exitCodeForError, parseArgs as parseFlags, type Log } from './cli';
import { EXIT } from './config';
import { qaLabelSnapshot, qaScheduleFor, qaSchedules, type QaLabelInput } from './data/qa-labels';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';
import type { Obj } from './reconcilers/util';

export const QA_SCENARIOS = ['design-demo', 'devices', 'empty', 'cancelled', 'many'] as const;
export type QaScenario = (typeof QA_SCENARIOS)[number];

export const QA_EMAIL_PATTERN = /^(qa|chrome)-.*@example\.com$/;
export const QA_KEY_PREFIX = 'malva-qa-';
export const QA_DISCONTINUED_KEY = 'malva-qa-discontinued-addon';
export const QA_DISCONTINUED_SKU = 'MLV-QA-DISCONTINUED';
export const MAX_QA_ORDERS = 25;
export const DEFAULT_MANY_ORDERS = 12;

export interface QaOptions {
  scenario: QaScenario;
  orders: number;
  discontinued: boolean;
  customer?: string;
}

export const generatePassword = (random: (size: number) => Buffer = randomBytes): string => `Qa-${random(9).toString('base64url')}9aA`;
export const qaEmail = (random: string = randomBytes(5).toString('hex')): string => `qa-${random}@example.com`;
export const qaOrderNumber = (random: string = randomBytes(3).toString('hex')): string => `QA-${random.toUpperCase()}`;

export class QaUsageError extends Error {}

/** `--scenario`, `--orders` (1..25, default 12 for `many`), `--discontinued`, `--customer`. Throws `QaUsageError` on anything else. */
export function parseQaArgs(argv: string[]): QaOptions {
  const args = parseFlags(argv, ['scenario', 'orders', 'customer', 'confirm-project']);
  const scenario = (args.values.get('scenario') ?? 'design-demo') as QaScenario;
  if (!(QA_SCENARIOS as readonly string[]).includes(scenario)) throw new QaUsageError(`Unknown scenario "${scenario}" (use ${QA_SCENARIOS.join(', ')}).`);
  const rawOrders = args.values.get('orders');
  let orders = DEFAULT_MANY_ORDERS;
  if (rawOrders !== undefined) {
    orders = Number(rawOrders);
    if (!Number.isInteger(orders) || orders < 1 || orders > MAX_QA_ORDERS) throw new QaUsageError(`--orders must be a whole number from 1 to ${MAX_QA_ORDERS}.`);
  }
  const customer = args.values.get('customer');
  if (customer !== undefined && !QA_EMAIL_PATTERN.test(customer)) throw new QaUsageError('--customer must be a qa-…@example.com or chrome-…@example.com address.');
  return { scenario, orders, discontinued: args.flags.has('discontinued'), ...(customer ? { customer } : {}) };
}

// ---------------------------------------------------------------------------------------------------------------------------
// What each scenario orders (pure)

export interface QaLineSpec {
  offerKey: string;
  /** Variant attributes to pick by (never a hard-coded SKU): `contract-term`, or `color` and `memory-gb` for handsets. */
  wanted: Record<string, string>;
  mode: 'Fixed' | 'Dynamic';
  policy?: string;
  /** Index of the line this one belongs to (add-ons). */
  parent?: number;
  fields?: Record<string, unknown>;
  /** A QA product addressed by SKU (the temporary discontinued add-on). */
  sku?: string;
}

export interface QaOrderSpec {
  lines: QaLineSpec[];
  /** YYYY-MM-DD: the service start stored on the order. */
  serviceStartDate: string;
  /** YYYY-MM-DD: the date the stored price schedule counts from. */
  orderDate: string;
  state?: 'Cancelled';
}

const MONTHLY = 'malva-monthly';
const plan = (offerKey: string, term: '24-months' | 'month-to-month'): QaLineSpec => ({ offerKey, wanted: { 'contract-term': term }, mode: term === 'month-to-month' ? 'Dynamic' : 'Fixed', policy: MONTHLY });
const addon = (offerKey: string, parent: number): QaLineSpec => ({ offerKey, wanted: { 'contract-term': 'month-to-month' }, mode: 'Dynamic', policy: MONTHLY, parent });

export function designOrders(): [QaOrderSpec, QaOrderSpec] {
  return [
    { lines: [plan('malva-offer-cable-500', '24-months'), addon('malva-offer-appletv', 0)], serviceStartDate: '2026-03-12', orderDate: '2026-03-07' },
    { lines: [plan('malva-offer-phone-unlimited', 'month-to-month'), addon('malva-offer-spotify', 0)], serviceStartDate: '2025-06-03', orderDate: '2025-06-03' },
  ];
}

export function deviceOrder(today: string): QaOrderSpec {
  return {
    lines: [
      plan('malva-offer-phone-unlimited', 'month-to-month'),
      {
        offerKey: 'malva-offer-phone-nova-pro',
        wanted: { color: 'black', 'memory-gb': '256' },
        mode: 'Fixed',
        policy: 'malva-device-installment-24',
        parent: 0,
        fields: { acquisitionMode: 'installments', acquisitionTermMonths: 24 },
      },
    ],
    serviceStartDate: today,
    orderDate: today,
  };
}

export function discontinuedOrder(today: string): QaOrderSpec {
  return {
    lines: [plan('malva-offer-phone-unlimited', 'month-to-month'), { offerKey: QA_DISCONTINUED_KEY, wanted: {}, mode: 'Dynamic', policy: MONTHLY, parent: 0, sku: QA_DISCONTINUED_SKU }],
    serviceStartDate: today,
    orderDate: today,
  };
}

/** The orders of a scenario in creation order (the newest is created last). `empty` has none. */
export function scenarioOrders(options: QaOptions, today: string): QaOrderSpec[] {
  const extra = options.discontinued ? [discontinuedOrder(today)] : [];
  switch (options.scenario) {
    case 'empty':
      return extra;
    case 'devices':
      return [deviceOrder(today), ...extra];
    case 'cancelled': {
      const [a, b] = designOrders();
      return [a, { ...b, state: 'Cancelled' as const }, ...extra];
    }
    case 'many':
      return [
        ...Array.from({ length: options.orders }, () => ({ lines: [plan('malva-offer-phone-essential', 'month-to-month')], serviceStartDate: today, orderDate: today })),
        ...extra,
      ];
    default:
      return [...designOrders(), ...extra];
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Drafts (pure)

export const qaAddress = (email: string): Obj => ({ firstName: 'Alex', lastName: 'Rivera', streetNumber: '1', streetName: 'Main St', postalCode: '10001', city: 'New York', state: 'NY', country: 'US', email });

export function qaCustomerDraft(email: string, password: string): Obj {
  return {
    email,
    password,
    firstName: 'Alex',
    lastName: 'Rivera',
    isEmailVerified: true,
    addresses: [qaAddress(email)],
    defaultShippingAddress: 0,
    defaultBillingAddress: 0,
    shippingAddresses: [0],
    billingAddresses: [0],
  };
}

export interface ResolvedLine {
  spec: QaLineSpec;
  sku: string;
  name: string;
  /** Recurring monthly price (USD cents) of the picked variant. */
  monthlyCents: number;
  termMonths: number;
  /** Month-to-month price of the same offer, for the after-term price of a schedule. */
  afterTermCents?: number;
}

const recurrenceInfo = (policy: string, mode: string): Obj => ({ recurrencePolicy: { typeId: 'recurrence-policy', key: policy }, priceSelectionMode: mode });
const lineFields = (spec: QaLineSpec, parentLineItemId?: string): Obj => ({ offerKey: spec.offerKey, ...(parentLineItemId ? { parentLineItemId } : {}), ...(spec.fields ?? {}) });
const lineType = { typeId: 'type', key: 'malva-line-item' };

export function qaCartDraft(customerId: string, email: string, lines: ResolvedLine[], fields: Obj): Obj {
  const address = qaAddress(email);
  return {
    currency: 'USD',
    country: 'US',
    customerId,
    customerEmail: email,
    inventoryMode: 'None',
    shippingAddress: address,
    billingAddress: address,
    lineItems: lines
      .filter((line) => line.spec.parent === undefined)
      .map((line) => ({ sku: line.sku, quantity: 1, recurrenceInfo: recurrenceInfo(line.spec.policy ?? MONTHLY, line.spec.mode), custom: { type: lineType, fields: lineFields(line.spec) } })),
    // a cart is typed malva-order from the start: OrderFromCartDraft.custom cannot change the type (G-18)
    custom: { type: { typeId: 'type', key: 'malva-order' }, fields },
  };
}

export function qaAddLineAction(line: ResolvedLine, parentLineItemId: string): Obj {
  return { action: 'addLineItem', sku: line.sku, quantity: 1, recurrenceInfo: recurrenceInfo(line.spec.policy ?? MONTHLY, line.spec.mode), custom: { type: lineType, fields: lineFields(line.spec, parentLineItemId) } };
}

/** `serviceStartDate`, `priceSchedule` (a schedule per plan line) and `labelSnapshot` (a label per plan line): what checkout will store. */
export function qaOrderFields(spec: QaOrderSpec, lines: ResolvedLine[], takenAt: string): Obj {
  const plans = lines.filter((line) => /^malva-offer-(cable|wireless|phone-(essential|plus|unlimited))/.test(line.spec.offerKey));
  const labelInputs: (QaLabelInput & { takenAt: string })[] = plans.map((line) => ({ offerKey: line.spec.offerKey, sku: line.sku, monthlyCents: line.monthlyCents, termMonths: line.termMonths, takenAt }));
  return {
    serviceStartDate: spec.serviceStartDate,
    priceSchedule: qaSchedules(plans.map((line) => qaScheduleFor({ offerKey: line.spec.offerKey, sku: line.sku, termMonths: line.termMonths, monthlyCents: line.monthlyCents, ...(line.afterTermCents !== undefined ? { afterTermCents: line.afterTermCents } : {}) }, spec.orderDate))),
    labelSnapshot: plans.length > 0 ? qaLabelSnapshot(labelInputs) : '',
  };
}

export const qaOrderDraft = (cart: { id: string; version: number }, orderNumber: string): Obj => ({ cart: { typeId: 'cart', id: cart.id }, version: cart.version, orderNumber, paymentState: 'Paid' });

export const cancelActions = (): Obj[] => [{ action: 'changeOrderState', orderState: 'Cancelled' }];

/** The temporary, published add-on that "Buy again" cannot reuse once it is unpublished. Only `malva-qa-` keys. */
export function qaDiscontinuedProductDraft(): Obj {
  const name = { 'en-US': 'QA discontinued add-on', 'de-DE': 'QA eingestellte Zusatzoption' };
  const slug = { 'en-US': 'qa-discontinued-addon', 'de-DE': 'qa-eingestellte-zusatzoption' };
  return {
    key: QA_DISCONTINUED_KEY,
    productType: { typeId: 'product-type', key: 'malva-addon' },
    name,
    slug,
    taxCategory: { typeId: 'tax-category', key: 'malva-telecom-services' },
    masterVariant: {
      key: 'malva-qa-discontinued-addon',
      sku: QA_DISCONTINUED_SKU,
      attributes: [
        { name: 'addon-kind', value: 'protection' },
        { name: 'addon-tag', value: 'extras' },
        { name: 'provider', value: 'QA' },
        { name: 'charge-type', value: 'monthly' },
      ],
      prices: [{ value: { currencyCode: 'USD', centAmount: 499 }, country: 'US', recurrencePolicy: { typeId: 'recurrence-policy', key: MONTHLY } }],
    },
    publish: true,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Live part

type Projection = { name?: Record<string, string>; masterVariant: Variant; variants?: Variant[] };
type Variant = { sku: string; attributes?: { name: string; value: unknown }[]; prices?: { value: { centAmount: number; currencyCode: string }; country?: string; recurrencePolicy?: unknown }[] };

const attributeKey = (value: unknown): unknown => (typeof value === 'object' && value !== null && 'key' in value ? (value as { key: unknown }).key : value);

/** The variant whose attributes equal `wanted` (enum values by key); throws when there is none: QA data must be what the plan says. */
export function pickVariant(projection: Projection, wanted: Record<string, string>, sku?: string): Variant {
  const all = [projection.masterVariant, ...(projection.variants ?? [])];
  const found = sku
    ? all.find((variant) => variant.sku === sku)
    : all.find((variant) => Object.entries(wanted).every(([name, value]) => String(attributeKey(variant.attributes?.find((a) => a.name === name)?.value)) === value));
  if (!found) throw new Error(`No variant of the offer matches ${sku ?? JSON.stringify(wanted)}.`);
  return found;
}

const refId = (value: unknown): string | undefined => (typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string' ? (value as { id: string }).id : undefined);

async function policyIdOf(api: CtApi, key: string): Promise<string> {
  const policy = (await api.get(`recurrence-policies/key=${key}`)) as { id: string } | null;
  if (!policy) throw new Error(`The recurrence policy "${key}" does not exist in the project (run npm run seed first).`);
  return policy.id;
}

const TERM_MONTHS: Record<string, number> = { 'month-to-month': 0, '12-months': 12, '24-months': 24 };

export async function resolveLine(api: CtApi, spec: QaLineSpec): Promise<ResolvedLine> {
  const projection = (await api.get(`product-projections/key=${spec.offerKey}`, { priceCurrency: 'USD', priceCountry: 'US', staged: spec.sku ? 'true' : 'false' })) as Projection | null;
  if (!projection) throw new Error(`The offer "${spec.offerKey}" does not exist in the project (run npm run seed first).`);
  const variant = pickVariant(projection, spec.wanted, spec.sku);
  const policyId = await policyIdOf(api, spec.policy ?? MONTHLY);
  const recurring = (variant.prices ?? []).find((price) => price.value.currencyCode === 'USD' && price.country === 'US' && refId(price.recurrencePolicy) === policyId);
  if (!recurring) throw new Error(`The variant ${variant.sku} has no recurring USD price (policy ${spec.policy ?? MONTHLY} missing or not priced).`);
  const months = TERM_MONTHS[spec.wanted['contract-term'] ?? 'month-to-month'] ?? 0;
  const m2m = [projection.masterVariant, ...(projection.variants ?? [])].find((candidate) => attributeKey(candidate.attributes?.find((a) => a.name === 'contract-term')?.value) === 'month-to-month');
  const monthlyId = await policyIdOf(api, MONTHLY);
  const afterTerm = m2m?.prices?.find((price) => price.value.currencyCode === 'USD' && price.country === 'US' && refId(price.recurrencePolicy) === monthlyId)?.value.centAmount;
  return {
    spec,
    sku: variant.sku,
    name: projection.name?.['en-US'] ?? spec.offerKey,
    monthlyCents: recurring.value.centAmount,
    termMonths: spec.fields?.acquisitionTermMonths ? Number(spec.fields.acquisitionTermMonths) : months,
    ...(months > 0 && afterTerm !== undefined ? { afterTermCents: afterTerm } : {}),
  };
}

type Versioned = { id: string; version: number };
type CreatedOrder = { orderNumber: string; lines: string[]; state: string };

export interface QaDeps {
  api: CtApi;
  log: Log;
  now?: () => Date;
  password?: string;
  random?: () => string;
}

async function ensureDiscontinuedProduct(api: CtApi): Promise<void> {
  const existing = (await api.get(`products/key=${QA_DISCONTINUED_KEY}`)) as (Versioned & { masterData: { published: boolean } }) | null;
  if (!existing) {
    await api.post('products', qaDiscontinuedProductDraft());
    return;
  }
  if (!existing.masterData.published) await api.post(`products/${existing.id}`, { version: existing.version, actions: [{ action: 'publish' }] });
}

async function unpublishDiscontinuedProduct(api: CtApi): Promise<void> {
  const existing = (await api.get(`products/key=${QA_DISCONTINUED_KEY}`)) as (Versioned & { masterData: { published: boolean } }) | null;
  if (existing?.masterData.published) await api.post(`products/${existing.id}`, { version: existing.version, actions: [{ action: 'unpublish' }] });
}

async function createOrder(api: CtApi, customer: { id: string; email: string }, spec: QaOrderSpec, takenAt: string, orderNumber: string): Promise<CreatedOrder> {
  const lines = await Promise.all(spec.lines.map((line) => resolveLine(api, line)));
  let cart = (await api.post('carts', qaCartDraft(customer.id, customer.email, lines, qaOrderFields(spec, lines, takenAt)))) as Versioned & { lineItems: { id: string; variant: { sku: string } }[] };
  for (const line of lines) {
    if (line.spec.parent === undefined) continue;
    const parentSku = lines[line.spec.parent]?.sku;
    const parent = cart.lineItems.find((item) => item.variant.sku === parentSku);
    if (!parent) throw new Error(`The parent line ${parentSku ?? '?'} of ${line.sku} is not in the cart.`);
    cart = (await api.post(`carts/${cart.id}`, { version: cart.version, actions: [qaAddLineAction(line, parent.id)] })) as typeof cart;
  }
  let order: Versioned;
  try {
    order = (await api.post('orders', qaOrderDraft(cart, orderNumber))) as Versioned;
  } catch (error) {
    await api.del(`carts/${cart.id}`, { version: cart.version }).catch(() => undefined);
    throw error;
  }
  if (spec.state === 'Cancelled') await api.post(`orders/${order.id}`, { version: order.version, actions: cancelActions() });
  return { orderNumber, lines: lines.map((line) => line.sku), state: spec.state ?? 'Open' };
}

export interface QaSummary {
  email: string;
  password: string | null;
  customerId: string;
  orders: CreatedOrder[];
}

/** Creates (or reuses with `--customer`) the QA customer and the scenario's orders. Never prints the password except in the one result line of `main`. */
export async function createQaOrders(options: QaOptions, deps: QaDeps): Promise<QaSummary> {
  const { api, log } = deps;
  const now = deps.now?.() ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const email = options.customer ?? qaEmail(deps.random?.());
  let customer = options.customer ? ((await api.get('customers', { where: `email="${email}"`, limit: 1 })) as { results: (Versioned & { email: string })[] } | null)?.results[0] : undefined;
  let password: string | null = null;
  if (!customer) {
    password = deps.password ?? generatePassword();
    const created = (await api.post('customers', qaCustomerDraft(email, password))) as { customer: Versioned & { email: string } };
    customer = created.customer;
  }
  log(`customer ${customer.id}`);

  const specs = scenarioOrders(options, today);
  if (options.discontinued) await ensureDiscontinuedProduct(api);
  const orders: CreatedOrder[] = [];
  try {
    for (const spec of specs) {
      const created = await createOrder(api, { id: customer.id, email }, spec, now.toISOString(), qaOrderNumber(deps.random?.()));
      orders.push(created);
      log(`order ${created.orderNumber} (${created.state}) ${created.lines.join(', ')}`);
    }
  } finally {
    // the extra order is placed while the add-on is published; afterwards it is unpublished so "Buy again" has a real unavailable item
    if (options.discontinued) await unpublishDiscontinuedProduct(api);
  }
  return { email, password, customerId: customer.id, orders };
}

export async function main(argv: string[], deps: Partial<QaDeps> & { source?: Record<string, string | undefined> } = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  try {
    const options = parseQaArgs(argv);
    const confirm = parseFlags(argv, ['confirm-project']).values.get('confirm-project');
    const { api } = await getAdminApi({ mode: 'write', confirmProject: confirm, source: deps.source ?? loadSeedEnv(), api: deps.api });
    const summary = await createQaOrders(options, { api, log, ...(deps.now ? { now: deps.now } : {}), ...(deps.password ? { password: deps.password } : {}) });
    log(`QA customer: ${summary.email}`);
    // the only line that ever carries the password; it is not stored anywhere
    log(summary.password ? `Password (shown once): ${summary.password}` : 'Password: unchanged (existing customer)');
    log(`Orders: ${summary.orders.map((order) => order.orderNumber).join(', ') || 'none'}`);
    return EXIT.OK;
  } catch (error) {
    if (error instanceof QaUsageError) {
      log(error.message);
      return EXIT.PREFLIGHT;
    }
    return exitCodeForError(error, log);
  }
}

if (process.argv[1]?.endsWith('create-qa-order.ts')) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}


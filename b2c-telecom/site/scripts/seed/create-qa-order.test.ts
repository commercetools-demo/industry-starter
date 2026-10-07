// @vitest-environment node
import { checkPassword } from '@/lib/config/password';
import { parseSchedules } from '@/lib/pricing/schedule';
import { parseLabelSnapshot } from '@/lib/pricing/label';
import { EXIT } from './config';
import { cleanupQa, isQaEmail, isQaKey } from './cleanup-qa';
import {
  cancelActions,
  createQaOrders,
  designOrders,
  generatePassword,
  main,
  parseQaArgs,
  pickVariant,
  qaAddLineAction,
  qaCartDraft,
  qaCustomerDraft,
  qaDiscontinuedProductDraft,
  qaEmail,
  qaOrderDraft,
  qaOrderFields,
  qaOrderNumber,
  scenarioOrders,
  QA_DISCONTINUED_KEY,
  type QaOptions,
  type ResolvedLine,
} from './create-qa-order';
import type { CtApi, Query } from './lib';

type Call = { method: 'post' | 'del'; path: string; body: unknown };
type Obj = Record<string, unknown>;

const variant = (sku: string, term: string, cents: number, extra: Obj[] = []) => ({
  sku,
  attributes: [{ name: 'contract-term', value: { key: term, label: term } }, ...extra],
  prices: [{ value: { centAmount: cents, currencyCode: 'USD' }, country: 'US', recurrencePolicy: { typeId: 'recurrence-policy', id: 'pol-malva-monthly' } }],
});
const PROJECTIONS: Record<string, Obj> = {
  'malva-offer-cable-500': { name: { 'en-US': 'Cable 500' }, masterVariant: variant('MLV-CBL-500-24M', '24-months', 5999), variants: [variant('MLV-CBL-500-M2M', 'month-to-month', 6999)] },
  'malva-offer-appletv': { name: { 'en-US': 'Apple TV+' }, masterVariant: variant('MLV-ADD-APPLETV-MTH', 'month-to-month', 999) },
  'malva-offer-phone-unlimited': { name: { 'en-US': 'Unlimited' }, masterVariant: variant('MLV-PHN-UNL-M2M', 'month-to-month', 5000) },
  'malva-offer-spotify': { name: { 'en-US': 'Spotify' }, masterVariant: variant('MLV-ADD-SPOTIFY-MTH', 'month-to-month', 1000) },
  'malva-offer-phone-essential': { name: { 'en-US': 'Essential' }, masterVariant: variant('MLV-PHN-ESS-M2M', 'month-to-month', 2500) },
  'malva-offer-phone-nova-pro': {
    name: { 'en-US': 'Nova Pro' },
    masterVariant: {
      sku: 'MLV-DEV-NOVAPRO-BLK-256',
      attributes: [{ name: 'color', value: { key: 'black' } }, { name: 'memory-gb', value: { key: '256' } }],
      prices: [{ value: { centAmount: 4200, currencyCode: 'USD' }, country: 'US', recurrencePolicy: { typeId: 'recurrence-policy', id: 'pol-malva-device-installment-24' } }],
    },
  },
  [QA_DISCONTINUED_KEY]: {
    name: { 'en-US': 'QA discontinued add-on' },
    masterVariant: { sku: 'MLV-QA-DISCONTINUED', attributes: [], prices: [{ value: { centAmount: 499, currencyCode: 'USD' }, country: 'US', recurrencePolicy: { id: 'pol-malva-monthly' } }] },
  },
};

function fakeApi(world: { products?: Obj; customers?: Obj[] } = {}): CtApi & { calls: Call[] } {
  const calls: Call[] = [];
  let cartLines: Obj[] = [];
  let product: { published: boolean } | null = world.products ? { published: true } : null;
  let ids = 0;
  const api = {
    calls,
    writes: 0,
    async get(path: string, query?: Query) {
      if (path === '') return { key: 'spec-test-b2c-telecom' };
      if (path.startsWith('product-projections/key=')) return PROJECTIONS[path.split('=')[1] as string] ?? null;
      if (path.startsWith('recurrence-policies/key=')) return { id: `pol-${path.split('=')[1]}` };
      if (path.startsWith('products/key=')) return product ? { id: 'prod-1', version: 1, key: QA_DISCONTINUED_KEY, masterData: { published: product.published } } : null;
      if (path === 'customers') return { results: query?.where ? [] : (world.customers ?? []) };
      if (path === 'recurring-orders') return { results: [{ id: 'ro-1', version: 1, recurringOrderState: 'Active' }] };
      if (path === 'orders' || path === 'carts') return { results: [{ id: `${path}-1`, version: 1 }] };
      return null;
    },
    async post(path: string, body: Obj) {
      calls.push({ method: 'post', path, body });
      api.writes += 1;
      if (path === 'customers') return { customer: { id: 'cust-1', version: 1, email: body.email } };
      if (path === 'carts') {
        cartLines = (body.lineItems as Obj[]).map((line, index) => ({ id: `line-${index}`, variant: { sku: line.sku } }));
        return { id: `cart-${(ids += 1)}`, version: 1, lineItems: cartLines };
      }
      if (path.startsWith('carts/')) {
        const action = (body.actions as Obj[])[0] as Obj;
        cartLines = [...cartLines, { id: `line-${cartLines.length}`, variant: { sku: action.sku } }];
        return { id: path.split('/')[1], version: 2, lineItems: cartLines };
      }
      if (path === 'orders') return { id: `order-${ids}`, version: 1 };
      if (path === 'products') product = { published: true };
      if (path.startsWith('products/') && (body.actions as Obj[])[0]?.action === 'unpublish' && product) product.published = false;
      return { id: 'x', version: 2 };
    },
    async del(path: string, query: { version: number }) {
      calls.push({ method: 'del', path, body: query });
      return {};
    },
  };
  return api as unknown as CtApi & { calls: Call[] };
}

const options = (overrides: Partial<QaOptions> = {}): QaOptions => ({ scenario: 'design-demo', orders: 12, discontinued: false, ...overrides });
const logger = () => {
  const lines: string[] = [];
  return { lines, log: (line: string) => void lines.push(line) };
};

describe('parseQaArgs', () => {
  it('defaults to the design-demo scenario with 12 orders', () => {
    expect(parseQaArgs([])).toEqual({ scenario: 'design-demo', orders: 12, discontinued: false });
  });
  it('reads scenario, orders, discontinued and customer', () => {
    expect(parseQaArgs(['--scenario', 'many', '--orders', '25', '--discontinued', '--customer', 'qa-ab12@example.com'])).toEqual({ scenario: 'many', orders: 25, discontinued: true, customer: 'qa-ab12@example.com' });
  });
  it.each([['0'], ['26'], ['abc'], ['2.5']])('--orders %s is refused (1 to 25)', (value) => {
    expect(() => parseQaArgs(['--orders', value])).toThrow('--orders must be a whole number from 1 to 25');
  });
  it('refuses an unknown scenario and a customer that is not a QA address', () => {
    expect(() => parseQaArgs(['--scenario', 'huge'])).toThrow('Unknown scenario');
    expect(() => parseQaArgs(['--customer', 'alex.rivera@example.com'])).toThrow('qa-');
  });
});

describe('generated values', () => {
  it('the password satisfies the registration rules and is different every time', () => {
    const first = generatePassword();
    expect(checkPassword(first, { email: 'qa-ab12@example.com' }).ok).toBe(true);
    expect(first).toMatch(/^Qa-[A-Za-z0-9_-]{12}9aA$/);
    expect(generatePassword()).not.toBe(first);
  });
  it('the email and the order number follow the patterns the cleanup looks for', () => {
    expect(isQaEmail(qaEmail())).toBe(true);
    expect(qaOrderNumber('ab12cd')).toBe('QA-AB12CD');
  });
});

describe('scenarioOrders', () => {
  const today = '2026-10-07';
  it('design-demo is the cable + Apple TV+ order and the Unlimited + Spotify order with the design start dates', () => {
    const [a, b] = scenarioOrders(options(), today);
    expect(a?.lines.map((line) => line.offerKey)).toEqual(['malva-offer-cable-500', 'malva-offer-appletv']);
    expect(a?.serviceStartDate).toBe('2026-03-12');
    expect(b?.lines.map((line) => line.offerKey)).toEqual(['malva-offer-phone-unlimited', 'malva-offer-spotify']);
    expect(b?.serviceStartDate).toBe('2025-06-03');
    expect(a?.lines[0]?.wanted).toEqual({ 'contract-term': '24-months' });
    expect(a?.lines[0]?.mode).toBe('Fixed');
    expect(b?.lines[0]?.mode).toBe('Dynamic');
  });
  it('devices orders Nova Pro 256 GB black on 24 installments with the acquisition fields (found by attributes, not SKU)', () => {
    const [order] = scenarioOrders(options({ scenario: 'devices' }), today);
    const device = order?.lines[1];
    expect(device?.wanted).toEqual({ color: 'black', 'memory-gb': '256' });
    expect(device?.policy).toBe('malva-device-installment-24');
    expect(device?.fields).toEqual({ acquisitionMode: 'installments', acquisitionTermMonths: 24 });
    expect(device?.sku).toBeUndefined();
  });
  it('empty has no orders, cancelled cancels the second order, many makes N single-line orders', () => {
    expect(scenarioOrders(options({ scenario: 'empty' }), today)).toEqual([]);
    expect(scenarioOrders(options({ scenario: 'cancelled' }), today).map((order) => order.state)).toEqual([undefined, 'Cancelled']);
    const many = scenarioOrders(options({ scenario: 'many', orders: 14 }), today);
    expect(many).toHaveLength(14);
    expect(many.every((order) => order.lines.length === 1)).toBe(true);
  });
  it('--discontinued adds one extra order with the temporary add-on, in every scenario', () => {
    expect(scenarioOrders(options({ scenario: 'empty', discontinued: true }), today)).toHaveLength(1);
    const orders = scenarioOrders(options({ discontinued: true }), today);
    expect(orders).toHaveLength(3);
    expect(orders[2]?.lines[1]?.sku).toBe('MLV-QA-DISCONTINUED');
  });
});

describe('drafts', () => {
  const resolved = (): ResolvedLine[] => [
    { spec: designOrders()[0].lines[0]!, sku: 'MLV-CBL-500-24M', name: 'Cable 500', monthlyCents: 5999, termMonths: 24, afterTermCents: 6999 },
    { spec: designOrders()[0].lines[1]!, sku: 'MLV-ADD-APPLETV-MTH', name: 'Apple TV+', monthlyCents: 999, termMonths: 0 },
  ];

  it('the customer is Alex Rivera with the default address 1 Main St, New York 10001 US', () => {
    const draft = qaCustomerDraft('qa-ab12@example.com', 'pw') as Obj;
    expect(draft).toMatchObject({ firstName: 'Alex', lastName: 'Rivera', defaultShippingAddress: 0, isEmailVerified: true });
    expect((draft.addresses as Obj[])[0]).toMatchObject({ streetNumber: '1', streetName: 'Main St', city: 'New York', postalCode: '10001', country: 'US' });
  });

  it('the cart carries only the independent lines (add-ons follow once the plan line exists), recurrence info and the malva-order type', () => {
    const draft = qaCartDraft('cust-1', 'qa-ab12@example.com', resolved(), { serviceStartDate: '2026-03-12' }) as Obj;
    const lines = draft.lineItems as Obj[];
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ sku: 'MLV-CBL-500-24M', recurrenceInfo: { priceSelectionMode: 'Fixed', recurrencePolicy: { key: 'malva-monthly' } } });
    expect(draft.custom).toMatchObject({ type: { key: 'malva-order' }, fields: { serviceStartDate: '2026-03-12' } });
    expect(draft).toMatchObject({ customerId: 'cust-1', inventoryMode: 'None', currency: 'USD', country: 'US' });
  });

  it('an add-on is added with the new id of its plan line as parentLineItemId', () => {
    expect(qaAddLineAction(resolved()[1]!, 'line-0')).toMatchObject({ action: 'addLineItem', sku: 'MLV-ADD-APPLETV-MTH', custom: { fields: { offerKey: 'malva-offer-appletv', parentLineItemId: 'line-0' } } });
  });

  it('the order is paid, numbered QA-…, and a cancelled one gets changeOrderState', () => {
    expect(qaOrderDraft({ id: 'c', version: 3 }, 'QA-ABC123')).toEqual({ cart: { typeId: 'cart', id: 'c' }, version: 3, orderNumber: 'QA-ABC123', paymentState: 'Paid' });
    expect(cancelActions()).toEqual([{ action: 'changeOrderState', orderState: 'Cancelled' }]);
  });

  it('stores a three-period schedule for cable 500 and a label per plan line, both readable by the app parsers', () => {
    const fields = qaOrderFields(designOrders()[0], resolved(), '2026-10-07T10:00:00.000Z') as { priceSchedule: string; labelSnapshot: string; serviceStartDate: string };
    const schedules = parseSchedules(fields.priceSchedule);
    expect(schedules.ok && schedules.value).toHaveLength(1);
    expect(schedules.ok && schedules.value[0]?.periods.map((period) => period.kind)).toEqual(['intro', 'standing', 'step']);
    const labels = parseLabelSnapshot(fields.labelSnapshot);
    expect(labels.ok && labels.value.labels.map((entry) => [entry.sku, entry.label.id])).toEqual([['MLV-CBL-500-24M', 'MLV-CA-101']]);
    expect(fields.serviceStartDate).toBe('2026-03-12');
  });

  it('the discontinued add-on is a published malva-qa- product with one recurring USD price', () => {
    const draft = qaDiscontinuedProductDraft() as Obj;
    expect(isQaKey(String(draft.key))).toBe(true);
    expect(draft).toMatchObject({ publish: true, productType: { key: 'malva-addon' } });
    expect(((draft.masterVariant as Obj).prices as Obj[])[0]).toMatchObject({ country: 'US', recurrencePolicy: { key: 'malva-monthly' } });
  });
});

describe('pickVariant', () => {
  it('picks by attribute values (enum keys) and refuses when nothing matches', () => {
    const projection = PROJECTIONS['malva-offer-cable-500'] as never;
    expect(pickVariant(projection, { 'contract-term': 'month-to-month' }).sku).toBe('MLV-CBL-500-M2M');
    expect(() => pickVariant(projection, { 'contract-term': '36-months' })).toThrow('No variant');
  });
});

describe('createQaOrders', () => {
  it('creates the customer, both design orders and nothing else; the add-on is added after its plan', async () => {
    const api = fakeApi();
    const { log } = logger();
    const summary = await createQaOrders(options(), { api, log, password: 'Qa-test9aA1' });
    expect(summary.orders).toHaveLength(2);
    const paths = api.calls.map((call) => `${call.method} ${call.path.replace(/\/.*/, '')}`);
    expect(paths.filter((path) => path === 'post customers')).toHaveLength(1);
    expect(paths.filter((path) => path === 'post orders')).toHaveLength(2);
    expect(api.calls.filter((call) => call.path.startsWith('carts/') && (call.body as Obj).actions)).toHaveLength(2);
    expect(api.calls.some((call) => call.method === 'del')).toBe(false);
  });

  it('the cancelled scenario cancels exactly the second order', async () => {
    const api = fakeApi();
    await createQaOrders(options({ scenario: 'cancelled' }), { api, log: logger().log });
    const cancels = api.calls.filter((call) => call.path.startsWith('orders/') && JSON.stringify(call.body).includes('changeOrderState'));
    expect(cancels).toHaveLength(1);
  });

  it('empty creates a customer and no order', async () => {
    const api = fakeApi();
    const summary = await createQaOrders(options({ scenario: 'empty' }), { api, log: logger().log });
    expect(summary.orders).toEqual([]);
    expect(api.calls.map((call) => call.path)).toEqual(['customers']);
  });

  it('--discontinued publishes the add-on, orders it and unpublishes it afterwards', async () => {
    const api = fakeApi();
    await createQaOrders(options({ scenario: 'empty', discontinued: true }), { api, log: logger().log });
    const steps = api.calls.map((call) => (call.path === 'products' ? 'create-product' : call.path === 'orders' ? 'order' : JSON.stringify(call.body).includes('unpublish') ? 'unpublish' : ''));
    expect(steps.filter(Boolean)).toEqual(['create-product', 'order', 'unpublish']);
  });

  it('reuses an existing QA customer without creating one (no password)', async () => {
    const api = fakeApi({ customers: [] });
    (api as unknown as { get: unknown }).get = async (path: string, query?: Query) => (path === 'customers' && query?.where ? { results: [{ id: 'cust-9', version: 1, email: 'qa-ab12@example.com' }] } : fakeApi().get(path, query));
    const summary = await createQaOrders(options({ scenario: 'empty', customer: 'qa-ab12@example.com' }), { api, log: logger().log });
    expect(summary.password).toBeNull();
    expect(summary.customerId).toBe('cust-9');
    expect(api.calls).toEqual([]);
  });
});

describe('main', () => {
  const env = (project: string) => ({ CTP_SEED_PROJECT_KEY: project, CTP_SEED_AUTH_URL: 'https://auth.example', CTP_SEED_API_URL: 'https://api.example', CTP_SEED_CLIENT_ID: 'id', CTP_SEED_CLIENT_SECRET: 'secret' });

  it('refuses a project that is not allow-listed before any write', async () => {
    const api = fakeApi();
    const { lines, log } = logger();
    const code = await main(['--confirm-project', 'some-other-project'], { api, log, source: env('some-other-project') });
    expect(code).toBe(EXIT.TARGET_REFUSED);
    expect(api.calls).toEqual([]);
    expect(lines.join('\n')).toContain('not in the allow-list');
  });

  it('refuses to write without --confirm-project', async () => {
    const api = fakeApi();
    expect(await main([], { api, log: logger().log, source: env('spec-test-b2c-telecom') })).toBe(EXIT.TARGET_REFUSED);
    expect(api.calls).toEqual([]);
  });

  it('prints the generated password on exactly one line and nowhere else', async () => {
    const api = fakeApi();
    (api as unknown as { get: unknown }).get = async (path: string, query?: Query) => fakeApi().get(path, query);
    const { lines, log } = logger();
    const code = await main(['--confirm-project', 'spec-test-b2c-telecom', '--scenario', 'empty'], { api, log, source: env('spec-test-b2c-telecom'), password: 'Qa-OnlyHere9aA' });
    expect(code).toBe(EXIT.OK);
    expect(lines.filter((line) => line.includes('Qa-OnlyHere9aA'))).toEqual(['Password (shown once): Qa-OnlyHere9aA']);
  });

  it('answers a usage error with exit 3 and no write', async () => {
    const api = fakeApi();
    const { lines, log } = logger();
    expect(await main(['--confirm-project', 'spec-test-b2c-telecom', '--scenario', 'huge'], { api, log, source: env('spec-test-b2c-telecom') })).toBe(EXIT.PREFLIGHT);
    expect(lines[0]).toContain('Unknown scenario');
    expect(api.calls).toEqual([]);
  });
});

describe('cleanup-qa', () => {
  it('only qa-… and chrome-… example.com addresses and malva-qa- keys are ours', () => {
    expect(isQaEmail('qa-1a2b@example.com')).toBe(true);
    expect(isQaEmail('chrome-r-17@example.com')).toBe(true);
    expect(isQaEmail('alex.rivera@example.com')).toBe(false);
    expect(isQaEmail('qa-1a2b@example.org')).toBe(false);
    expect(isQaEmail('xqa-1a2b@example.com')).toBe(false);
    expect(isQaKey('malva-qa-discontinued-addon')).toBe(true);
    expect(isQaKey('malva-offer-cable-500')).toBe(false);
  });

  it('removes the QA customers with their recurring orders (cancelled first), orders and carts, and the temporary product; demo customers stay', async () => {
    const api = fakeApi({ products: {}, customers: [{ id: 'c-qa', version: 1, email: 'qa-ab12@example.com' }, { id: 'c-demo', version: 1, email: 'alex.rivera@example.com' }] });
    const { log } = logger();
    const failed = await cleanupQa(api, log);
    expect(failed).toBe(0);
    const deleted = api.calls.filter((call) => call.method === 'del').map((call) => call.path);
    expect(deleted).toEqual(['recurring-orders/ro-1', 'orders/orders-1', 'carts/carts-1', 'customers/c-qa', 'products/prod-1']);
    expect(api.calls.some((call) => call.path === 'customers/c-demo')).toBe(false);
    expect(JSON.stringify(api.calls[0]?.body)).toContain('canceled');
    expect(api.calls.filter((call) => JSON.stringify(call.body).includes('unpublish'))).toHaveLength(1);
  });

  it('a dry run removes nothing', async () => {
    const api = fakeApi({ products: {}, customers: [{ id: 'c-qa', version: 1, email: 'qa-ab12@example.com' }] });
    await cleanupQa(api, logger().log, true);
    expect(api.calls).toEqual([]);
  });
});

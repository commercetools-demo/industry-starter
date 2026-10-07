// npm run seed:experiments -- --confirm-project spec-test-b2c-telecom [--only inventory,discounts,shipping,fieldsize,handover,recurring]
//
// G-18: live experiments that settle open platform questions (inventory mode, predicate syntax, custom field size, the
// cart-to-order handover, recurring-order auto-creation). Every throwaway cart, order and recurring order is deleted
// afterwards; all of them carry the custom field demoMarker = "malva-experiment" where the type allows it.
// The results are printed as Markdown for the report / PROJECT-FINDINGS.md. Needs the catalog seeded (G-17).
import { randomBytes } from 'node:crypto';
import { consoleLog, exitCodeForError, parseArgs, type Log } from '../cli';
import { EXIT } from '../config';
import { CtHttpError, getAdminApi, loadSeedEnv, type CtApi } from '../lib';

export const EXPERIMENT_MARKER = 'malva-experiment';
type Obj = Record<string, unknown>;

const MONTHLY = { recurrencePolicy: { typeId: 'recurrence-policy', key: 'malva-monthly' }, priceSelectionMode: 'Dynamic' } as const;
const FIXED = { recurrencePolicy: { typeId: 'recurrence-policy', key: 'malva-monthly' }, priceSelectionMode: 'Fixed' } as const;

export interface Finding {
  experiment: string;
  title: string;
  ok: boolean;
  detail: string;
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

export async function attempt<T>(fn: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof CtHttpError) return { ok: false, error: `${err.statusCode}${err.code ? ` ${err.code}` : ''}: ${err.message}` };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

interface Created {
  carts: Obj[];
  orders: Obj[];
  customers: Obj[];
}

export class Lab {
  readonly created: Created = { carts: [], orders: [], customers: [] };
  /** A throwaway customer: an order with a recurring line needs one (found live in G-18). */
  customerId?: string;
  readonly findings: Finding[] = [];
  private counter = 0;
  constructor(
    readonly api: CtApi,
    readonly stamp: string = String(Date.now()),
  ) {}

  async init(): Promise<Outcome<Obj>> {
    const result = await attempt(
      async () =>
        (await this.api.post('customers', {
          key: `malva-exp-${this.stamp}`,
          email: `qa-g-${this.stamp}@example.com`,
          password: `Exp-${randomBytes(9).toString('hex')}!`,
          isEmailVerified: true,
          ...(await this.markerFields()),
        })) as { customer?: Obj },
    );
    if (!result.ok) return result;
    const customer = result.value.customer as Obj;
    this.created.customers.push(customer);
    this.customerId = String(customer.id);
    return { ok: true, value: customer };
  }

  private async markerFields(): Promise<Obj> {
    const type = await attempt(async () => (await this.api.get('types/key=malva-customer')) as Obj | null);
    return type.ok && type.value ? { custom: { type: { typeId: 'type', key: 'malva-customer' }, fields: { demoMarker: EXPERIMENT_MARKER } } } : {};
  }

  note(experiment: string, title: string, ok: boolean, detail: string): void {
    this.findings.push({ experiment, title, ok, detail });
  }

  orderNumber(): string {
    this.counter += 1;
    return `MLV-EXP-${this.stamp}-${this.counter}`;
  }

  async cart(body: Obj): Promise<Outcome<Obj>> {
    const result = await attempt(async () => (await this.api.post('carts', { currency: 'USD', country: 'US', ...(this.customerId ? { customerId: this.customerId } : {}), shippingAddress: SHIP_TO, ...body })) as Obj);
    if (result.ok) this.created.carts.push(result.value);
    return result;
  }

  async update(kind: 'carts' | 'orders', resource: Obj, actions: Obj[]): Promise<Outcome<Obj>> {
    const result = await attempt(async () => (await this.api.post(`${kind}/${String(resource.id)}`, { version: resource.version, actions })) as Obj);
    if (result.ok) this.remember(kind, result.value);
    return result;
  }

  remember(kind: 'carts' | 'orders', resource: Obj): void {
    const list = this.created[kind];
    const index = list.findIndex((r) => r.id === resource.id);
    if (index >= 0) list[index] = resource;
    else list.push(resource);
  }

  async order(cart: Obj, extra: Obj = {}): Promise<Outcome<Obj>> {
    const result = await attempt(async () => (await this.api.post('orders', { cart: { typeId: 'cart', id: cart.id }, version: cart.version, orderNumber: this.orderNumber(), ...extra })) as Obj);
    if (result.ok) this.created.orders.push(result.value);
    return result;
  }

  /** Deletes everything this run created: recurring orders first, then orders, then carts. Returns what could not be deleted. */
  async cleanup(): Promise<string[]> {
    const leftovers: string[] = [];
    for (const order of this.created.orders) {
      const recurring = await attempt(async () => (await this.api.get('recurring-orders', { where: `originOrder(id="${String(order.id)}")`, limit: 20 })) as { results?: Obj[] } | null);
      for (const ro of recurring.ok ? (recurring.value?.results ?? []) : []) {
        const canceled = await attempt(async () => (await this.api.post(`recurring-orders/${String(ro.id)}`, { version: ro.version, actions: [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason: 'experiment cleanup' } }] })) as Obj);
        const latest = canceled.ok ? canceled.value : ro;
        const removed = await attempt(() => this.api.del(`recurring-orders/${String(ro.id)}`, { version: Number(latest.version) }));
        if (!removed.ok) leftovers.push(`recurring-order ${String(ro.id)}: ${removed.error}`);
      }
    }
    for (const order of this.created.orders) {
      const fresh = await attempt(async () => (await this.api.get(`orders/${String(order.id)}`)) as Obj | null);
      const version = fresh.ok && fresh.value ? Number(fresh.value.version) : Number(order.version);
      const removed = await attempt(() => this.api.del(`orders/${String(order.id)}`, { version }));
      if (!removed.ok) leftovers.push(`order ${String(order.orderNumber)}: ${removed.error}`);
    }
    for (const cart of this.created.carts) {
      const fresh = await attempt(async () => (await this.api.get(`carts/${String(cart.id)}`)) as Obj | null);
      if (fresh.ok && fresh.value === null) continue;
      const version = fresh.ok && fresh.value ? Number(fresh.value.version) : Number(cart.version);
      const removed = await attempt(() => this.api.del(`carts/${String(cart.id)}`, { version }));
      if (!removed.ok) leftovers.push(`cart ${String(cart.id)}: ${removed.error}`);
    }
    for (const customer of this.created.customers) {
      const fresh = await attempt(async () => (await this.api.get(`customers/${String(customer.id)}`)) as Obj | null);
      const version = fresh.ok && fresh.value ? Number(fresh.value.version) : Number(customer.version);
      const removed = await attempt(() => this.api.del(`customers/${String(customer.id)}`, { version }));
      if (!removed.ok) leftovers.push(`customer ${String(customer.id)}: ${removed.error}`);
    }
    this.created.carts.length = 0;
    this.created.orders.length = 0;
    this.created.customers.length = 0;
    return leftovers;
  }
}

const lineItem = (sku: string, quantity = 1, recurrence: Obj | undefined = MONTHLY): Obj => ({ sku, quantity, ...(recurrence ? { recurrenceInfo: recurrence } : {}) });
const cents = (money: unknown): number | undefined => (money as { centAmount?: number } | undefined)?.centAmount;
const lines = (cart: Obj): Obj[] => (cart.lineItems as Obj[]) ?? [];
const SHIP_TO = { country: 'US', postalCode: '10118', city: 'New York', state: 'NY', streetName: 'Fifth Ave', streetNumber: '350' };

// ---------------------------------------------------------------------------------------------------------------

/** (1) Inventory mode per D-019: services have no InventoryEntry. */
export async function inventoryMode(lab: Lab): Promise<void> {
  const noAddress = await lab.cart({ shippingAddress: undefined, lineItems: [lineItem('MLV-ADD-SPOTIFY-MTH')] });
  if (noAddress.ok) {
    const refused = await lab.order(noAddress.value);
    lab.note('inventory', 'order from a digital-only (add-on) cart without a shipping address', refused.ok, refused.ok ? 'accepted' : `refused: ${refused.error}`);
  }
  for (const mode of ['None', 'TrackOnly', 'ReserveOnOrder']) {
    const cart = await lab.cart({ inventoryMode: mode, lineItems: [lineItem('MLV-ADD-SPOTIFY-MTH')] });
    if (!cart.ok) {
      lab.note('inventory', `service line (no InventoryEntry), inventoryMode ${mode}`, false, `cart refused: ${cart.error}`);
      continue;
    }
    const order = await lab.order(cart.value);
    lab.note('inventory', `service line (no InventoryEntry), inventoryMode ${mode}`, true, `cart accepted; order creation ${order.ok ? 'accepted' : `refused (${order.error})`}`);
  }
  for (const mode of ['None', 'TrackOnly', 'ReserveOnOrder']) {
    const device = await lab.cart({ inventoryMode: mode, lineItems: [lineItem('MLV-DEV-NOVAPRO-VLT-512', 1, undefined)] });
    if (!device.ok) {
      lab.note('inventory', `out-of-stock handset (stock 0), inventoryMode ${mode}`, false, `cart refused: ${device.error}`);
      continue;
    }
    const order = await lab.order(device.value);
    lab.note('inventory', `out-of-stock handset (stock 0), inventoryMode ${mode}`, true, `cart accepted; order creation ${order.ok ? 'accepted' : `refused (${order.error})`}`);
  }
  const stocked = await lab.cart({ inventoryMode: 'ReserveOnOrder', lineItems: [lineItem('MLV-DEV-NOVA5G-BLK-128', 1, undefined)] });
  const stockedOrder = stocked.ok ? await lab.order(stocked.value) : stocked;
  lab.note('inventory', 'stocked handset (200), inventoryMode ReserveOnOrder', stockedOrder.ok, stockedOrder.ok ? 'cart and order accepted' : `refused: ${stockedOrder.error}`);
}

/** (2a) Cart discounts: second line, bundle, intro month, tier, welcome code. The backticks in the predicates are proven by the seed itself. */
export async function discounts(lab: Lab): Promise<void> {
  const describe = (cart: Obj): string =>
    `${lines(cart)
      .map((l) => `${String(l.variant && (l.variant as Obj).sku)} x${String(l.quantity)} total ${String(cents(l.totalPrice))}${(l.discountedPricePerQuantity as unknown[] | undefined)?.length ? ' (discounted)' : ''}`)
      .join('; ')}; cart total ${String(cents(cart.totalPrice))}`;

  const twoLines = await lab.cart({ lineItems: [lineItem('MLV-PHN-UNL-M2M', 2)] });
  lab.note('discounts', 'second line $10 off (pattern target): 2 x Unlimited, 5000 each', twoLines.ok && cents(twoLines.value.totalPrice) === 9000, twoLines.ok ? describe(twoLines.value) : twoLines.error);

  const fiveLines = await lab.cart({ lineItems: [lineItem('MLV-PHN-UNL-M2M', 5)] });
  lab.note('discounts', 'second line $10 off applies to lines 2 to 5: 5 x Unlimited', fiveLines.ok && cents(fiveLines.value.totalPrice) === 21000, fiveLines.ok ? describe(fiveLines.value) : fiveLines.error);

  const bundle = await lab.cart({ lineItems: [lineItem('MLV-PHN-UNL-M2M'), lineItem('MLV-CBL-500-12M', 1, FIXED)] });
  lab.note('discounts', 'bundle $5 off the home internet line: Unlimited + Cable 500 12M (6499)', bundle.ok, bundle.ok ? describe(bundle.value) : bundle.error);

  const phoneOnly = await lab.cart({ lineItems: [lineItem('MLV-PHN-UNL-M2M')] });
  lab.note('discounts', 'no bundle discount without a home internet line: Unlimited only', phoneOnly.ok && cents(phoneOnly.value.totalPrice) === 5000, phoneOnly.ok ? describe(phoneOnly.value) : phoneOnly.error);

  const intro = await lab.cart({ lineItems: [lineItem('MLV-AIR-5G-12M', 1, FIXED)] });
  lab.note('discounts', 'first month free (intro-free-months > 0): Air 5G 12M (5500)', intro.ok, intro.ok ? describe(intro.value) : intro.error);

  const tier = await lab.cart({ lineItems: [lineItem('MLV-CBL-GIG-24M', 1, FIXED)] });
  lab.note('discounts', 'tier year 1 (20 percent) on Cable Gig 24M (7999)', tier.ok, tier.ok ? describe(tier.value) : tier.error);

  const welcome = await lab.cart({ lineItems: [lineItem('MLV-PHN-UNL-M2M')] });
  if (welcome.ok) {
    const withCode = await lab.update('carts', welcome.value, [{ action: 'addDiscountCode', code: 'WELCOME10' }]);
    lab.note('discounts', 'discount code WELCOME10 takes $10 off the total', withCode.ok && cents(withCode.value.totalPrice) === 4000, withCode.ok ? `${describe(withCode.value)}; codes: ${JSON.stringify((withCode.value.discountCodes as Obj[] | undefined)?.map((c) => c.state))}` : withCode.error);
  } else lab.note('discounts', 'discount code WELCOME10', false, welcome.error);
}

/** (2b) Shipping predicates over savedToLineItem attributes: matching-cart for an add-on-only cart and a mixed cart. */
export async function shipping(lab: Lab): Promise<void> {
  const methodKeys = async (cart: Obj): Promise<string> => {
    const res = await attempt(async () => (await lab.api.get('shipping-methods/matching-cart', { cartId: String(cart.id) })) as { results?: Obj[] } | null);
    return res.ok ? (res.value?.results ?? []).map((m) => String(m.key)).join(', ') || '(none)' : res.error;
  };
  const addOnOnly = await lab.cart({ shippingAddress: SHIP_TO, lineItems: [lineItem('MLV-ADD-SPOTIFY-MTH')] });
  lab.note('shipping', 'matching-cart for an add-on-only cart (digital delivery expected)', addOnOnly.ok, addOnOnly.ok ? `methods: ${await methodKeys(addOnOnly.value)}` : addOnOnly.error);
  const mixed = await lab.cart({ shippingAddress: SHIP_TO, lineItems: [lineItem('MLV-PHN-UNL-M2M'), lineItem('MLV-ADD-SPOTIFY-MTH')] });
  lab.note('shipping', 'matching-cart for a mixed cart: plan + add-on (standard delivery expected)', mixed.ok, mixed.ok ? `methods: ${await methodKeys(mixed.value)}` : mixed.error);
  const device = await lab.cart({ shippingAddress: SHIP_TO, lineItems: [lineItem('MLV-DEV-NOVA5G-BLK-128', 1, undefined)] });
  lab.note('shipping', 'matching-cart for a device-only cart (standard delivery expected)', device.ok, device.ok ? `methods: ${await methodKeys(device.value)}` : device.error);
}

/** (3) A long String in malva-order.labelSnapshot. */
export async function fieldSize(lab: Lab): Promise<void> {
  const base = await lab.cart({ lineItems: [lineItem('MLV-PHN-UNL-M2M')] });
  if (!base.ok) return lab.note('fieldsize', 'long custom field value', false, base.error);
  const order = await lab.order(base.value, { custom: { type: { typeId: 'type', key: 'malva-order' }, fields: { labelSnapshot: 'x'.repeat(4096), demoMarker: EXPERIMENT_MARKER } } });
  lab.note('fieldsize', '4096 characters in malva-order.labelSnapshot at order creation', order.ok, order.ok ? `accepted; stored length ${String((order.value.custom as { fields?: { labelSnapshot?: string } } | undefined)?.fields?.labelSnapshot?.length)}` : order.error);
  if (!order.ok) return;
  for (const size of [8192, 65536]) {
    const fresh = (await lab.api.get(`orders/${String(order.value.id)}`)) as Obj;
    const result = await lab.update('orders', fresh, [{ action: 'setCustomField', name: 'labelSnapshot', value: 'y'.repeat(size) }]);
    lab.note('fieldsize', `${size} characters via setCustomField`, result.ok, result.ok ? 'accepted' : result.error);
  }
}

/** (4) malva-cart -> malva-order handover: does the order keep the cart's custom type, and is OrderFromCartDraft.custom needed? */
export async function handover(lab: Lab): Promise<void> {
  const typed = { type: { typeId: 'type', key: 'malva-cart' }, fields: { postalCode: '10118', serviceableCable: true, serviceableWireless: true, serviceablePhone: true, demoMarker: EXPERIMENT_MARKER } };
  const cart = await lab.cart({ lineItems: [lineItem('MLV-PHN-UNL-M2M')], custom: typed });
  lab.note('handover', 'cart created with custom type malva-cart (resourceTypeIds [order] covers carts)', cart.ok, cart.ok ? `custom type id ${String((cart.value.custom as Obj | undefined)?.type && ((cart.value.custom as Obj).type as Obj).id)}` : cart.error);
  if (!cart.ok) return;
  const plain = await lab.order(cart.value);
  lab.note('handover', 'order from a cart typed malva-cart, no custom in the draft', plain.ok, plain.ok ? `order.custom = ${JSON.stringify(plain.value.custom ?? null)}` : plain.error);
  if (plain.ok) {
    const custom = plain.value.custom as { type?: { id?: string }; fields?: Obj } | undefined;
    const retyped = await lab.update('orders', plain.value, [{ action: 'setCustomType', type: { typeId: 'type', key: 'malva-order' }, fields: { serviceStartDate: '2026-10-12', postalCode: custom?.fields?.postalCode ?? '10118', demoMarker: EXPERIMENT_MARKER } }]);
    lab.note('handover', 'switching the order to malva-order with setCustomType afterwards', retyped.ok, retyped.ok ? `fields: ${JSON.stringify((retyped.value.custom as Obj | undefined)?.fields)}` : retyped.error);
  }
  const cart2 = await lab.cart({ lineItems: [lineItem('MLV-PHN-UNL-M2M')], custom: typed });
  if (cart2.ok) {
    const drafted = await lab.order(cart2.value, { custom: { type: { typeId: 'type', key: 'malva-order' }, fields: { serviceStartDate: '2026-10-12', postalCode: '10118', priceSchedule: '{"v":1,"schedules":[]}', demoMarker: EXPERIMENT_MARKER } } });
    lab.note('handover', 'OrderFromCartDraft.custom with type malva-order on a cart typed malva-cart', drafted.ok, drafted.ok ? `order.custom fields: ${JSON.stringify((drafted.value.custom as Obj | undefined)?.fields)}` : drafted.error);
  }
  const cart3 = await lab.cart({ lineItems: [lineItem('MLV-PHN-UNL-M2M')], custom: typed });
  if (cart3.ok) {
    const switched = await lab.update('carts', cart3.value, [{ action: 'setCustomType', type: { typeId: 'type', key: 'malva-order' }, fields: { postalCode: '10118', serviceableCable: true, demoMarker: EXPERIMENT_MARKER } }]);
    lab.note('handover', 'switching the cart from malva-cart to malva-order with setCustomType before ordering', switched.ok, switched.ok ? 'accepted' : switched.error);
    if (switched.ok) {
      const order = await lab.order(switched.value);
      lab.note('handover', 'order from the switched cart', order.ok, order.ok ? `order.custom fields: ${JSON.stringify((order.value.custom as Obj | undefined)?.fields)}` : order.error);
    }
  }
}

/** (5) Does ordering a cart with recurring lines create a Recurring Order in the background? */
export async function recurring(lab: Lab, waitMs = 15000, pollMs = 2500): Promise<void> {
  const cart = await lab.cart({ lineItems: [lineItem('MLV-PHN-UNL-M2M'), lineItem('MLV-ADD-SPOTIFY-MTH')], custom: { type: { typeId: 'type', key: 'malva-cart' }, fields: { demoMarker: EXPERIMENT_MARKER } } });
  if (!cart.ok) return lab.note('recurring', 'cart with two recurring lines', false, cart.error);
  const order = await lab.order(cart.value);
  if (!order.ok) return lab.note('recurring', 'order from a cart with recurring lines', false, order.error);
  let found: Obj[] = [];
  for (let waited = 0; waited <= waitMs; waited += pollMs) {
    const res = await attempt(async () => (await lab.api.get('recurring-orders', { where: `originOrder(id="${String(order.value.id)}")`, limit: 20 })) as { results?: Obj[] } | null);
    found = res.ok ? (res.value?.results ?? []) : [];
    if (found.length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  const detail = found.length === 0 ? `none after ${waitMs / 1000} s` : found.map((r) => `${String(r.recurringOrderState)} (starts ${String(r.startsAt)}, cart ${String((r.cart as Obj | undefined)?.id)})`).join('; ');
  lab.note('recurring', 'Recurring Order created automatically after the order', found.length > 0, detail);
}

export const EXPERIMENTS: Record<string, (lab: Lab) => Promise<void>> = { inventory: inventoryMode, discounts, shipping, fieldsize: fieldSize, handover, recurring: (lab) => recurring(lab) };

export function renderFindings(findings: Finding[]): string {
  const groups = [...new Set(findings.map((f) => f.experiment))];
  return groups.map((g) => `### ${g}\n${findings.filter((f) => f.experiment === g).map((f) => `- ${f.ok ? 'OK' : 'NOTE'}: ${f.title} -> ${f.detail}`).join('\n')}`).join('\n\n');
}

export interface ExperimentDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  log?: Log;
  experiments?: Record<string, (lab: Lab) => Promise<void>>;
}

export async function main(argv: string[], deps: ExperimentDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project', 'only']);
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const all = deps.experiments ?? EXPERIMENTS;
    const only = args.values.get('only')?.split(',').filter(Boolean);
    const names = Object.keys(all).filter((n) => !only || only.includes(n));
    const lab = new Lab(api);
    try {
      const customer = await lab.init();
      if (!customer.ok) lab.note('setup', 'throwaway customer', false, customer.error);
      for (const name of names) {
        try {
          await all[name](lab);
        } catch (err) {
          lab.note(name, 'experiment crashed', false, err instanceof Error ? err.message : String(err));
        }
      }
    } finally {
      const leftovers = await lab.cleanup();
      log(renderFindings(lab.findings));
      log(leftovers.length === 0 ? '\nCleanup: every throwaway cart, order and recurring order was deleted.' : `\nCleanup left ${leftovers.length} resource(s) (delete by the marker ${EXPERIMENT_MARKER}):\n${leftovers.join('\n')}`);
    }
    return EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

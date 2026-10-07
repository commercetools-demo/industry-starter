// Checkout spike (workstream L, Gate 2): can ONE cart carry a recurring Fixed line, a recurring Dynamic line and one-time lines,
// with recurringPaymentConfiguration.paymentStrategy = Checkout, and become an Order plus a Recurring Order?
// Run: npm run spike:recurring-checkout -- [--skip-checkout] [--keep]
// Creates only resources keyed `spike-recurring-*` (plus a throwaway customer) in spec-test-b2c-telecom and deletes them at the end.
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { decide } from './lib/decide';
import { renderFindings, SPIKE_BEGIN, SPIKE_END, writeBetweenMarkers, type FindingsExtras } from './lib/findings';
import { createHttp, readSpikeEnv, type Http, type Rec, type SpikeEnv, SpikeHttpError } from './lib/http';
import { blocked, formatError, runProbe, type ProbeResult } from './lib/probe';

const MONTHLY = 'malva-monthly';
const SHIP_TO = { country: 'US', postalCode: '10001' };
const recurrence = (mode: 'Fixed' | 'Dynamic'): Rec => ({ recurrencePolicy: { typeId: 'recurrence-policy', key: MONTHLY }, priceSelectionMode: mode });

const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const rec = (v: unknown): Rec => (typeof v === 'object' && v !== null ? (v as Rec) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Nested key names of a JSON value (values dropped): `a{b,c{d}}`. */
export function shapeOf(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length > 0 ? shapeOf(value[0]) : ''}]`;
  if (typeof value !== 'object' || value === null) return '';
  return `{${Object.entries(value as Rec)
    .map(([k, v]) => `${k}${shapeOf(v)}`)
    .join(',')}}`;
}

function attrKey(variant: Rec, name: string): string {
  const a = arr(variant.attributes).find((x) => x.name === name);
  const v = a?.value;
  return typeof v === 'object' && v !== null ? str((v as Rec).key) : str(v);
}

interface Created {
  carts: string[];
  orders: string[];
  customers: string[];
  recurringOrders: string[];
}

class Spike {
  readonly created: Created = { carts: [], orders: [], customers: [], recurringOrders: [] };
  readonly stamp = String(Date.now());
  customerId = '';
  taxCategoryId = '';
  policyId = '';
  constructor(
    readonly http: Http,
    readonly env: SpikeEnv,
  ) {}

  async getCart(id: string): Promise<Rec> {
    return this.http.api('GET', `carts/${id}`);
  }

  async updateCart(id: string, actions: Rec[]): Promise<Rec> {
    const cart = await this.getCart(id);
    return this.http.api('POST', `carts/${id}`, { version: cart.version, actions });
  }

  async createCart(suffix: string): Promise<Rec> {
    const cart = await this.http.api('POST', 'carts', {
      key: `spike-recurring-${this.stamp}-${suffix}`,
      currency: 'USD',
      country: 'US',
      taxMode: 'Platform',
      inventoryMode: 'None',
      customerId: this.customerId,
      shippingAddress: SHIP_TO,
      custom: { type: { typeId: 'type', key: 'malva-order' }, fields: {} },
    });
    this.created.carts.push(str(cart.id));
    return cart;
  }

  async variant(productKey: string, pick: (v: Rec) => boolean): Promise<Rec> {
    const p = await this.http.api('GET', `product-projections/key=${productKey}?priceCurrency=USD&priceCountry=US`).catch((err: unknown) => {
      if (err instanceof SpikeHttpError && err.status === 404) throw new Error(`Product ${productKey} not found: run seed (G) first`);
      throw err;
    });
    const found = [rec(p.masterVariant), ...arr(p.variants)].find(pick);
    if (!found) throw new Error(`No matching variant on ${productKey}: run seed (G) first`);
    return found;
  }

  async cleanup(): Promise<string[]> {
    const left: string[] = [];
    const attempt = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
      try {
        await fn();
      } catch (err) {
        if (err instanceof SpikeHttpError && err.status === 404) return;
        left.push(`${label}: ${formatError(err)}`);
      }
    };
    const recurringCartIds: string[] = [];
    for (const orderId of this.created.orders) {
      const list = await this.http.api('GET', `recurring-orders?where=${encodeURIComponent(`originOrder(id="${orderId}")`)}&limit=20`).catch(() => ({ results: [] }));
      for (const ro of arr(list.results)) {
        recurringCartIds.push(str(rec(ro.cart).id));
        let version = Number(ro.version);
        await attempt(`recurring-order ${str(ro.id)} cancel`, async () => {
          const res = await this.http.api('POST', `recurring-orders/${str(ro.id)}`, { version, actions: [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason: 'spike cleanup' } }] });
          version = Number(res.version);
        });
        await attempt(`recurring-order ${str(ro.id)} delete`, () => this.http.api('DELETE', `recurring-orders/${str(ro.id)}?version=${version}`));
      }
    }
    for (const id of this.created.orders) {
      await attempt(`order ${id}`, async () => {
        const o = await this.http.api('GET', `orders/${id}`);
        await this.http.api('DELETE', `orders/${id}?version=${String(o.version)}`);
      });
    }
    for (const id of [...this.created.carts, ...recurringCartIds]) {
      await attempt(`cart ${id}`, async () => {
        const c = await this.getCart(id);
        await this.http.api('DELETE', `carts/${id}?version=${String(c.version)}`);
      });
    }
    for (const id of this.created.customers) {
      await attempt(`customer ${id}`, async () => {
        const c = await this.http.api('GET', `customers/${id}`);
        await this.http.api('DELETE', `customers/${id}?version=${String(c.version)}`);
      });
    }
    return left;
  }
}

const PAYMENT_ATTEMPTS: Rec[] = [
  { action: 'setRecurringPaymentConfiguration', recurringPaymentConfiguration: { paymentStrategy: 'Checkout' } },
  { action: 'setRecurringPaymentStrategy', paymentStrategy: 'Checkout' },
  { action: 'setRecurringPaymentConfiguration', paymentStrategy: 'Checkout' },
];

export async function runSpike(http: Http, env: SpikeEnv, opts: { skipCheckout: boolean; keep: boolean }): Promise<{ results: ProbeResult[]; extras: FindingsExtras; leftovers: string[] }> {
  const s = new Spike(http, env);
  const results: ProbeResult[] = [];
  const extras: FindingsExtras = { mixAccepted: 'unknown', openItems: [] };
  const checkoutBlocked = opts.skipCheckout || !env.checkoutAppKey;
  const why = opts.skipCheckout ? 'OA-05 (--skip-checkout)' : 'OA-05 (CTP_CHECKOUT_APP_KEY not set)';
  let leftovers: string[] = [];

  try {
    results.push(
      await runProbe('P0', 'Policy malva-monthly exists with a 1-month standard schedule', async () => {
        const p = await http.api('GET', `recurrence-policies/key=${MONTHLY}`);
        s.policyId = str(p.id);
        const sch = rec(p.schedule);
        const ok = sch.type === 'standard' && sch.value === 1 && sch.intervalUnit === 'Months';
        return { status: ok ? 'PASS' : 'FAIL', evidence: `${str(sch.type)} ${String(sch.value)} ${str(sch.intervalUnit)}` };
      }),
    );

    // setup: throwaway customer (a recurring line needs one), tax category, variants
    const customer = await http.api('POST', 'customers', { key: `spike-recurring-${s.stamp}`, email: `spike-recurring-${s.stamp}@example.com`, password: `Sp-${randomBytes(9).toString('hex')}!`, isEmailVerified: true });
    const customerId = str(rec(customer.customer).id);
    s.customerId = customerId;
    s.created.customers.push(customerId);
    const taxes = arr((await http.api('GET', 'tax-categories?limit=50')).results);
    s.taxCategoryId = str(taxes.find((t) => str(t.key).startsWith('malva-'))?.id);
    const fixed = await s.variant('malva-offer-cable-500', (v) => attrKey(v, 'contract-term') === '24-months');
    const dynamic = await s.variant('malva-offer-phone-unlimited', (v) => attrKey(v, 'contract-term') === 'month-to-month');
    const oneTime = await s.variant('malva-offer-router-ax3000', (v) => attrKey(v, 'charge-type') === 'one-time');
    const activation: Rec = {
      action: 'addCustomLineItem',
      name: { 'en-US': 'Activation fee' },
      slug: 'spike-activation-fee',
      quantity: 1,
      money: { currencyCode: 'USD', centAmount: 2500 },
      taxCategory: { typeId: 'tax-category', id: s.taxCategoryId },
    };
    const addFixed: Rec = { action: 'addLineItem', sku: str(fixed.sku), quantity: 1, recurrenceInfo: recurrence('Fixed') };
    const addDynamic: Rec = { action: 'addLineItem', sku: str(dynamic.sku), quantity: 1, recurrenceInfo: recurrence('Dynamic') };
    const addOneTime: Rec = { action: 'addLineItem', sku: str(oneTime.sku), quantity: 1 };

    // P1
    let main: Rec | undefined;
    results.push(
      await runProbe('P1', 'Cart takes a Fixed, a Dynamic, a one-time Line Item and a Custom Line Item in one update', async () => {
        const cart = await s.createCart('main');
        main = await s.updateCart(str(cart.id), [addFixed, addDynamic, addOneTime, activation]);
        return { status: 'PASS', evidence: `200, ${arr(main.lineItems).length} line items, ${arr(main.customLineItems).length} custom line item` };
      }),
    );
    results.push(
      await runProbe('P1b', 'Cart with recurring + Custom Line Item only', async () => {
        const cart = await s.createCart('b');
        await s.updateCart(str(cart.id), [addFixed, activation]);
        return { status: 'PASS', evidence: '200' };
      }),
    );
    results.push(
      await runProbe('P1c', 'Cart with recurring + one-time Line Item only', async () => {
        const cart = await s.createCart('c');
        await s.updateCart(str(cart.id), [addFixed, addOneTime]);
        return { status: 'PASS', evidence: '200' };
      }),
    );
    extras.mixAccepted = results.find((r) => r.id === 'P1')?.status === 'PASS' ? 'yes' : 'no';

    // P2
    results.push(
      await runProbe('P2', 'Recurring lines carry a price tied to malva-monthly', async () => {
        if (!main) return { status: 'UNKNOWN', evidence: 'P1 cart missing' };
        const lines = arr(main.lineItems).filter((l) => l.recurrenceInfo);
        const bad = lines.filter((l) => rec(rec(l.price).recurrencePolicy).id !== s.policyId).map((l) => str(rec(l.variant).sku));
        return bad.length === 0 && lines.length === 2 ? { status: 'PASS', evidence: `${lines.length} recurring lines tied` } : { status: 'FAIL', evidence: `price-fell-back:${bad.join(',') || 'lines missing'}` };
      }),
    );

    // shipping method on the main cart (needed by the session and harmless for the order)
    if (main) {
      try {
        const matching = await http.api('GET', `shipping-methods/matching-cart?cartId=${str(main.id)}`);
        const methods = arr(matching.results);
        const method = methods.find((m) => str(m.key).startsWith('malva-')) ?? methods[0];
        if (method) main = await s.updateCart(str(main.id), [{ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', id: str(method.id) } }]);
      } catch (err) {
        extras.openItems.push(`shipping method not set: ${formatError(err)}`);
      }
    }

    // P3: runs even without OA-05, because it is a plain cart update (deviation noted in the L report)
    let acceptedAction: Rec | undefined;
    results.push(
      await runProbe('P3', 'recurringPaymentConfiguration (Checkout) accepted on the initial cart', async () => {
        if (!main) return { status: 'UNKNOWN', evidence: 'P1 cart missing' };
        const attempts: string[] = [];
        for (const [i, action] of PAYMENT_ATTEMPTS.entries()) {
          try {
            const updated = await s.updateCart(str(main.id), [action]);
            attempts.push(`#${i + 1} 200`);
            acceptedAction = action;
            const cfg = rec(updated.recurringPaymentConfiguration);
            extras.acceptedAction = shapeOf(action);
            const present = cfg.paymentStrategy === 'Checkout';
            return {
              status: present ? 'PASS' : 'FAIL',
              evidence: `${attempts.join('; ')}; stored ${shapeOf(updated.recurringPaymentConfiguration) || 'nothing'}${present ? '' : ' (initial-cart-ignores-config)'}`,
            };
          } catch (err) {
            attempts.push(`#${i + 1} ${formatError(err)}`);
          }
        }
        return { status: 'FAIL', evidence: `initial-cart-rejects-config: ${attempts.join('; ').slice(0, 400)}` };
      }),
    );
    main = main ? await s.getCart(str(main.id)) : main;

    // P4, P5
    if (checkoutBlocked || !main) {
      results.push(blocked('P4', 'Hosted Checkout session for the mixed cart', why));
      results.push(blocked('P5', 'Checkout application readable', why));
    } else {
      const cartId = str(main.id);
      results.push(
        await runProbe('P4', 'Hosted Checkout session for the mixed cart', async () => {
          const res = await http.service('session', 'POST', 'sessions', { cart: { cartRef: { id: cartId } }, metadata: { applicationKey: env.checkoutAppKey } });
          return res.status === 201 && str(res.body.id) ? { status: 'PASS', evidence: '201 session created' } : { status: 'FAIL', evidence: `HTTP ${res.status} without id` };
        }),
      );
      results.push(
        await runProbe('P5', 'Checkout application readable and active', async () => {
          try {
            const res = await http.service('checkout', 'GET', `applications/key=${env.checkoutAppKey}`);
            const b = res.body;
            const integrations = arr(rec(b.paymentsConfiguration).integrations ?? b.paymentsConfiguration).map((i) => `${str(i.key)}:${str(i.type)}`);
            const evidence = `key set, mode ${str(b.mode)}, status ${str(b.status)}, countries ${Array.isArray(b.countries) ? b.countries.length : 0}, origins ${Array.isArray(b.allowedOrigins) ? b.allowedOrigins.length : 0}, integrations ${integrations.join(',') || 'none'}`;
            return { status: str(b.status) === 'Active' ? 'PASS' : 'FAIL', evidence };
          } catch (err) {
            if (err instanceof SpikeHttpError && err.status === 403) return { status: 'UNKNOWN', evidence: 'UNKNOWN (scope): 403 reading the application' };
            throw err;
          }
        }),
      );
    }

    // P6: order from the main cart
    let orderId = '';
    results.push(
      await runProbe('P6', 'Order from the mixed cart (Method A)', async () => {
        if (!main) return { status: 'UNKNOWN', evidence: 'P1 cart missing' };
        const order = await http.api('POST', 'orders', { cart: { typeId: 'cart', id: str(main.id) }, version: main.version, orderNumber: `spike-recurring-${s.stamp}` });
        orderId = str(order.id);
        s.created.orders.push(orderId);
        return { status: 'PASS', evidence: '201' };
      }),
    );

    // P7: recurring orders of the order (they appear a few seconds after the order)
    let recurringOrders: Rec[] = [];
    const fetchRecurring = async (id: string): Promise<Rec[]> => {
      for (let i = 0; i < 20; i += 1) {
        const list = await http.api('GET', `recurring-orders?where=${encodeURIComponent(`originOrder(id="${id}")`)}&expand=cart&limit=20`);
        if (arr(list.results).length > 0) return arr(list.results);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return [];
    };
    results.push(
      await runProbe('P7', 'Recurring order(s) created with a recurring cart holding only recurring lines', async () => {
        if (!orderId) return { status: 'UNKNOWN', evidence: 'no order' };
        recurringOrders = await fetchRecurring(orderId);
        recurringOrders.forEach((ro) => s.created.recurringOrders.push(str(ro.id)));
        const parts = recurringOrders.map((ro) => {
          const cart = rec(rec(ro.cart).obj);
          const lines = arr(cart.lineItems);
          const customs = arr(cart.customLineItems);
          const allRecurring = [...lines, ...customs].every((l) => l.recurrenceInfo);
          const sch = rec(ro.schedule);
          return {
            allRecurring: allRecurring && cart.origin === 'RecurringOrder',
            text: `schedule ${str(sch.type)} ${String(sch.value ?? sch.day)} ${str(sch.intervalUnit)}; origin ${str(cart.origin)}; skus ${lines.map((l) => str(rec(l.variant).sku)).join('+')}${customs.length ? ` +${customs.length} custom` : ''}; modes ${lines.map((l) => str(rec(l.recurrenceInfo).priceSelectionMode)).join('+')}`,
          };
        });
        const modes = new Set(recurringOrders.flatMap((ro) => arr(rec(rec(ro.cart).obj).lineItems).map((l) => str(rec(l.recurrenceInfo).priceSelectionMode))));
        extras.grouping = `${recurringOrders.length} recurring order(s); Fixed and Dynamic lines in same order: ${recurringOrders.length === 1 && modes.has('Fixed') && modes.has('Dynamic') ? 'yes' : 'no'}`;
        const ok = recurringOrders.length > 0 && parts.every((p) => p.allRecurring);
        return { status: ok ? 'PASS' : 'FAIL', evidence: `${recurringOrders.length} recurring order(s): ${parts.map((p) => p.text).join(' | ')}` };
      }),
    );

    // P8, P9, P11 on the recurring carts
    const roCart = (ro: Rec): Rec => rec(rec(ro.cart).obj);
    results.push(
      await runProbe('P8', 'Recurring cart inherits paymentStrategy Checkout', async () => {
        if (recurringOrders.length === 0) return { status: 'UNKNOWN', evidence: 'no recurring order' };
        const strategies = recurringOrders.map((ro) => str(rec(roCart(ro).recurringPaymentConfiguration).paymentStrategy) || 'absent');
        const ok = strategies.every((x) => x === 'Checkout');
        return { status: ok ? 'PASS' : 'FAIL', evidence: ok ? `inherited: ${strategies.join(',')}` : `NOT_INHERITED: ${strategies.join(',')}` };
      }),
    );
    results.push(
      await runProbe('P9', 'paymentStrategy can be set on a recurring cart', async () => {
        if (recurringOrders.length === 0) return { status: 'UNKNOWN', evidence: 'no recurring order' };
        const candidates = acceptedAction ? [acceptedAction] : [PAYMENT_ATTEMPTS[1] as Rec, PAYMENT_ATTEMPTS[0] as Rec];
        const notes: string[] = [];
        for (const ro of recurringOrders) {
          const cartId = str(rec(ro.cart).id);
          let done = false;
          for (const action of candidates) {
            try {
              const updated = await s.updateCart(cartId, [action]);
              done = rec(updated.recurringPaymentConfiguration).paymentStrategy === 'Checkout';
              notes.push(`${shapeOf(action)} -> ${done ? 'readable' : 'not readable'}`);
              if (done) break;
            } catch (err) {
              notes.push(`${shapeOf(action)} -> ${formatError(err)}`);
            }
          }
          if (!done) return { status: 'FAIL', evidence: notes.join('; ').slice(0, 400) };
        }
        return { status: 'PASS', evidence: notes.join('; ').slice(0, 300) };
      }),
    );
    results.push(
      await runProbe('P11', 'INFO: recalculate on a recurring cart', async () => {
        const first = recurringOrders[0];
        if (!first) return { status: 'UNKNOWN', evidence: 'no recurring order' };
        try {
          await s.updateCart(str(rec(first.cart).id), [{ action: 'recalculate' }]);
          return { status: 'INFO', evidence: '200: recurring carts can be updated' };
        } catch (err) {
          return { status: 'INFO', evidence: formatError(err) };
        }
      }),
    );

    // P10: intro discount on an ordered line: does the recurring cart carry the intro or the standing price?
    results.push(
      await runProbe('P10', 'INFO: intro line (Cable 100, 24 months) in the recurring cart', async () => {
        const intro = await s.variant('malva-offer-cable-100', (v) => attrKey(v, 'contract-term') === '24-months');
        const cart = await s.createCart('intro');
        const updated = await s.updateCart(str(cart.id), [{ action: 'addLineItem', sku: str(intro.sku), quantity: 1, recurrenceInfo: recurrence('Fixed') }]);
        const line = arr(updated.lineItems)[0] ?? {};
        const initialTotal = rec(updated.totalPrice).centAmount;
        const hasIntro = arr(line.discountedPricePerQuantity).length > 0;
        const shippingSet = rec(updated.shippingAddress).country === 'US';
        const order = await http.api('POST', 'orders', { cart: { typeId: 'cart', id: str(updated.id) }, version: updated.version, orderNumber: `spike-recurring-${s.stamp}-intro` });
        s.created.orders.push(str(order.id));
        const list = await fetchRecurring(str(order.id));
        list.forEach((ro) => s.created.recurringOrders.push(str(ro.id)));
        const rcart = list[0] ? roCart(list[0]) : {};
        const rline = arr(rcart.lineItems)[0] ?? {};
        return {
          status: 'INFO',
          evidence: `initial cart total ${String(initialTotal)} (discount on line: ${hasIntro ? 'yes' : 'no'}, address ${shippingSet ? 'set' : 'missing'}); recurring cart line price ${String(rec(rec(rline.price).value).centAmount)} total ${String(rec(rcart.totalPrice).centAmount)} (discounted: ${rline.discountedPricePerQuantity && arr(rline.discountedPricePerQuantity).length > 0 ? 'yes' : 'no'})`,
        };
      }),
    );
  } finally {
    if (!opts.keep) leftovers = await s.cleanup();
  }
  if (leftovers.length > 0) extras.openItems.push(`leftovers: ${leftovers.join('; ')}`);
  results.sort((a, b) => probeRank(a.id) - probeRank(b.id));
  return { results, extras, leftovers };
}

function probeRank(id: string): number {
  const ids = ['P0', 'P1', 'P1b', 'P1c', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11'];
  const i = ids.indexOf(id);
  return i < 0 ? 99 : i;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // the process environment alone is used
  }
  const env = readSpikeEnv(process.env);
  const flags = new Set(process.argv.slice(2));
  const { results, extras, leftovers } = await runSpike(createHttp(env), env, { skipCheckout: flags.has('--skip-checkout'), keep: flags.has('--keep') });
  const decision = decide(results);
  const text = renderFindings(results, decision, new Date().toISOString(), extras);
  writeBetweenMarkers(path.resolve(process.cwd(), '../plan/PROJECT-FINDINGS.md'), SPIKE_BEGIN, SPIKE_END, text);
  console.log(text);
  if (leftovers.length > 0) {
    console.error(`${leftovers.length} spike resource(s) could not be deleted`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && /recurring-checkout\.ts$/.test(process.argv[1])) {
  main().catch((err: unknown) => {
    console.error(formatError(err));
    process.exitCode = 1;
  });
}

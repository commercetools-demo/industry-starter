// Device recurrence spike (workstream Q-03): what do financed device lines do in the live project?
// Run: npm run spike:device-recurrence -- [--keep]
// Creates only resources keyed `spike-device-*` (plus a throwaway customer) in spec-test-b2c-telecom and deletes them at the end.
// Facts measured (a) to (g) are listed in plan/workstreams/Q-devices-and-acquisition-modes.md, task Q-03.
import { randomBytes } from 'node:crypto';
import { computeRecurringExpiry } from '@/lib/devices/acquisition';
import { createHttp, readSpikeEnv, type Http, type Rec, type SpikeEnv, SpikeHttpError } from './lib/http';
import { formatError, runProbe, type ProbeResult } from './lib/probe';

const MONTHLY = 'malva-monthly';
const INSTALLMENT_24 = 'malva-device-installment-24';
const INSTALLMENT_36 = 'malva-device-installment-36';
const LEASE_24 = 'malva-device-lease-24';
const POLICY_KEYS = [MONTHLY, 'malva-device-installment-12', INSTALLMENT_24, INSTALLMENT_36, LEASE_24];
const SHIP_TO = { country: 'US', postalCode: '10001' };
const LINE_TYPE = { typeId: 'type', key: 'malva-line-item' };

const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const rec = (v: unknown): Rec => (typeof v === 'object' && v !== null ? (v as Rec) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const DAY_MS = 86_400_000;

/** `addLineItem` of a device line: financed lines carry a policy, outright lines none. */
export function deviceLineAction(sku: string, mode: 'outright' | 'installments' | 'lease', term: number, offerKey: string, priceSelectionMode: 'Fixed' | 'Dynamic' = 'Fixed'): Rec {
  const policyKey = mode === 'installments' ? `malva-device-installment-${term}` : mode === 'lease' ? `malva-device-lease-${term}` : null;
  return {
    action: 'addLineItem',
    sku,
    quantity: 1,
    ...(policyKey ? { recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', key: policyKey }, priceSelectionMode } } : {}),
    custom: { type: LINE_TYPE, fields: { offerKey, acquisitionMode: mode, acquisitionTermMonths: mode === 'outright' ? 0 : term } },
  };
}

export interface RecurringOrderFacts {
  id: string;
  state: string;
  startsAt: string;
  nextOrderAt?: string;
  expiresAt?: string;
  schedule: string;
  skus: string[];
  policyKeys: string[];
}

/** The facts of one recurring order the spike records; `keyOf` maps a policy id to its key. */
export function describeRecurringOrder(ro: Rec, keyOf: (id: string) => string): RecurringOrderFacts {
  const cart = rec(rec(ro.cart).obj);
  const lines = arr(cart.lineItems);
  const schedule = rec(ro.schedule);
  return {
    id: str(ro.id),
    state: str(ro.recurringOrderState),
    startsAt: str(ro.startsAt),
    ...(str(ro.nextOrderAt) ? { nextOrderAt: str(ro.nextOrderAt) } : {}),
    ...(str(ro.expiresAt) ? { expiresAt: str(ro.expiresAt) } : {}),
    schedule: `${str(schedule.type)} ${String(schedule.value ?? schedule.day)} ${str(schedule.intervalUnit)}`,
    skus: lines.map((line) => str(rec(line.variant).sku)),
    policyKeys: lines.map((line) => keyOf(str(rec(rec(line.recurrenceInfo).recurrencePolicy).id))),
  };
}

/**
 * The value of FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER from the measured dates: the number of the payment that falls at `startsAt`.
 * The initial Order is payment 1. When the platform generates its first order at `startsAt` (next order due at once) that order is
 * payment 2; when the first generated order is due one month after `startsAt`, the instant `startsAt` itself still is payment 1.
 */
export function firstGeneratedPaymentNumber(startsAt: string, nextOrderAt: string | undefined): 1 | 2 | undefined {
  if (!nextOrderAt) return undefined;
  const gapDays = (Date.parse(nextOrderAt) - Date.parse(startsAt)) / DAY_MS;
  if (gapDays < 1) return 2;
  return gapDays >= 27 && gapDays <= 32 ? 1 : undefined;
}

interface Created {
  carts: string[];
  orders: string[];
  customers: string[];
}

class Spike {
  readonly created: Created = { carts: [], orders: [], customers: [] };
  readonly stamp = String(Date.now());
  customerId = '';
  readonly policyIdByKey = new Map<string, string>();
  constructor(readonly http: Http) {}

  keyOf = (id: string): string => [...this.policyIdByKey.entries()].find(([, value]) => value === id)?.[0] ?? (id ? `unknown:${id.slice(0, 8)}` : 'none');

  getCart(id: string): Promise<Rec> {
    return this.http.api('GET', `carts/${id}`);
  }

  async updateCart(id: string, actions: Rec[]): Promise<Rec> {
    const cart = await this.getCart(id);
    return this.http.api('POST', `carts/${id}`, { version: cart.version, actions });
  }

  async createCart(suffix: string): Promise<Rec> {
    const cart = await this.http.api('POST', 'carts', {
      key: `spike-device-${this.stamp}-${suffix}`,
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
        const order = await this.http.api('GET', `orders/${id}`);
        await this.http.api('DELETE', `orders/${id}?version=${String(order.version)}`);
      });
    }
    for (const id of [...this.created.carts, ...recurringCartIds]) {
      await attempt(`cart ${id}`, async () => {
        const cart = await this.getCart(id);
        await this.http.api('DELETE', `carts/${id}?version=${String(cart.version)}`);
      });
    }
    for (const id of this.created.customers) {
      await attempt(`customer ${id}`, async () => {
        const customer = await this.http.api('GET', `customers/${id}`);
        await this.http.api('DELETE', `customers/${id}?version=${String(customer.version)}`);
      });
    }
    return left;
  }
}

async function variantOf(http: Http, productKey: string, pick: (variant: Rec) => boolean): Promise<Rec> {
  const projection = await http.api('GET', `product-projections/key=${productKey}?priceCurrency=USD&priceCountry=US`).catch((err: unknown) => {
    if (err instanceof SpikeHttpError && err.status === 404) throw new Error(`Product ${productKey} not found: run seed (G) first`);
    throw err;
  });
  const found = [rec(projection.masterVariant), ...arr(projection.variants)].find(pick);
  if (!found) throw new Error(`No matching variant on ${productKey}: run seed (G) first`);
  return found;
}

const centsOf = (line: Rec): string => String(rec(rec(line.price).value).centAmount);
const policyOfPrice = (line: Rec): string => str(rec(rec(line.price).recurrencePolicy).id);

async function pollRecurringOrders(http: Http, orderId: string): Promise<Rec[]> {
  for (let i = 0; i < 20; i += 1) {
    const list = await http.api('GET', `recurring-orders?where=${encodeURIComponent(`originOrder(id="${orderId}")`)}&expand=cart&limit=20`);
    if (arr(list.results).length > 0) return arr(list.results);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return [];
}

export interface SpikeOutput {
  results: ProbeResult[];
  facts: { recurringOrders: RecurringOrderFacts[]; orderCreatedAt?: string; firstGeneratedPaymentNumber?: 1 | 2 };
  leftovers: string[];
}

export async function runSpike(http: Http, opts: { keep: boolean }): Promise<SpikeOutput> {
  const s = new Spike(http);
  const results: ProbeResult[] = [];
  const facts: SpikeOutput['facts'] = { recurringOrders: [] };
  let leftovers: string[] = [];
  try {
    results.push(
      await runProbe('Q0', 'The five policies exist, each a 1-month standard schedule', async () => {
        const bad: string[] = [];
        for (const key of POLICY_KEYS) {
          const policy = await http.api('GET', `recurrence-policies/key=${key}`).catch(() => undefined);
          if (!policy) {
            bad.push(`${key} missing`);
            continue;
          }
          s.policyIdByKey.set(key, str(policy.id));
          const schedule = rec(policy.schedule);
          if (!(schedule.type === 'standard' && schedule.value === 1 && schedule.intervalUnit === 'Months')) bad.push(`${key} schedule`);
        }
        return bad.length === 0 ? { status: 'PASS', evidence: `${POLICY_KEYS.length} policies, Months/1` } : { status: 'FAIL', evidence: bad.join('; ') };
      }),
    );

    const customer = await http.api('POST', 'customers', {
      key: `spike-device-${s.stamp}`,
      email: `spike-device-${s.stamp}@example.com`,
      password: `Sp-${randomBytes(9).toString('hex')}!`,
      isEmailVerified: true,
    });
    s.customerId = str(rec(customer.customer).id);
    s.created.customers.push(s.customerId);

    const pro256 = await variantOf(http, 'malva-offer-phone-nova-pro', (v) => str(v.sku) === 'MLV-DEV-NOVAPRO-BLK-256');
    const pro512 = await variantOf(http, 'malva-offer-phone-nova-pro', (v) => str(v.sku) === 'MLV-DEV-NOVAPRO-BLK-512');
    const hole = await variantOf(http, 'malva-offer-phone-nova-5g', (v) => str(v.sku) === 'MLV-DEV-NOVA5G-SLV-256');
    const plan = await variantOf(http, 'malva-offer-cable-500', (v) => arr(v.attributes).some((a) => a.name === 'contract-term' && rec(a.value).key === '24-months'));
    const proKey = 'malva-offer-phone-nova-pro';

    // Q1 (a), Q2 (f): a financed line takes the policy and Fixed; its resolved price carries that policy; the outright line none
    let main: Rec | undefined;
    results.push(
      await runProbe('Q1', '(a) addLineItem with a device policy and priceSelectionMode Fixed is accepted; (f) the resolved price carries that policy', async () => {
        const cart = await s.createCart('main');
        main = await s.updateCart(str(cart.id), [
          { action: 'addLineItem', sku: str(plan.sku), quantity: 1, recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', key: MONTHLY }, priceSelectionMode: 'Fixed' } },
          deviceLineAction(str(pro256.sku), 'installments', 24, proKey),
          deviceLineAction(str(pro512.sku), 'outright', 0, proKey),
        ]);
        const lines = arr(main.lineItems);
        const financed = lines.find((line) => str(rec(line.variant).sku) === str(pro256.sku));
        const outright = lines.find((line) => str(rec(line.variant).sku) === str(pro512.sku));
        const ok = financed && outright && policyOfPrice(financed) === s.policyIdByKey.get(INSTALLMENT_24) && policyOfPrice(outright) === '' && !outright.recurrenceInfo;
        return {
          status: ok ? 'PASS' : 'FAIL',
          evidence: `financed price ${financed ? centsOf(financed) : '?'} policy ${financed ? s.keyOf(policyOfPrice(financed)) : '?'} mode ${str(rec(financed?.recurrenceInfo).priceSelectionMode)}; outright price ${outright ? centsOf(outright) : '?'} policy ${outright ? s.keyOf(policyOfPrice(outright)) : '?'} recurrenceInfo ${outright?.recurrenceInfo ? 'present' : 'absent'}`,
        };
      }),
    );

    // Q3 (e): two lines of the same SKU in different modes stay separate lines
    results.push(
      await runProbe('Q3', '(e) the same SKU in different modes (outright, installments 24, lease 24) stays separate lines', async () => {
        const cart = await s.createCart('modes');
        const updated = await s.updateCart(str(cart.id), [
          deviceLineAction(str(pro256.sku), 'outright', 0, proKey),
          deviceLineAction(str(pro256.sku), 'installments', 24, proKey),
          deviceLineAction(str(pro256.sku), 'lease', 24, proKey),
          deviceLineAction(str(pro256.sku), 'installments', 24, proKey),
        ]);
        const lines = arr(updated.lineItems);
        const summary = lines.map((line) => `${str(rec(rec(line.custom).fields).acquisitionMode)}x${String(line.quantity)}@${centsOf(line)}`).join(', ');
        const ok = lines.length === 3 && lines.find((line) => rec(rec(line.custom).fields).acquisitionMode === 'installments')?.quantity === 2;
        return { status: ok ? 'PASS' : 'FAIL', evidence: `${lines.length} lines: ${summary} (a second identical financed add merges into quantity 2)` };
      }),
    );

    // Q4 (g): the hole resolves to the one-time price without an error
    results.push(
      await runProbe('Q4', '(g) a financed line without a price for its term (Nova 5G 256 Silver, 36 months) resolves to the one-time price with no error', async () => {
        const cart = await s.createCart('hole');
        const updated = await s.updateCart(str(cart.id), [deviceLineAction(str(hole.sku), 'installments', 36, 'malva-offer-phone-nova-5g')]);
        const line = arr(updated.lineItems)[0] ?? {};
        const fellBack = policyOfPrice(line) === '' && centsOf(line) === '82800';
        return {
          status: fellBack ? 'PASS' : 'FAIL',
          evidence: `accepted (200); resolved price ${centsOf(line)} with policy ${s.keyOf(policyOfPrice(line))}; recurrenceInfo ${line.recurrenceInfo ? 'present' : 'absent'}; policy of the term: ${INSTALLMENT_36}`,
        };
      }),
    );

    // Q5, Q6, Q7: order the main cart, find the recurring orders, set the expiry
    let orderId = '';
    results.push(
      await runProbe('Q5', 'Order from the cart with a malva-monthly plan line, an installments line and an outright line', async () => {
        if (!main) return { status: 'UNKNOWN', evidence: 'Q1 cart missing' };
        const order = await http.api('POST', 'orders', { cart: { typeId: 'cart', id: str(main.id) }, version: main.version, orderNumber: `spike-device-${s.stamp}` });
        orderId = str(order.id);
        s.created.orders.push(orderId);
        facts.orderCreatedAt = str(order.createdAt);
        return { status: 'PASS', evidence: `201, created ${str(order.createdAt)}` };
      }),
    );
    let recurringOrders: Rec[] = [];
    results.push(
      await runProbe('Q6', '(b) number of Recurring Orders and their schedule; (c) startsAt and nextOrderAt against the order date', async () => {
        if (!orderId) return { status: 'UNKNOWN', evidence: 'no order' };
        recurringOrders = await pollRecurringOrders(http, orderId);
        facts.recurringOrders = recurringOrders.map((ro) => describeRecurringOrder(ro, s.keyOf));
        const first = facts.recurringOrders[0];
        facts.firstGeneratedPaymentNumber = first ? firstGeneratedPaymentNumber(first.startsAt, first.nextOrderAt) : undefined;
        const parts = facts.recurringOrders.map((ro) => `[${ro.state}; ${ro.schedule}; startsAt ${ro.startsAt}; nextOrderAt ${ro.nextOrderAt ?? 'none'}; skus ${ro.skus.join('+')}; policies ${ro.policyKeys.join('+')}]`);
        return { status: recurringOrders.length === 2 ? 'PASS' : 'FAIL', evidence: `${recurringOrders.length} recurring order(s) (expected 2: plan and device): ${parts.join(' ')}` };
      }),
    );
    results.push(
      await runProbe('Q7', '(d) setExpiresAt is accepted on the device Recurring Order and the plan Recurring Order is left alone', async () => {
        const device = facts.recurringOrders.find((ro) => ro.policyKeys.includes(INSTALLMENT_24));
        if (!device) return { status: 'UNKNOWN', evidence: 'no device recurring order (see Q6)' };
        const startsAt = new Date(device.startsAt);
        const expiresAt = computeRecurringExpiry(startsAt, 24);
        const current = await http.api('GET', `recurring-orders/${device.id}`);
        const updated = await http.api('POST', `recurring-orders/${device.id}`, { version: current.version, actions: [{ action: 'setExpiresAt', expiresAt: expiresAt.toISOString() }] });
        const others = facts.recurringOrders.filter((ro) => ro.id !== device.id);
        return {
          status: str(updated.expiresAt) !== '' ? 'PASS' : 'FAIL',
          evidence: `accepted; expiresAt ${str(updated.expiresAt)} (startsAt ${device.startsAt} + 23 months + 7 days); other recurring orders: ${others.length} with expiresAt ${others.map((ro) => ro.expiresAt ?? 'unset').join(',') || 'n/a'}`,
        };
      }),
    );
    // Q8: a cart with device lines only yields a Recurring Order that holds nothing but the device lines, so the expiry is safe there
    let deviceOrderId = '';
    results.push(
      await runProbe('Q8', 'A cart with only device lines (installments 24 and lease 24) gives one Recurring Order with only those lines, and setExpiresAt is accepted on it', async () => {
        const cart = await s.createCart('device-only');
        const updated = await s.updateCart(str(cart.id), [deviceLineAction(str(pro256.sku), 'installments', 24, proKey), deviceLineAction(str(pro512.sku), 'lease', 24, proKey)]);
        const order = await http.api('POST', 'orders', { cart: { typeId: 'cart', id: str(updated.id) }, version: updated.version, orderNumber: `spike-device-${s.stamp}-dev` });
        deviceOrderId = str(order.id);
        s.created.orders.push(deviceOrderId);
        const list = (await pollRecurringOrders(http, deviceOrderId)).map((ro) => describeRecurringOrder(ro, s.keyOf));
        const only = list[0];
        if (!only) return { status: 'FAIL', evidence: 'no recurring order appeared within 20 s' };
        const current = await http.api('GET', `recurring-orders/${only.id}`);
        const expiresAt = computeRecurringExpiry(new Date(only.startsAt), 24);
        const done = await http.api('POST', `recurring-orders/${only.id}`, { version: current.version, actions: [{ action: 'setExpiresAt', expiresAt: expiresAt.toISOString() }] });
        const ok = list.length === 1 && only.policyKeys.every((key) => key.startsWith('malva-device-')) && str(done.expiresAt) !== '';
        return { status: ok ? 'PASS' : 'FAIL', evidence: `${list.length} recurring order(s): skus ${only.skus.join('+')}; policies ${only.policyKeys.join('+')}; expiresAt ${str(done.expiresAt)}; state ${str(done.recurringOrderState)}` };
      }),
    );
  } finally {
    if (!opts.keep) leftovers = await s.cleanup();
  }
  return { results, facts, leftovers };
}

/** The markdown block recorded in the report. */
export function renderSpike(output: SpikeOutput, nowIso: string): string {
  const rows = output.results.map((r) => `| ${r.id} | ${r.title.replace(/\|/g, '/')} | ${r.status} | ${r.evidence.replace(/\|/g, '/').replace(/\s+/g, ' ')} |`);
  return [
    `## Q - Device recurrence spike - run ${nowIso}`,
    `FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER measured: ${output.facts.firstGeneratedPaymentNumber ?? 'could not be derived'}`,
    '',
    '| Probe | Title | Status | Evidence |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    `Leftovers: ${output.leftovers.length > 0 ? output.leftovers.join('; ') : 'none'}`,
  ].join('\n');
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // the process environment alone is used
  }
  const env: SpikeEnv = readSpikeEnv(process.env);
  const output = await runSpike(createHttp(env), { keep: process.argv.includes('--keep') });
  console.log(renderSpike(output, new Date().toISOString()));
  if (output.leftovers.length > 0) {
    console.error(`${output.leftovers.length} spike resource(s) could not be deleted`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && /device-recurrence\.ts$/.test(process.argv[1])) {
  main().catch((err: unknown) => {
    console.error(formatError(err));
    process.exitCode = 1;
  });
}

import { describe, expect, it } from 'vitest';
import { buildManifest } from '../../manifest';
import { main } from '../../seed';
import { FakeCt } from '../../test/fake-ct';
import { main as verify } from '../../verify';
import { demoCustomers } from './customers';
import { addDays, addMonths, demoOrders, scheduleFor } from './orders';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom', SEED_DEMO_PASSWORD: 'Demo-Only-Password-1!' };
const ARGS = ['--confirm-project', 'spec-test-b2c-telecom', '--with-demo', '--no-wait'];

function baseline(): FakeCt {
  const api = new FakeCt();
  api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
  api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }, { country: 'GB' }] });
  return api;
}

async function seed(api: FakeCt, source: Record<string, string | undefined> = SOURCE, argv = ARGS) {
  const lines: string[] = [];
  const code = await main(argv, { api, source, manifest: buildManifest({ withDemo: true }), log: (l) => lines.push(l) });
  return { code, out: lines.join('\n') };
}

type Line = { id: string; variant: { sku: string }; custom?: { fields: { offerKey?: string; parentLineItemId?: string } } };

describe('demo data', () => {
  it('customers are created with their group, the account number and the marker', async () => {
    const api = baseline();
    const { code } = await seed(api);
    expect(code).toBe(0);
    expect(api.list('customers')).toHaveLength(5);
    const groups = api.list('customer-groups');
    for (const wanted of demoCustomers) {
      const customer = api.byKey('customers', wanted.key) as unknown as { email: string; isEmailVerified: boolean; customerGroup: { id: string }; custom: { fields: Record<string, unknown> }; password?: string };
      expect(customer.email).toBe(wanted.email);
      expect(customer.isEmailVerified).toBe(true);
      expect(groups.find((g) => g.id === customer.customerGroup.id)?.key).toBe(wanted.customerGroup);
      expect(customer.custom.fields).toEqual({ accountNumber: wanted.accountNumber, creditApproved: wanted.creditApproved, demoMarker: 'malva-demo' });
    }
    // Sam exercises the stub decline, everyone else is approved
    expect(demoCustomers.filter((c) => !c.creditApproved).map((c) => c.key)).toEqual(['malva-demo-sam-carter']);
  });

  it('orders are created for their customers with the service start date and the marker, and a recurring order follows', async () => {
    const api = baseline();
    await seed(api);
    expect(api.list('orders').map((o) => o.orderNumber)).toEqual(['MLV-DEMO-0001', 'MLV-DEMO-0002', 'MLV-DEMO-0003']);
    const alex = api.byKey('customers', 'malva-demo-alex-rivera');
    const first = api.list('orders')[0] as unknown as { customerId: string; orderState: string; custom: { fields: Record<string, unknown> } };
    expect(first.customerId).toBe(alex?.id);
    expect(first.orderState).toBe('Confirmed');
    expect(first.custom.fields.serviceStartDate).toBe('2026-03-12');
    expect(first.custom.fields.demoMarker).toBe('malva-demo');
    expect(JSON.parse(String(first.custom.fields.priceSchedule)).schedules[0]).toMatchObject({ sku: 'MLV-CBL-500-24M', termMonths: 24, priceMode: 'Fixed' });
    expect(api.list('recurring-orders')).toHaveLength(3);
  });

  it('the add-on line carries the parent link to the plan line', async () => {
    const api = baseline();
    await seed(api);
    const order = api.list('orders').find((o) => o.orderNumber === 'MLV-DEMO-0002') as unknown as { lineItems: Line[] };
    const plan = order.lineItems.find((l) => l.variant.sku === 'MLV-PHN-UNL-M2M');
    const addon = order.lineItems.find((l) => l.variant.sku === 'MLV-ADD-SPOTIFY-MTH');
    expect(plan?.custom?.fields.offerKey).toBe('malva-offer-phone-unlimited');
    expect(addon?.custom?.fields.parentLineItemId).toBe(plan?.id);
    expect(addon?.custom?.fields.offerKey).toBe('malva-offer-spotify');
  });

  it('orders are unchanged on the second run: nothing is written', async () => {
    const api = baseline();
    await seed(api);
    api.log.length = 0;
    const { code, out } = await seed(api);
    expect(code).toBe(0);
    expect(api.log).toEqual([]);
    expect(out).toMatch(/unchanged\s+demoOrder malva-demo-order-0001/);
    expect(api.list('orders')).toHaveLength(3);
  });

  it('a changed customer group is corrected on the next run (customers are reconciled, orders are not)', async () => {
    const api = baseline();
    await seed(api);
    const jo = api.byKey('customers', 'malva-demo-jo-kim');
    if (!jo) throw new Error('jo');
    jo.customerGroup = api.byKey('customer-groups', 'employee')?.id ? { typeId: 'customer-group', id: api.byKey('customer-groups', 'employee')?.id } : jo.customerGroup;
    api.log.length = 0;
    await seed(api);
    expect(api.log).toEqual(['update customers malva-demo-jo-kim setCustomerGroup']);
  });

  it('missing SEED_DEMO_PASSWORD exits 3 and writes nothing', async () => {
    const api = baseline();
    const { code, out } = await seed(api, { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' });
    expect(code).toBe(3);
    expect(out).toContain('SEED_DEMO_PASSWORD');
    expect(api.writes).toBe(0);
  });

  it('without --with-demo no customer or order is seeded', async () => {
    const api = baseline();
    await main(['--confirm-project', 'spec-test-b2c-telecom', '--no-wait'], { api, source: { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' }, manifest: buildManifest(), log: () => undefined });
    expect(api.list('customers')).toHaveLength(0);
    expect(api.list('orders')).toHaveLength(0);
  });

  it('seed:verify checks the demo data once it is seeded', async () => {
    const api = baseline();
    await seed(api);
    api.indexedKeys = (buildManifest().product ?? []).map((p) => p.key);
    const lines: string[] = [];
    await verify([], { api, source: SOURCE, log: (l) => lines.push(l) });
    const demoLine = lines.find((l) => l.includes('demo data')) ?? '';
    expect(demoLine).toMatch(/^PASS/);
    expect(demoLine).not.toContain('not seeded');
  });

  it('price schedules follow the L format and the dates add up', () => {
    expect(addMonths('2026-03-07', 24)).toBe('2028-03-07');
    expect(addDays('2028-03-07', -1)).toBe('2028-03-06');
    const cable = scheduleFor({ offerKey: 'malva-offer-cable-500', sku: 'MLV-CBL-500-24M', term: '24M', monthlyCents: 5999, afterTermCents: 6999, orderDate: '2026-03-07', priceMode: 'Fixed' }) as {
      periods: { endsOn: string }[];
      totalContractValue: { centAmount: number };
      afterTerm: { startsOn: string; monthlyAmount: { centAmount: number } };
    };
    expect(cable.periods[0].endsOn).toBe('2028-03-06');
    expect(cable.totalContractValue.centAmount).toBe(143976);
    expect(cable.afterTerm).toMatchObject({ startsOn: '2028-03-07', monthlyAmount: { centAmount: 6999 } });
    const open = scheduleFor({ offerKey: 'malva-offer-phone-unlimited', sku: 'MLV-PHN-UNL-M2M', term: 'M2M', monthlyCents: 5000, orderDate: '2025-06-03', priceMode: 'Dynamic' }) as { openEnded: boolean; totalContractValue: unknown; afterTerm: unknown };
    expect(open).toMatchObject({ openEnded: true, totalContractValue: null, afterTerm: null });
    expect(demoOrders.map((o) => o.orderNumber)).toEqual(['MLV-DEMO-0001', 'MLV-DEMO-0002', 'MLV-DEMO-0003']);
    expect(demoOrders.map((o) => o.serviceStartDate)).toEqual(['2026-03-12', '2025-06-03', '2026-05-20']);
  });
});

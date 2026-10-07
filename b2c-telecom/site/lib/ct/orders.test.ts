import { orderA, ctOrder } from '@/test/fixtures/orders';

const state = vi.hoisted(() => ({ list: vi.fn(), byNumber: vi.fn(), recurring: vi.fn() }));

vi.mock('./client', () => ({
  getApiRoot: () => ({
    orders: () => ({
      get: (args: unknown) => ({ execute: () => state.list(args) }),
      withOrderNumber: (args: unknown) => ({ get: () => ({ execute: () => state.byNumber(args) }) }),
    }),
    recurringOrders: () => ({ get: (args: unknown) => ({ execute: () => state.recurring(args) }) }),
  }),
}));

import { getCustomerOrders, getOrderForCustomer, getRecurringSummaries, ordersWhere } from './orders';

beforeEach(() => vi.clearAllMocks());

const queryArgs = (): Record<string, unknown> => (state.list.mock.calls[0]?.[0] as { queryArgs: Record<string, unknown> }).queryArgs;

describe('getCustomerOrders', () => {
  beforeEach(() => state.list.mockResolvedValue({ body: { results: [orderA()], total: 12 } }));

  it('filters by the customer, drops generated recurring orders, sorts newest first and asks for the total', async () => {
    const { orders, total } = await getCustomerOrders('cust-alex', 'en-US');
    expect(queryArgs()).toEqual({ where: 'customerId="cust-alex" and recurringOrder is not defined', sort: 'createdAt desc', limit: 10, offset: 0, withTotal: true });
    expect(total).toBe(12);
    expect(orders[0]?.orderNumber).toBe('QA-AAAA01');
  });

  it('page 2 starts at offset 10', async () => {
    await getCustomerOrders('cust-alex', 'en-US', { page: 2 });
    expect(queryArgs().offset).toBe(10);
  });

  it('an invalid page reads as page 1', async () => {
    await getCustomerOrders('cust-alex', 'en-US', { page: -4 });
    expect(queryArgs().offset).toBe(0);
  });

  it.each([
    ['open', 'orderState in ("Open","Confirmed")'],
    ['completed', 'orderState = "Complete"'],
    ['cancelled', 'orderState = "Cancelled"'],
  ] as const)('the %s filter adds its predicate', async (status, predicate) => {
    await getCustomerOrders('cust-alex', 'en-US', { status });
    expect(queryArgs().where).toBe(`customerId="cust-alex" and recurringOrder is not defined and ${predicate}`);
  });

  it('strips quotes from the id so it cannot break out of the predicate', () => {
    expect(ordersWhere('a"b\\c')).toBe('customerId="abc" and recurringOrder is not defined');
  });
});

describe('getOrderForCustomer', () => {
  it('returns the order of the customer', async () => {
    state.byNumber.mockResolvedValue({ body: orderA() });
    expect((await getOrderForCustomer('QA-AAAA01', 'cust-alex', 'en-US'))?.orderNumber).toBe('QA-AAAA01');
    expect(state.byNumber).toHaveBeenCalledWith({ orderNumber: 'QA-AAAA01' });
  });

  it("another customer's order is null", async () => {
    state.byNumber.mockResolvedValue({ body: orderA({ customerId: 'cust-other' }) });
    expect(await getOrderForCustomer('QA-AAAA01', 'cust-alex', 'en-US')).toBeNull();
  });

  it('a guest order (no customer id) is null', async () => {
    state.byNumber.mockResolvedValue({ body: ctOrder({ orderNumber: 'G1', total: 0, lines: [], customerId: null }) });
    expect(await getOrderForCustomer('G1', 'cust-alex', 'en-US')).toBeNull();
  });

  it('an unknown number (404) is null; other errors surface', async () => {
    state.byNumber.mockRejectedValueOnce({ statusCode: 404 });
    expect(await getOrderForCustomer('NOPE', 'cust-alex', 'en-US')).toBeNull();
    state.byNumber.mockRejectedValueOnce({ statusCode: 500 });
    await expect(getOrderForCustomer('NOPE', 'cust-alex', 'en-US')).rejects.toEqual({ statusCode: 500 });
  });
});

describe('getRecurringSummaries', () => {
  it('maps the summary fields and queries by customer', async () => {
    state.recurring.mockResolvedValue({
      body: { results: [{ id: 'r1', originOrder: { id: 'o1' }, recurringOrderState: 'Active', nextOrderAt: '2026-11-07T00:00:00Z' }, { id: 'r2', originOrder: { id: 'o2' }, recurringOrderState: 'Expired', expiresAt: '2026-01-01T00:00:00Z' }] },
    });
    expect(await getRecurringSummaries('cust-alex')).toEqual([
      { id: 'r1', originOrderId: 'o1', state: 'Active', nextOrderAt: '2026-11-07T00:00:00Z' },
      { id: 'r2', originOrderId: 'o2', state: 'Expired', expiresAt: '2026-01-01T00:00:00Z' },
    ]);
    expect((state.recurring.mock.calls[0]?.[0] as { queryArgs: { where: string } }).queryArgs.where).toBe('customer(id="cust-alex")');
  });
});

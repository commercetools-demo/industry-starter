import 'server-only';
// Test helper (workstream S): an in-memory stand-in for `adminRoot` that records every call. Never used by app code.
//   vi.mock('@/lib/ct/admin-client', async () => ({ adminRoot: (await import('./sdk-mock')).adminMock.adminRoot }));
export interface RecordedCall {
  /** `orders`, `recurringOrders`, `reviews`, `inventory`, `stores`, `productProjections`. */
  resource: string;
  /** `in-store` for the store-scoped endpoints, `project` for project-level ones, `store` for `stores().withKey`. */
  scope: 'in-store' | 'project' | 'store';
  storeKey?: string;
  queryArgs: Record<string, unknown>;
}

type Responder = (call: RecordedCall) => unknown;

const state = {
  calls: [] as RecordedCall[],
  responders: {} as Record<string, Responder>,
};

function endpoint(resource: string, scope: RecordedCall['scope'], storeKey?: string) {
  return {
    get: (arg: { queryArgs?: Record<string, unknown> } = {}) => ({
      execute: async () => {
        const call: RecordedCall = { resource, scope, storeKey, queryArgs: arg.queryArgs ?? {} };
        state.calls.push(call);
        const responder = state.responders[resource];
        const body = responder ? responder(call) : { results: [], total: 0, count: 0 };
        if (body instanceof Error) throw body;
        return { body };
      },
    }),
  };
}

export const adminMock = {
  adminRoot: {
    inStoreKeyWithStoreKeyValue: ({ storeKey }: { storeKey: string }) => ({
      orders: () => endpoint('orders', 'in-store', storeKey),
    }),
    orders: () => endpoint('orders', 'project'),
    recurringOrders: () => endpoint('recurringOrders', 'project'),
    reviews: () => endpoint('reviews', 'project'),
    inventory: () => endpoint('inventory', 'project'),
    productProjections: () => endpoint('productProjections', 'project'),
    stores: () => ({ withKey: ({ key }: { key: string }) => endpoint('stores', 'store', key) }),
  },
  get calls() {
    return state.calls;
  },
  callsTo: (resource: string) => state.calls.filter((c) => c.resource === resource),
  /** Answer for a resource: a body, a function of the recorded call, or an Error to throw. */
  respond(resource: string, answer: unknown | Responder) {
    state.responders[resource] = typeof answer === 'function' ? (answer as Responder) : () => answer;
  },
  reset() {
    state.calls = [];
    state.responders = {};
  },
};

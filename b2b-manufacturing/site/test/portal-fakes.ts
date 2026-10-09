import { roleDrafts } from '../../seed/src/data/roles';

/** In-memory Business Unit, roles and customers that behave like the parts of commercetools the sites and team modules use. */
export interface FakeAddress { id: string; key?: string; company?: string; streetName?: string; city?: string; postalCode?: string; country: string; phone?: string; additionalAddressInfo?: string }
interface FakeAssociate { customerId: string; roleKeys: string[] }
export interface FakeCustomer { id: string; version: number; email: string; firstName?: string; lastName?: string; custom?: { fields: Record<string, unknown> } }

export function createFake(opts: { addresses?: FakeAddress[]; defaultId?: string; associates: FakeAssociate[]; customers: FakeCustomer[]; conflicts?: number }) {
  const state = {
    version: 1, addresses: [...(opts.addresses ?? [])], defaultId: opts.defaultId, associates: opts.associates.map((a) => ({ ...a, roleKeys: [...a.roleKeys] })),
    customers: new Map(opts.customers.map((c) => [c.id, c])), posts: [] as unknown[], conflicts: opts.conflicts ?? 0, deleted: [] as string[], created: [] as unknown[],
  };
  let seq = 0;
  const view = () => ({
    key: 'co', version: state.version, addresses: state.addresses, defaultShippingAddressId: state.defaultId,
    associates: state.associates.map((a) => ({
      customer: { typeId: 'customer', id: a.customerId, obj: state.customers.get(a.customerId) },
      associateRoleAssignments: a.roleKeys.map((k) => ({ associateRole: { typeId: 'associate-role', key: k } })),
    })),
  });
  const roleKeyOf = (assignments: Array<{ associateRole: { key: string } }>) => assignments.map((r) => r.associateRole.key);
  function apply(action: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
    switch (action.action) {
      case 'addAddress': state.addresses.push({ ...action.address, id: `gen-${(seq += 1)}` }); break;
      case 'changeAddress': state.addresses = state.addresses.map((a) => (a.key === action.addressKey ? { ...action.address, id: a.id } : a)); break;
      case 'removeAddress': state.addresses = state.addresses.filter((a) => a.key !== action.addressKey); break;
      case 'setDefaultShippingAddress': state.defaultId = state.addresses.find((a) => a.key === action.addressKey)?.id; break;
      case 'addAssociate': state.associates.push({ customerId: action.associate.customer.id, roleKeys: roleKeyOf(action.associate.associateRoleAssignments) }); break;
      case 'changeAssociate': state.associates = state.associates.map((a) => (a.customerId === action.associate.customer.id ? { ...a, roleKeys: roleKeyOf(action.associate.associateRoleAssignments) } : a)); break;
      case 'removeAssociate': state.associates = state.associates.filter((a) => a.customerId !== action.customer.id); break;
      default: throw new Error(`unexpected action ${String(action.action)}`);
    }
  }
  const businessUnits = () => ({
    withKey: () => ({
      get: () => ({ execute: async () => ({ body: view() }) }),
      post: ({ body }: { body: { version: number; actions: unknown[] } }) => ({
        execute: async () => {
          if (state.conflicts > 0) { state.conflicts -= 1; throw Object.assign(new Error('conflict'), { statusCode: 409 }); }
          if (body.version !== state.version) throw Object.assign(new Error('conflict'), { statusCode: 409 });
          state.posts.push(body);
          body.actions.forEach((a) => apply(a as Record<string, unknown>));
          state.version += 1;
          return { body: view() };
        },
      }),
    }),
  });
  const root = {
    businessUnits,
    associateRoles: () => ({ get: () => ({ execute: async () => ({ body: { results: roleDrafts.map((r) => ({ key: r.key, permissions: r.permissions })) } }) }) }),
    customers: () => ({
      post: ({ body }: { body: Record<string, unknown> & { email: string } }) => ({
        execute: async () => {
          if ([...state.customers.values()].some((c) => c.email === body.email)) throw { statusCode: 400, body: { errors: [{ code: 'DuplicateField' }] } };
          const customer: FakeCustomer = { id: `new-${(seq += 1)}`, version: 1, email: body.email, firstName: body.firstName as string, lastName: body.lastName as string, custom: body.custom as FakeCustomer['custom'] };
          state.customers.set(customer.id, customer); state.created.push(body);
          return { body: { customer } };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({ delete: () => ({ execute: async () => { state.customers.delete(ID); state.deleted.push(ID); return { body: {} }; } }) }),
    }),
  };
  return { state, root };
}

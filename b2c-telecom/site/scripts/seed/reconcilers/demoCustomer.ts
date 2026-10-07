// Demo customers (only with --with-demo): the people the demo orders belong to. Every record carries demoMarker.
import { DEMO_MARKER_VALUE } from '../../../lib/config/demo';
import { COLLECTION, asReconciler, type DemoCustomerDraft } from '../types';
import { field, getByKey, postUpdate, removeByKey, type Obj, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.demoCustomer;

type ExistingCustomer = Versioned & {
  email?: string;
  firstName?: string;
  lastName?: string;
  customerGroup?: { id: string; obj?: Obj & { key?: string } };
  custom?: { fields?: Record<string, unknown> };
  addresses?: Obj[];
};

export function customFieldsOf(draft: DemoCustomerDraft): Record<string, unknown> {
  return { accountNumber: draft.accountNumber, creditApproved: draft.creditApproved, demoMarker: DEMO_MARKER_VALUE };
}

export function planDemoCustomer(existing: ExistingCustomer, draft: DemoCustomerDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  if (field(changes, 'firstName', existing.firstName, draft.firstName)) actions.push({ action: 'setFirstName', firstName: draft.firstName });
  if (field(changes, 'lastName', existing.lastName, draft.lastName)) actions.push({ action: 'setLastName', lastName: draft.lastName });
  if (field(changes, 'customerGroup', existing.customerGroup?.obj?.key, draft.customerGroup)) {
    actions.push({ action: 'setCustomerGroup', customerGroup: { typeId: 'customer-group', key: draft.customerGroup } });
  }
  const have = existing.custom?.fields ?? {};
  if (!existing.custom) {
    changes.push({ path: 'custom', from: undefined, to: 'malva-customer' });
    actions.push({ action: 'setCustomType', type: { typeId: 'type', key: 'malva-customer' }, fields: customFieldsOf(draft) });
  } else {
    for (const [name, value] of Object.entries(customFieldsOf(draft))) {
      if (field(changes, `custom.${name}`, have[name], value)) actions.push({ action: 'setCustomField', name, value });
    }
  }
  return { changes, actions };
}

export const demoCustomerReconciler = asReconciler<DemoCustomerDraft, ExistingCustomer>({
  kind: 'demoCustomer',
  order: 110,
  refs: (d) => [
    { kind: 'customerGroup', key: d.customerGroup, from: { kind: 'demoCustomer', key: d.key } },
    { kind: 'type', key: 'malva-customer', from: { kind: 'demoCustomer', key: d.key } },
  ],
  fetch: (api, key) => getByKey<ExistingCustomer>(api, COLL, key, { expand: 'customerGroup' }),
  create: async (api, draft, ctx) => {
    if (!ctx.demoPassword) throw new Error('SEED_DEMO_PASSWORD is not set');
    const { streetName, streetNumber, postalCode, city, state, country } = draft.address;
    await api.post(COLL, {
      key: draft.key,
      email: draft.email,
      password: ctx.demoPassword,
      firstName: draft.firstName,
      lastName: draft.lastName,
      isEmailVerified: true,
      customerGroup: { typeId: 'customer-group', key: draft.customerGroup },
      addresses: [{ key: `${draft.key}-home`, firstName: draft.firstName, lastName: draft.lastName, streetName, ...(streetNumber ? { streetNumber } : {}), postalCode, city, ...(state ? { state } : {}), country }],
      defaultShippingAddress: 0,
      defaultBillingAddress: 0,
      custom: { type: { typeId: 'type', key: 'malva-customer' }, fields: customFieldsOf(draft) },
    });
  },
  diff: (existing, draft) => ({ changes: planDemoCustomer(existing, draft).changes }),
  update: async (api, existing, _changes, draft) => postUpdate(api, COLL, existing, planDemoCustomer(existing, draft).actions),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});

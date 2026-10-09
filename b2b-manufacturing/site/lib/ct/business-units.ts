import 'server-only';
import type { BusinessUnit, Customer } from '@commercetools/platform-sdk';
import { apiRoot } from './client';
import { getDefaultStore, getStoreChannelData } from './stores';
import { setBusinessContext, setCustomer, type Session } from '../session-core';
import type { BusinessUnitSummary } from '../types';

export const ADMIN_ROLE_KEY = 'mpw-admin';

const quote = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const summarize = (unit: BusinessUnit): BusinessUnitSummary => ({
  key: unit.key,
  name: unit.name,
  unitType: unit.unitType,
  storeKeys: (unit.stores ?? []).map((s) => s.key).filter((k): k is string => Boolean(k)),
});

/** Project-level query (the as-associate chain needs a Business Unit first). */
export async function getBusinessUnitsForAssociate(customerId: string): Promise<BusinessUnitSummary[]> {
  const res = await apiRoot.businessUnits().get({ queryArgs: { where: `associates(customer(id="${quote(customerId)}"))`, sort: 'createdAt asc', limit: 50 } }).execute();
  return res.body.results.filter((u) => u.status === 'Active').map(summarize);
}

/** Store fields for a unit: its first store, otherwise the default store. */
export async function storeForUnit(unit: BusinessUnitSummary) {
  return unit.storeKeys[0] ? getStoreChannelData(unit.storeKeys[0]) : getDefaultStore();
}

/** Customer fields, first Business Unit and its store in one new session. Nothing is written until every lookup has succeeded. */
export async function signInSessionPatch(session: Session, customer: Pick<Customer, 'id' | 'email' | 'firstName' | 'lastName'>): Promise<Session> {
  const withCustomer = setCustomer(session, { customerId: customer.id, customerEmail: customer.email, customerFirstName: customer.firstName, customerLastName: customer.lastName });
  const [first] = await getBusinessUnitsForAssociate(customer.id);
  if (!first) return withCustomer;
  return setBusinessContext(withCustomer, { ...(await storeForUnit(first)), businessUnitKey: first.key });
}

/** Switch company: only a unit the customer belongs to (otherwise null); the whole business context is rewritten in one new session. */
export async function selectBusinessUnit(session: Session & { customerId: string }, businessUnitKey: string): Promise<Session | null> {
  const unit = (await getBusinessUnitsForAssociate(session.customerId)).find((u) => u.key === businessUnitKey);
  if (!unit) return null;
  return setBusinessContext(session, { ...(await storeForUnit(unit)), businessUnitKey: unit.key });
}

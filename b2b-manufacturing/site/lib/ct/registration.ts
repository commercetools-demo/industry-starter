import 'server-only';
import { randomBytes } from 'node:crypto';
import type { RegistrationInput } from '../validation';
import { apiRoot, provisioningRoot } from './client';
import { ADMIN_ROLE_KEY } from './business-units';

export type RegistrationResult =
  | { status: 'created'; customer: { id: string; email: string; firstName?: string; lastName?: string }; businessUnitKey: string }
  | { status: 'duplicate' };

export const slugify = (name: string): string => name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'company';
export const companyKey = (name: string): string => `mpw-${slugify(name)}-${randomBytes(2).toString('hex')}`;

const inFlight = new Map<string, Promise<RegistrationResult>>();

/**
 * Creates the customer (verified, no email sent), then the Company and its administrator association with the provisioning client.
 * If the Company step fails the customer is deleted so no half-created account remains. Concurrent calls for one email share one attempt.
 */
export function registerCompany(input: RegistrationInput, storeKey = process.env.CTP_DEFAULT_STORE_KEY ?? 'mpw-web'): Promise<RegistrationResult> {
  const running = inFlight.get(input.email);
  if (running) return running.then(() => ({ status: 'duplicate' as const }));
  const attempt = create(input, storeKey).finally(() => inFlight.delete(input.email));
  inFlight.set(input.email, attempt);
  return attempt;
}

async function create(input: RegistrationInput, storeKey: string): Promise<RegistrationResult> {
  let customer;
  try {
    customer = (await apiRoot.customers().post({
      body: {
        email: input.email, password: input.password, firstName: input.firstName, lastName: input.lastName, isEmailVerified: true,
        custom: { type: { typeId: 'type', key: 'mpw-customer' }, fields: { jobTitle: input.jobTitle, phone: input.phone } },
      },
    }).execute()).body.customer;
  } catch (error) {
    if (isDuplicate(error)) return { status: 'duplicate' };
    throw error;
  }
  const key = companyKey(input.companyName);
  try {
    await provisioningRoot.businessUnits().post({
      body: {
        unitType: 'Company', key, name: input.companyName, status: 'Active', contactEmail: input.email,
        storeMode: 'Explicit', stores: [{ typeId: 'store', key: storeKey }], associateMode: 'Explicit',
        associates: [{ customer: { typeId: 'customer', id: customer.id }, associateRoleAssignments: [{ associateRole: { typeId: 'associate-role', key: ADMIN_ROLE_KEY } }] }],
        custom: { type: { typeId: 'type', key: 'mpw-company' }, fields: { sector: input.sector } },
      },
    }).execute();
  } catch (error) {
    await compensate(customer.id, customer.version);
    throw error;
  }
  return { status: 'created', customer: { id: customer.id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName }, businessUnitKey: key };
}

async function compensate(id: string, version: number): Promise<void> {
  try {
    await apiRoot.customers().withId({ ID: id }).delete({ queryArgs: { version } }).execute();
  } catch {
    // The customer could not be removed; the original error is still reported and the account cannot sign in to a company.
    console.error('registration compensation failed');
  }
}

const isDuplicate = (error: unknown): boolean => {
  const body = (error as { body?: { errors?: Array<{ code?: string }> } }).body;
  return Boolean(body?.errors?.some((e) => e.code === 'DuplicateField'));
};

// Reseller registration against commercetools (R-07). The provisioning client lives only in this folder (lint fence).
// Order: customer (frontend client, email verified for this phase, Q-R02), then an inactive Company business unit with the
// customer as its first Admin. If the unit cannot be created the customer is deleted again (compensation), so no
// half-created account stays behind. A Malva operator activates the unit and assigns its store in the Merchant Center (OA-11).
import 'server-only';
import { randomBytes } from 'node:crypto';
import { apiRoot } from '@/lib/ct/client';
import { getProvisioningRoot } from '@/lib/ct/provisioning-client';
import { ROLE } from '@/lib/roles';

export interface RegistrationInput {
  companyName: string;
  name: string;
  email: string;
  password: string;
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'co';
}

const random4 = () => randomBytes(3).toString('hex').slice(0, 4);

const isDuplicate = (error: unknown) => {
  const e = error as { statusCode?: number; body?: { errors?: { code?: string }[] } } | null;
  return e?.statusCode === 400 && (e.body?.errors ?? []).some((x) => x.code === 'DuplicateField');
};

export async function registerReseller(input: RegistrationInput): Promise<'created' | 'duplicate'> {
  const [firstName, ...rest] = input.name.trim().split(/\s+/);
  let customer: { id: string; version: number };
  try {
    const { body } = await apiRoot
      .customers()
      .post({ body: { email: input.email, password: input.password, firstName, lastName: rest.join(' ') || undefined, isEmailVerified: true } })
      .execute();
    customer = body.customer;
  } catch (error) {
    if (isDuplicate(error)) return 'duplicate';
    throw error;
  }
  const provisioning = getProvisioningRoot();
  try {
    await provisioning
      .businessUnits()
      .post({
        body: {
          key: `rs-${slugify(input.companyName)}-${random4()}`,
          name: input.companyName,
          unitType: 'Company',
          status: 'Inactive',
          storeMode: 'Explicit',
          associates: [
            {
              customer: { typeId: 'customer', id: customer.id },
              associateRoleAssignments: [{ associateRole: { typeId: 'associate-role', key: ROLE.admin }, inheritance: 'Disabled' }],
            },
          ],
        },
      })
      .execute();
  } catch (error) {
    await provisioning.customers().withId({ ID: customer.id }).delete({ queryArgs: { version: customer.version } }).execute().catch(() => undefined);
    throw error;
  }
  return 'created';
}

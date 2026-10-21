import 'server-only';
import type { Customer, CustomerUpdateAction } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';
import { toAppCustomer } from '@/lib/mappers/customer';
import type { AccountProfile } from '@/lib/types';

const readCustomer = async (id: string): Promise<Customer> => (await apiRoot.customers().withId({ ID: id }).get().execute()).body;

/** Phone is not a Customer field: it belongs to the default shipping address (Profile edits that address). */
export function toProfile(c: Customer): AccountProfile {
  const app = toAppCustomer(c);
  const home = app.addresses.find((a) => a.id === c.defaultShippingAddressId) ?? null;
  return {
    firstName: c.firstName ?? '',
    lastName: c.lastName ?? '',
    email: c.email,
    phone: home?.phone ?? null,
    defaultShippingAddressId: c.defaultShippingAddressId ?? null,
  };
}

export const getProfile = async (customerId: string): Promise<AccountProfile> => toProfile(await readCustomer(customerId));

export interface ProfileChange {
  firstName?: string;
  lastName?: string;
  /** '' clears the number. Needs a default shipping address (after the change below, if both are given). */
  phone?: string;
  defaultShippingAddressId?: string;
}

/**
 * Names, the default shipping address and the phone in ONE update: `setFirstName`, `setLastName`, `setDefaultShippingAddress`
 * and `changeAddress` for the phone of the (new) default address. `changeEmail` is not offered (Q-L-04). Throws
 * `AppError('validation_failed', 422)` when a phone is given but no address exists, `not_found` for a foreign address id.
 */
export async function updateProfile(customerId: string, change: ProfileChange): Promise<AccountProfile> {
  const { customer } = await updateWithRetry(
    () => readCustomer(customerId),
    async (current) => {
      const actions: CustomerUpdateAction[] = [];
      if (change.firstName !== undefined && change.firstName !== (current.firstName ?? '')) actions.push({ action: 'setFirstName', firstName: change.firstName });
      if (change.lastName !== undefined && change.lastName !== (current.lastName ?? '')) actions.push({ action: 'setLastName', lastName: change.lastName });
      let defaultId = current.defaultShippingAddressId ?? null;
      if (change.defaultShippingAddressId !== undefined && change.defaultShippingAddressId !== defaultId) {
        if (!current.addresses.some((a) => a.id === change.defaultShippingAddressId)) throw new AppError('not_found', 404);
        actions.push({ action: 'setDefaultShippingAddress', addressId: change.defaultShippingAddressId });
        defaultId = change.defaultShippingAddressId;
      }
      if (change.phone !== undefined) {
        const target = current.addresses.find((a) => a.id === defaultId);
        if (!target) throw new AppError('validation_failed', 422);
        if ((target.phone ?? '') !== change.phone) {
          const { id: _id, ...rest } = target;
          void _id;
          const next = { ...rest, phone: change.phone || undefined };
          actions.push({ action: 'changeAddress', addressId: target.id as string, address: next });
        }
      }
      if (actions.length === 0) return { customer: current };
      const { body } = await apiRoot.customers().withId({ ID: customerId }).post({ body: { version: current.version, actions } }).execute();
      return { customer: body };
    },
  );
  return toProfile(customer);
}

/** Wrong current password: commercetools answers 400 `InvalidCurrentPassword`. */
export function isInvalidCurrentPassword(e: unknown): boolean {
  const err = e as { statusCode?: unknown; body?: { errors?: { code?: string }[] } } | null;
  return err?.statusCode === 400 && Boolean(err.body?.errors?.some((x) => x.code === 'InvalidCurrentPassword'));
}

/** Changes the password on the latest version. The caller checked the policy first. */
export async function changePassword(customerId: string, currentPassword: string, newPassword: string): Promise<void> {
  await updateWithRetry(
    () => readCustomer(customerId),
    async (current) =>
      apiRoot
        .customers()
        .password()
        .post({ body: { id: customerId, version: current.version, currentPassword, newPassword } })
        .execute(),
  );
}

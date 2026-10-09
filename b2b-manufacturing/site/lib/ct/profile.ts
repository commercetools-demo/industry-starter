import 'server-only';
import { apiRoot } from './client';

export interface ProfileInput { firstName: string; lastName: string; jobTitle: string; phone: string }

/** Updates name, job title and phone of the signed-in customer. */
export async function updateProfile(customerId: string, input: ProfileInput) {
  const current = (await apiRoot.customers().withId({ ID: customerId }).get().execute()).body;
  const { body } = await apiRoot.customers().withId({ ID: customerId }).post({
    body: {
      version: current.version,
      actions: [
        { action: 'setFirstName', firstName: input.firstName },
        { action: 'setLastName', lastName: input.lastName },
        { action: 'setCustomType', type: { typeId: 'type', key: 'mpw-customer' }, fields: { ...(current.custom?.fields ?? {}), jobTitle: input.jobTitle, phone: input.phone } },
      ],
    },
  }).execute();
  return { firstName: body.firstName, lastName: body.lastName };
}

/** Verifies the current password (the API does) and sets the new one. Returns false when the current password is wrong. */
export async function changePassword(customerId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const current = (await apiRoot.customers().withId({ ID: customerId }).get().execute()).body;
  try {
    await apiRoot.customers().password().post({ body: { id: customerId, version: current.version, currentPassword, newPassword } }).execute();
    return true;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 400) return false;
    throw error;
  }
}

export async function getProfile(customerId: string): Promise<ProfileInput> {
  const c = (await apiRoot.customers().withId({ ID: customerId }).get().execute()).body;
  const fields = (c.custom?.fields ?? {}) as { jobTitle?: string; phone?: string };
  return { firstName: c.firstName ?? '', lastName: c.lastName ?? '', jobTitle: fields.jobTitle ?? '', phone: fields.phone ?? '' };
}

import 'server-only';
import type { Overview, Section } from '@/lib/account-types';
import { toLabListItem } from '@/lib/ct/account-labs';
import { getBookingPatient } from '@/lib/ct/booking-patient';
import { listBookingsForPatient } from '@/lib/ct/bookings';
import { apiRoot } from '@/lib/ct/client';
import { labSource } from '@/lib/ct/clinical-store';
import { loadCheckoutFixtures } from '@/lib/ct/fixtures';

/** The signed-in customer no longer exists (deleted while the cookie lives on): treated as a signed-out session. */
export class AccountGoneError extends Error {
  constructor() {
    super('account gone');
    this.name = 'AccountGoneError';
  }
}

const UNSAFE_ID = /[^\w-]/g;

/** Number of the customer's orders (the overview tile; the list itself is workstream S). */
export async function countOrders(customerId: string): Promise<number> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.fixtureOrderList(customerId).length;
  const { body } = await apiRoot
    .orders()
    .get({ queryArgs: { where: `customerId="${customerId.replace(UNSAFE_ID, '')}"`, limit: 1, withTotal: true } })
    .execute();
  return body.total ?? body.count;
}

async function settle<T>(work: Promise<T>): Promise<Section<T>> {
  try {
    return { status: 'ok', data: await work };
  } catch {
    // The reason is not logged on purpose: it may echo a query. The section reports itself unavailable.
    return { status: 'error' };
  }
}

const RECENT_LABS = 3;

/**
 * Everything the overview shows, resolved per signed-in customer. The labs, appointments and orders reads run in
 * parallel and settle on their own (`Promise.allSettled` semantics): a failing one becomes `{ status: 'error' }`
 * while the others keep their data. Throws {@link AccountGoneError} when the customer does not exist.
 */
export async function getOverview(customerId: string, now: Date = new Date()): Promise<Overview> {
  const orders = settle(countOrders(customerId).then((count) => ({ count })));
  let patient;
  try {
    patient = await getBookingPatient(customerId);
  } catch {
    const failed = { status: 'error' } as const;
    return { user: failed, labs: failed, appointments: failed, orders: await orders };
  }
  if (!patient) {
    await orders;
    throw new AccountGoneError();
  }

  const ref = patient.patientRef;
  const labs = settle(
    (ref ? labSource.listForPatient(ref) : Promise.resolve([])).then((all) => ({
      ready: all.filter((l) => l.status === 'ready').length,
      latest: all.slice(0, RECENT_LABS).map(toLabListItem),
    })),
  );
  const appointments = settle(
    (ref ? listBookingsForPatient(ref) : Promise.resolve([])).then((all) => ({
      upcoming: all.filter((b) => b.status === 'booked' && Date.parse(b.startsAt) >= now.getTime()).length,
    })),
  );
  const [labsOut, appointmentsOut, ordersOut] = await Promise.all([labs, appointments, orders]);
  return {
    user: { status: 'ok', data: { ...(patient.firstName ? { firstName: patient.firstName } : {}), email: patient.email } },
    labs: labsOut,
    appointments: appointmentsOut,
    orders: ordersOut,
  };
}

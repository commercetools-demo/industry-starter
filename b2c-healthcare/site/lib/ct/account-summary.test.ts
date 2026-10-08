import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LabOrder } from '@/lib/clinical/types';

const patient = vi.fn();
vi.mock('@/lib/ct/booking-patient', () => ({ getBookingPatient: (...a: unknown[]) => patient(...a) }));
const labs = vi.fn();
vi.mock('@/lib/ct/clinical-store', () => ({ labSource: { listForPatient: (...a: unknown[]) => labs(...a), getById: vi.fn() } }));
const bookings = vi.fn();
vi.mock('@/lib/ct/bookings', () => ({ listBookingsForPatient: (...a: unknown[]) => bookings(...a) }));
const orders = vi.fn();
vi.mock('@/lib/ct/client', () => ({ apiRoot: { orders: () => ({ get: (a: unknown) => ({ execute: () => orders(a) }) }) } }));
vi.mock('@/lib/ct/doctors', () => ({ getDoctorByKey: vi.fn() }));

import { AccountGoneError, countOrders, getOverview } from './account-summary';

const NOW = new Date('2026-10-08T12:00:00Z');
const lab = (id: string, status: 'ready' | 'processing', collectedAt = '2026-10-01'): LabOrder => ({
  id, patientRef: 'pt_a', name: `Test ${id}`, collectedAt, status, orderedByDoctorKey: 'd', laboratory: 'Quest', note: '', results: [],
});
const booking = (status: string, startsAt: string) => ({ reference: 'BK-AAAAAAAAAA', status, startsAt });

beforeEach(() => {
  patient.mockReset().mockResolvedValue({ patientRef: 'pt_a', firstName: 'Sam', email: 'sam@example.com' });
  labs.mockReset().mockResolvedValue([]);
  bookings.mockReset().mockResolvedValue([]);
  orders.mockReset().mockResolvedValue({ body: { total: 0, count: 0 } });
});

describe('account-dashboard: getOverview', () => {
  it('Nothing yet on the account: every summary is ok with zero data', async () => {
    const o = await getOverview('c1', NOW);
    expect(o).toEqual({
      user: { status: 'ok', data: { firstName: 'Sam', email: 'sam@example.com' } },
      labs: { status: 'ok', data: { ready: 0, latest: [] } },
      appointments: { status: 'ok', data: { upcoming: 0 } },
      orders: { status: 'ok', data: { count: 0 } },
    });
  });

  it('counts ready labs, takes the 3 most recent, counts upcoming booked appointments, and reads the order total', async () => {
    labs.mockResolvedValue([lab('1', 'processing'), lab('2', 'ready'), lab('3', 'ready'), lab('4', 'ready')]);
    bookings.mockResolvedValue([
      booking('booked', '2026-10-09T10:00:00Z'),
      booking('cancelled', '2026-10-10T10:00:00Z'),
      booking('completed', '2026-09-01T10:00:00Z'),
      booking('booked', '2026-10-01T10:00:00Z'),
    ]);
    orders.mockResolvedValue({ body: { total: 7, count: 1 } });
    const o = await getOverview('c1', NOW);
    expect(o.labs).toMatchObject({ status: 'ok', data: { ready: 3 } });
    expect(o.labs.status === 'ok' && o.labs.data.latest.map((l) => l.id)).toEqual(['1', '2', '3']);
    expect(o.appointments).toEqual({ status: 'ok', data: { upcoming: 1 } });
    expect(o.orders).toEqual({ status: 'ok', data: { count: 7 } });
  });

  it('One backing service down: only that summary reports an error', async () => {
    labs.mockRejectedValue(new Error('lab source down'));
    bookings.mockResolvedValue([booking('booked', '2026-10-09T10:00:00Z')]);
    const o = await getOverview('c1', NOW);
    expect(o.labs).toEqual({ status: 'error' });
    expect(o.appointments).toEqual({ status: 'ok', data: { upcoming: 1 } });
    expect(o.orders).toEqual({ status: 'ok', data: { count: 0 } });
    expect(o.user.status).toBe('ok');
  });

  it('One backing service down: the orders read failing leaves labs and appointments intact', async () => {
    orders.mockRejectedValue(new Error('orders down'));
    const o = await getOverview('c1', NOW);
    expect(o.orders).toEqual({ status: 'error' });
    expect(o.labs.status).toBe('ok');
  });

  it('a failing customer read marks the patient-bound summaries unavailable but still counts orders', async () => {
    patient.mockRejectedValue(new Error('customers down'));
    orders.mockResolvedValue({ body: { total: 2, count: 2 } });
    const o = await getOverview('c1', NOW);
    expect(o).toEqual({ user: { status: 'error' }, labs: { status: 'error' }, appointments: { status: 'error' }, orders: { status: 'ok', data: { count: 2 } } });
  });

  it('Session no longer valid: a customer that does not exist raises AccountGoneError', async () => {
    patient.mockResolvedValue(null);
    await expect(getOverview('gone', NOW)).rejects.toBeInstanceOf(AccountGoneError);
  });

  it('a customer without a patient reference has empty labs and appointments, not an error', async () => {
    patient.mockResolvedValue({ email: 'x@example.com' });
    const o = await getOverview('c1', NOW);
    expect(o.labs).toEqual({ status: 'ok', data: { ready: 0, latest: [] } });
    expect(labs).not.toHaveBeenCalled();
  });

  it('countOrders filters by the customer id only', async () => {
    await countOrders('c"1');
    expect(orders).toHaveBeenCalledWith({ queryArgs: { where: 'customerId="c1"', limit: 1, withTotal: true } });
  });
});

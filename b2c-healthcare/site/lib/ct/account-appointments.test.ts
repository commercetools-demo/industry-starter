import { beforeEach, describe, expect, it, vi } from 'vitest';

const patient = vi.fn();
vi.mock('@/lib/ct/booking-patient', () => ({ getBookingPatient: (...a: unknown[]) => patient(...a) }));
const bookings = vi.fn();
vi.mock('@/lib/ct/bookings', () => ({ listBookingsForPatient: (...a: unknown[]) => bookings(...a) }));
const doctor = vi.fn();
vi.mock('@/lib/ct/doctors', () => ({ getDoctorByKey: (...a: unknown[]) => doctor(...a) }));

import { listAppointments } from './account-appointments';

const NOW = new Date('2026-10-08T12:00:00Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
const bk = (n: number, startsAt: string, status = 'booked', mode = 'remote') => ({ reference: `BK-AAAAAAAAA${n}`, doctorKey: 'mlv-doc-a', mode, startsAt, status });

beforeEach(() => {
  patient.mockReset().mockResolvedValue({ patientRef: 'pt_sam', email: 's@example.com' });
  bookings.mockReset().mockResolvedValue([]);
  doctor.mockReset().mockResolvedValue({ name: 'Dr. Amara Okafor', clinicName: 'Malva Clinic · Midtown', timezone: 'America/New_York' });
});

describe('design-account-area: Appointments (data)', () => {
  it('List: upcoming first (soonest first), past separated (most recent first), cancelled bookings are past', async () => {
    bookings.mockResolvedValue([
      bk(1, hours(-48), 'completed'),
      bk(2, hours(72)),
      bk(3, hours(24)),
      bk(4, hours(-24)),
      bk(5, hours(30), 'cancelled'),
    ]);
    const out = await listAppointments('c1', NOW);
    expect(out.upcoming.map((a) => a.reference)).toEqual(['BK-AAAAAAAAA3', 'BK-AAAAAAAAA2']);
    expect(out.past.map((a) => a.reference)).toEqual(['BK-AAAAAAAAA5', 'BK-AAAAAAAAA4', 'BK-AAAAAAAAA1']);
    expect(out.upcoming[0]).toMatchObject({ doctorName: 'Dr. Amara Okafor', clinicName: 'Malva Clinic · Midtown', timezone: 'America/New_York', mode: 'remote' });
  });

  it('Cancel: offered only for a booked appointment at least 2 h away', async () => {
    bookings.mockResolvedValue([bk(1, hours(2)), bk(2, hours(1.9)), bk(3, hours(5), 'cancelled')]);
    const out = await listAppointments('c1', NOW);
    expect(Object.fromEntries([...out.upcoming, ...out.past].map((a) => [a.reference, a.canCancel]))).toEqual({
      'BK-AAAAAAAAA1': true,
      'BK-AAAAAAAAA2': false,
      'BK-AAAAAAAAA3': false,
    });
  });

  it('Empty: no bookings, and a customer without a patient reference, both give empty lists', async () => {
    expect(await listAppointments('c1', NOW)).toEqual({ upcoming: [], past: [] });
    patient.mockResolvedValue({ email: 'x@example.com' });
    expect(await listAppointments('c1', NOW)).toEqual({ upcoming: [], past: [] });
    expect(bookings).toHaveBeenCalledTimes(1);
  });

  it('a doctor that cannot be read leaves the name empty and does not fail the list', async () => {
    doctor.mockRejectedValue(new Error('down'));
    bookings.mockResolvedValue([bk(1, hours(24))]);
    const out = await listAppointments('c1', NOW);
    expect(out.upcoming[0]).toMatchObject({ doctorName: '', timezone: 'America/New_York', canCancel: true });
  });

  it('reads each doctor once however many bookings they have', async () => {
    bookings.mockResolvedValue([bk(1, hours(24)), bk(2, hours(48)), bk(3, hours(72))]);
    await listAppointments('c1', NOW);
    expect(doctor).toHaveBeenCalledTimes(1);
  });
});

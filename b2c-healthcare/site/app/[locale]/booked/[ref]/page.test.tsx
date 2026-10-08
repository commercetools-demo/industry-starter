import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen, within } from '@/test/utils';
import type { Booking } from '@/lib/clinical/types';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { namespace: string }) =>
    createTranslator({ locale: 'en-US', messages, namespace: (typeof arg === 'string' ? arg : arg.namespace) as 'booking.confirmed' }),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<object>()), notFound: () => notFound() }));
const getBookingForVisitor = vi.fn();
vi.mock('@/lib/booking-access', () => ({ getBookingForVisitor: (...a: unknown[]) => getBookingForVisitor(...a) }));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const getDoctorByKey = vi.fn();
vi.mock('@/lib/ct/doctors', () => ({ getDoctorByKey: (...a: unknown[]) => getDoctorByKey(...a) }));
const getBookingPatient = vi.fn();
vi.mock('@/lib/ct/booking-patient', () => ({ getBookingPatient: (...a: unknown[]) => getBookingPatient(...a) }));

import BookedPage, { generateMetadata } from './page';
import BookingNotFound from './not-found';

const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const doctor = {
  name: 'Dr. Amara Okafor',
  specialty: 'General Practice',
  clinicName: 'Malva Clinic · Midtown',
  timezone: 'America/New_York',
  fees: { remote: money(3500), office: money(5500) },
};
function booking(o: Partial<Booking> = {}): Booking {
  return {
    reference: 'BK-ABCDEFGHJK',
    requestId: 'req-00000001',
    doctorKey: 'mlv-doc-amara-okafor',
    mode: 'remote',
    startsAt: '2026-10-09T13:30:00.000Z', // Fri 09:30 in New York
    guest: { name: 'Gina Guest', email: 'gina.guest@example.com', phone: '(555) 010-2030' },
    reason: 'Persistent cough',
    createdAt: '2026-10-08T05:00:00.000Z',
    status: 'booked',
    ...o,
  };
}
const patientBooking = (o: Partial<Booking> = {}) => booking({ guest: undefined, patientRef: 'pt_sam12345', phone: '212 555 0100', ...o });

const render = async (ref = 'BK-ABCDEFGHJK') => renderWithProviders(await BookedPage({ params: Promise.resolve({ locale: 'en-US', ref }) }));

beforeEach(() => {
  getBookingForVisitor.mockReset().mockResolvedValue(booking());
  getSession.mockReset().mockResolvedValue({});
  getDoctorByKey.mockReset().mockResolvedValue(doctor);
  getBookingPatient.mockReset().mockResolvedValue({ firstName: 'Sam', lastName: 'Rivera', email: 'sam.rivera@example.com', patientRef: 'pt_sam12345' });
  notFound.mockClear();
});

describe('design-pdp: Booking confirmation page', () => {
  it('Confirmation content: badge, greeting, keep-the-reference line (no email claim) and every row', async () => {
    await render();
    expect(screen.getByText('Booking confirmed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: "You're booked, Gina." })).toBeInTheDocument();
    expect(screen.getByText('Keep your reference BK-ABCDEFGHJK.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/confirmation was sent|sent to/i);
    const dl = screen.getByTestId('booking-confirmation').querySelector('dl') as HTMLElement;
    const row = (label: string) => within(dl).getByText(label).nextElementSibling;
    expect(row('Reference')).toHaveTextContent('BK-ABCDEFGHJK');
    expect(row('Doctor')).toHaveTextContent('Dr. Amara Okafor · General Practice');
    expect(row('When')).toHaveTextContent('October 9, 2026 at 09:30 (EDT)');
    expect(row('Type')).toHaveTextContent('Video session');
    expect(row('Join')).toHaveTextContent(/not sent by email/);
    expect(row('Fee')).toHaveTextContent('$35.00 · pay at the visit');
  });

  it('Confirmation content: an office visit shows Where (the clinic) and the office fee', async () => {
    getBookingForVisitor.mockResolvedValue(booking({ mode: 'office' }));
    await render();
    const dl = screen.getByTestId('booking-confirmation').querySelector('dl') as HTMLElement;
    expect(within(dl).getByText('Where').nextElementSibling).toHaveTextContent('Malva Clinic · Midtown');
    expect(within(dl).queryByText('Join')).not.toBeInTheDocument();
    expect(within(dl).getByText('Fee').nextElementSibling).toHaveTextContent('$55.00 · pay at the visit');
    expect(within(dl).getByText('Type').nextElementSibling).toHaveTextContent('Office visit');
  });

  it('Confirmation content: never shows the reason, phone or email', async () => {
    await render();
    expect(document.body.textContent).not.toMatch(/cough|555|gina\.guest@/i);
  });

  it('Confirmation content: a doctor that cannot be read still shows the booking without that row', async () => {
    getDoctorByKey.mockRejectedValue(new Error('down'));
    await render();
    const dl = screen.getByTestId('booking-confirmation').querySelector('dl') as HTMLElement;
    expect(within(dl).queryByText('Doctor')).not.toBeInTheDocument();
    expect(within(dl).getByText('Fee').nextElementSibling).toHaveTextContent('Pay at the visit');
  });

  it('Guest nudge: a guest sees "Create an account" with the explanation, and "Book another"', async () => {
    await render();
    const nudge = screen.getByTestId('guest-nudge');
    expect(nudge).toHaveTextContent('Booked as a guest. Create an account to manage appointments and see prescriptions and lab results.');
    expect(within(nudge).getByRole('link', { name: 'Create an account' }).getAttribute('href')).toContain('mode=register');
    expect(screen.getByRole('link', { name: 'Book another' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My appointments' })).not.toBeInTheDocument();
  });

  it('Guest nudge: a signed-in patient gets "My appointments" and the line that it is listed there, not the nudge', async () => {
    getBookingForVisitor.mockResolvedValue(patientBooking());
    getSession.mockResolvedValue({ customerId: 'c-sam' });
    await render();
    expect(screen.getByRole('heading', { level: 1, name: "You're booked, Sam." })).toBeInTheDocument();
    expect(screen.getByText('Keep your reference BK-ABCDEFGHJK. It is also under My appointments.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My appointments' })).toHaveAttribute('href', '/en-US/account/appointments');
    expect(screen.queryByTestId('guest-nudge')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument();
  });

  it('Access to a booking: a visitor without access gets the 404 path (notFound) and no booking is read', async () => {
    getBookingForVisitor.mockResolvedValue(null);
    await expect(render('BK-ABCDEFGHJK')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(getDoctorByKey).not.toHaveBeenCalled();
    renderWithProviders(<BookingNotFound />);
    expect(screen.getByRole('heading', { name: 'Not found.' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/booking|BK-/i);
  });

  it('is never indexed', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en-US', ref: 'BK-ABCDEFGHJK' }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentView, AppointmentsView } from '@/lib/account-types';
import { apiBookingCancel } from '@/lib/api-paths';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';

const router = { refresh: vi.fn(), replace: vi.fn(), push: vi.fn() };
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => router,
}));

import { AppointmentList } from './AppointmentList';

const appt = (over: Partial<AppointmentView>): AppointmentView => ({
  reference: 'BK-AAAAAAAAA2', doctorKey: 'mlv-doc-amara-okafor', doctorName: 'Dr. Amara Okafor', mode: 'office', clinicName: 'Malva Clinic · Midtown',
  startsAt: '2026-10-20T14:00:00.000Z', timezone: 'America/New_York', status: 'booked', canCancel: true, ...over,
});
const upcomingRemote = appt({ reference: 'BK-AAAAAAAAA3', mode: 'remote', startsAt: '2026-10-15T19:30:00.000Z' });
const upcomingOffice = appt({});
const past = appt({ reference: 'BK-AAAAAAAAA1', startsAt: '2026-09-18T14:00:00.000Z', status: 'completed', canCancel: false });
const full: AppointmentsView = { upcoming: [upcomingRemote, upcomingOffice], past: [past, appt({ reference: 'BK-AAAAAAAAA4', status: 'cancelled', canCancel: false, startsAt: '2026-09-01T14:00:00.000Z' })] };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  Object.values(router).forEach((fn) => fn.mockReset());
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const card = (reference: string) => document.querySelector(`[data-appointment="${reference}"]`) as HTMLElement;

describe('design-account-area: Appointments', () => {
  it('List: doctor, "<date> at <time> · Video session | <clinic>" in the clinic zone and the reference badge', () => {
    renderWithProviders(<AppointmentList appointments={full} />);
    const remote = card('BK-AAAAAAAAA3');
    expect(within(remote).getByText('Dr. Amara Okafor')).toBeInTheDocument();
    expect(within(remote).getByText(/October 15, 2026 at 3:30\s?PM · Video session/)).toBeInTheDocument();
    expect(within(remote).getByText('BK-AAAAAAAAA3')).toBeInTheDocument();
    expect(within(card('BK-AAAAAAAAA2')).getByText(/October 20, 2026 at 10:00\s?AM · Malva Clinic · Midtown/)).toBeInTheDocument();
  });

  it('List: upcoming first, past visits in a separate section, cancelled and completed marked', () => {
    renderWithProviders(<AppointmentList appointments={full} />);
    const upcoming = screen.getByRole('region', { name: 'Upcoming' });
    const pastSection = screen.getByRole('region', { name: 'Past' });
    expect(within(upcoming).getAllByRole('article')).toHaveLength(2);
    expect(within(pastSection).getAllByRole('article')).toHaveLength(2);
    expect(upcoming.compareDocumentPosition(pastSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card('BK-AAAAAAAAA1')).getByText('Completed')).toBeInTheDocument();
    expect(within(card('BK-AAAAAAAAA4')).getByText('Cancelled')).toBeInTheDocument();
    expect(within(pastSection).queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument();
  });

  it('Empty: "No appointments yet. Book one" links to /doctors/remote', () => {
    renderWithProviders(<AppointmentList appointments={{ upcoming: [], past: [] }} />);
    expect(screen.getByText(/No appointments yet\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book one' })).toHaveAttribute('href', '/en-US/doctors/remote');
  });

  it('a failing booking store shows an inline error', () => {
    renderWithProviders(<AppointmentList appointments={null} />);
    expect(screen.getByText("We couldn't load your appointments. Please try again.")).toBeInTheDocument();
  });

  it('Cancel or reschedule: only upcoming bookings that can still be cancelled get a cancel button; there is no reschedule', () => {
    renderWithProviders(<AppointmentList appointments={{ upcoming: [upcomingRemote, appt({ reference: 'BK-AAAAAAAAA5', canCancel: false })], past: [] }} />);
    expect(screen.getAllByRole('button', { name: 'Cancel appointment' })).toHaveLength(1);
    expect(screen.queryByText(/reschedule/i)).not.toBeInTheDocument();
  });

  it('Cancel: asks first, posts to the cancel endpoint, tells the patient and refreshes the list', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'cancelled' }), { status: 200 }));
    renderWithProviders(<AppointmentList appointments={{ upcoming: [upcomingRemote], past: [] }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel appointment' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel this appointment?' });
    expect(dialog).toHaveTextContent('Dr. Amara Okafor on October 15, 2026 at');
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel appointment' }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(apiBookingCancel('BK-AAAAAAAAA3'), { method: 'POST' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('status').some((el) => el.textContent === 'Appointment cancelled.')).toBe(true);
  });

  it('Cancel: "Keep appointment" closes the dialog without any request', async () => {
    renderWithProviders(<AppointmentList appointments={{ upcoming: [upcomingRemote], past: [] }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel appointment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep appointment' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Cancel: too late is explained in the dialog and the list is refreshed', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'too-late' }), { status: 409 }));
    renderWithProviders(<AppointmentList appointments={{ upcoming: [upcomingRemote], past: [] }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel appointment' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel appointment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('can no longer be cancelled online');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('Cancel: any other failure keeps the dialog open with a retryable message', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    renderWithProviders(<AppointmentList appointments={{ upcoming: [upcomingRemote], past: [] }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel appointment' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel appointment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't cancel this appointment.");
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

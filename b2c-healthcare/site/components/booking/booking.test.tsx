import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';
import type { SlotsResponse } from '@/lib/types';

const push = vi.fn();
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/doctor/mlv-doc-amara-okafor',
}));

import { BookingPanel, type BookingPanelProps } from './BookingPanel';

const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const slot = (date: string, time: string) => ({ startsAt: `${date}T${time}:00.000Z`, time });
const DAYS = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'];

function slotsFor(mode: 'remote' | 'office', o: { empty?: string[] } = {}): SlotsResponse {
  return {
    mode,
    timezone: 'America/New_York',
    days: DAYS.map((date) => ({
      date,
      slots: o.empty?.includes(date) ? [] : date === '2026-10-08' ? [] : [slot(date, '09:30'), slot(date, '10:00'), slot(date, '10:30'), slot(date, '16:00')],
    })),
  };
}

const doctor: BookingPanelProps['doctor'] = {
  key: 'mlv-doc-amara-okafor',
  name: 'Dr. Amara Okafor',
  modes: ['remote', 'office'],
  fees: { remote: money(3500), office: money(5500) },
};

interface Route {
  slots?: (mode: string) => SlotsResponse | Response;
  post?: (body: Record<string, unknown>) => Response | Promise<Response>;
}
const calls: { url: string; method: string; body?: Record<string, unknown> }[] = [];

function mockFetch(route: Route = {}) {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
      calls.push({ url, method, body });
      if (method === 'POST') return route.post ? route.post(body ?? {}) : Response.json({ reference: 'BK-ABCDEFGHJK' }, { status: 201 });
      const mode = new URL(url, 'http://x').searchParams.get('mode') ?? 'remote';
      const answer = route.slots ? route.slots(mode) : slotsFor(mode as 'remote' | 'office');
      return answer instanceof Response ? answer : Response.json(answer);
    }),
  );
}

const renderPanel = (props: Partial<BookingPanelProps> = {}) =>
  renderWithProviders(<BookingPanel doctor={doctor} initialMode="remote" patient={null} {...props} />);

beforeEach(() => {
  push.mockReset();
  mockFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe('design-pdp: Booking panel', () => {
  it('Mode toggle: the fee follows the chosen mode and the times are read for it', async () => {
    const user = userEvent.setup();
    renderPanel({ initialMode: 'office' });
    expect(screen.getByTestId('booking-fee')).toHaveTextContent('$55.00');
    await screen.findByRole('group', { name: 'Choose a day' });
    expect(calls[0].url).toBe('/api/doctors/mlv-doc-amara-okafor/slots?mode=office');
    await user.click(screen.getByRole('button', { name: 'Video' }));
    expect(screen.getByTestId('booking-fee')).toHaveTextContent('$35.00');
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('mode=remote'))).toBe(true));
    expect(screen.getByRole('button', { name: 'Video' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Mode toggle: a mode the doctor does not offer is disabled', async () => {
    renderPanel({ doctor: { ...doctor, modes: ['remote'], fees: { remote: money(3000) } } });
    await screen.findByRole('group', { name: 'Choose a day' });
    expect(screen.getByRole('button', { name: 'In office' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Video' })).toBeEnabled();
  });

  it('Day and slots: seven day buttons, the selected one is navy, its date line and times show in a 3-column grid', async () => {
    const user = userEvent.setup();
    renderPanel();
    const days = await screen.findByRole('group', { name: 'Choose a day' });
    expect(within(days).getAllByRole('button')).toHaveLength(7);
    // the first day with free times (Oct 9) is selected by default
    const oct9 = within(days).getByRole('button', { name: /Fri\s*9/ });
    expect(oct9).toHaveAttribute('aria-pressed', 'true');
    expect(oct9.className).toContain('bg-navy-700');
    expect(screen.getByText('October 9, 2026')).toBeInTheDocument();
    const grid = screen.getByRole('group', { name: 'Available times' });
    expect(grid.className).toContain('grid-cols-3');
    expect(within(grid).getAllByRole('button').map((b) => b.textContent)).toEqual(['09:30', '10:00', '10:30', '16:00']);
    await user.click(within(days).getByRole('button', { name: /Sat\s*10/ }));
    expect(screen.getByText('October 10, 2026')).toBeInTheDocument();
    expect(within(days).getByRole('button', { name: /Sat\s*10/ }).className).toContain('bg-navy-700');
    expect(oct9.className).not.toContain('bg-navy-700');
  });

  it('Day with no free time: the note replaces the grid', async () => {
    const user = userEvent.setup();
    renderPanel();
    const days = await screen.findByRole('group', { name: 'Choose a day' });
    await user.click(within(days).getByRole('button', { name: /Thu\s*8/ }));
    expect(screen.getByText('No times left on this day. Try another date.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Available times' })).not.toBeInTheDocument();
  });

  it('Who is booking: a guest reads the no-account note, a signed-in patient reads their name', async () => {
    const { unmount } = renderPanel();
    expect(screen.getByText('No account needed. You can book as a guest.')).toBeInTheDocument();
    unmount();
    renderPanel({ patient: { name: 'Sam Rivera', email: 'sam.rivera@example.com' } });
    expect(screen.getByText('Booking as Sam Rivera')).toBeInTheDocument();
    expect(screen.queryByText(/No account needed/)).not.toBeInTheDocument();
  });

  it('The clinic time zone is named', async () => {
    renderPanel();
    expect(await screen.findByText('Times are shown in Eastern Daylight Time.')).toBeInTheDocument();
  });

  it('No price resolves: "Fee unavailable", booking is disabled and no times are read', async () => {
    renderPanel({ doctor: { ...doctor, fees: { office: money(5500) } }, initialMode: 'remote' });
    expect(screen.getByTestId('booking-fee')).toHaveTextContent('Fee unavailable');
    expect(screen.getByText(/cannot be booked/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Available times' })).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
    // switching to the mode that has a fee brings the times back
    await userEvent.setup().click(screen.getByRole('button', { name: 'In office' }));
    expect(screen.getByTestId('booking-fee')).toHaveTextContent('$55.00');
    expect(await screen.findByRole('group', { name: 'Choose a day' })).toBeInTheDocument();
  });

  it('a failed read says so and offers a retry', async () => {
    const user = userEvent.setup();
    mockFetch({ slots: () => Response.json({ error: 'x' }, { status: 500 }) });
    renderPanel();
    expect(await screen.findByText('We could not load the times.')).toBeInTheDocument();
    mockFetch();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('group', { name: 'Choose a day' })).toBeInTheDocument();
  });
});

const pickFirstSlot = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: '09:30' }));
  return screen.getByRole('dialog', { name: 'Confirm your booking' });
};

describe('design-pdp: Confirm booking modal', () => {
  it('Guest: summary, "Booking as a guest. Sign in instead" and the four required fields with the consent line', async () => {
    const user = userEvent.setup();
    renderPanel();
    const dialog = await pickFirstSlot(user);
    expect(within(dialog).getByTestId('booking-summary')).toHaveTextContent('Dr. Amara Okafor · Video session');
    expect(within(dialog).getByTestId('booking-summary')).toHaveTextContent('October 9, 2026 at 09:30 · $35.00');
    expect(within(dialog).getByText(/Booking as a guest\./)).toBeInTheDocument();
    const signIn = within(dialog).getByRole('link', { name: 'Sign in instead' });
    expect(signIn.getAttribute('href')).toContain('/en-US/login');
    expect(decodeURIComponent(signIn.getAttribute('href') ?? '')).toContain('next=/en-US/doctor/mlv-doc-amara-okafor?m=remote');
    for (const label of ['Full name', 'Email', 'Phone', 'Reason for visit']) expect(within(dialog).getByLabelText(label)).toBeRequired();
    expect(within(dialog).getByRole('button', { name: 'Confirm booking' })).toBeInTheDocument();
    expect(within(dialog).getByTestId('booking-consent')).toHaveTextContent('deleted 90 days after the visit');
  });

  it('Signed-in patient: name and email as text, only Phone and Reason asked', async () => {
    const user = userEvent.setup();
    renderPanel({ patient: { name: 'Sam Rivera', email: 'sam.rivera@example.com' } });
    const dialog = await pickFirstSlot(user);
    expect(within(dialog).getByText('Booking as Sam Rivera (sam.rivera@example.com)')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Full name')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Email')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: 'Sign in instead' })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Phone')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Reason for visit')).toBeInTheDocument();
  });

  it('every field is required: an empty submit shows each problem, focuses the first and sends nothing', async () => {
    const user = userEvent.setup();
    renderPanel();
    const dialog = await pickFirstSlot(user);
    const before = calls.length;
    await user.click(within(dialog).getByRole('button', { name: 'Confirm booking' }));
    expect(within(dialog).getByText('Enter your full name.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter your email address.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a phone number.')).toBeInTheDocument();
    expect(within(dialog).getByText('Tell us briefly why you are booking.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Full name')).toHaveFocus();
    expect(calls).toHaveLength(before);
  });

  it('Close: Escape, the Close button and the overlay each close it and focus returns to the slot', async () => {
    const user = userEvent.setup();
    renderPanel();
    const slotButton = await screen.findByRole('button', { name: '09:30' });
    for (const close of [
      () => user.keyboard('{Escape}'),
      () => user.click(screen.getByRole('button', { name: 'Close dialog' })),
      () => user.click(document.querySelector('[data-overlay]') as HTMLElement),
    ]) {
      await user.click(slotButton);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await close();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(slotButton).toHaveFocus();
    }
  });

  it('Close: focus is trapped while open', async () => {
    const user = userEvent.setup();
    renderPanel();
    const dialog = await pickFirstSlot(user);
    const close = within(dialog).getByRole('button', { name: 'Close dialog' });
    close.focus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  async function fillGuest(dialog: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
    await user.type(within(dialog).getByLabelText('Full name'), 'Gina Guest');
    await user.type(within(dialog).getByLabelText('Email'), 'gina.guest@example.com');
    await user.type(within(dialog).getByLabelText('Phone'), '(555) 010-2030');
    await user.type(within(dialog).getByLabelText('Reason for visit'), 'Persistent cough');
  }

  it('a guest booking posts the request, then goes to the confirmation page without the reason in the URL', async () => {
    const user = userEvent.setup();
    renderPanel();
    const dialog = await pickFirstSlot(user);
    await fillGuest(dialog, user);
    await user.click(within(dialog).getByRole('button', { name: 'Confirm booking' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/booked/BK-ABCDEFGHJK'));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe('/api/bookings');
    expect(post?.body).toMatchObject({
      doctorKey: 'mlv-doc-amara-okafor',
      mode: 'remote',
      startsAt: '2026-10-09T09:30:00.000Z',
      name: 'Gina Guest',
      email: 'gina.guest@example.com',
      phone: '(555) 010-2030',
      reason: 'Persistent cough',
    });
    expect(String(post?.body?.requestId).length).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(push.mock.calls)).not.toMatch(/cough|gina|555/i);
  });

  it('a signed-in booking sends no name or email (the server uses the session)', async () => {
    const user = userEvent.setup();
    renderPanel({ patient: { name: 'Sam Rivera', email: 'sam.rivera@example.com' } });
    const dialog = await pickFirstSlot(user);
    await user.type(within(dialog).getByLabelText('Phone'), '212 555 0100');
    await user.type(within(dialog).getByLabelText('Reason for visit'), 'Follow-up');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm booking' }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const post = calls.find((c) => c.method === 'POST');
    expect(Object.keys(post?.body ?? {}).sort()).toEqual(['doctorKey', 'mode', 'phone', 'reason', 'requestId', 'startsAt']);
  });

  it('busy state: the button is disabled and says so while the request is pending (no double submit)', async () => {
    const user = userEvent.setup();
    let release: (r: Response) => void = () => undefined;
    mockFetch({ post: () => new Promise<Response>((resolve) => (release = resolve)) });
    renderPanel();
    const dialog = await pickFirstSlot(user);
    await fillGuest(dialog, user);
    await user.click(within(dialog).getByRole('button', { name: 'Confirm booking' }));
    const busy = await within(dialog).findByRole('button', { name: 'Booking…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    release(Response.json({ reference: 'BK-ABCDEFGHJK' }, { status: 201 }));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('Slot taken meanwhile: says the time is no longer available, refetches the grid, keeps the dialog', async () => {
    const user = userEvent.setup();
    let taken = false;
    mockFetch({
      slots: (mode) => {
        const all = slotsFor(mode as 'remote' | 'office');
        if (taken) all.days[1].slots = all.days[1].slots.filter((s) => s.time !== '09:30');
        return all;
      },
      post: () => {
        taken = true;
        return Response.json({ error: 'This changed in the meantime. Please try again.' }, { status: 409 });
      },
    });
    renderPanel();
    const dialog = await pickFirstSlot(user);
    await fillGuest(dialog, user);
    const slotReads = () => calls.filter((c) => c.method === 'GET').length;
    const readsBefore = slotReads();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm booking' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('That time is no longer available. Pick another time.');
    await waitFor(() => expect(slotReads()).toBeGreaterThan(readsBefore));
    await waitFor(() => expect(screen.queryAllByRole('button', { name: '09:30' })).toHaveLength(0));
    expect(push).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Confirm booking' })).toBeDisabled();
  });

  it('another failure shows a generic message and lets the visitor retry with the same request id', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    mockFetch({ post: () => (++attempt === 1 ? Response.json({ error: 'x' }, { status: 500 }) : Response.json({ reference: 'BK-ABCDEFGHJK' }, { status: 201 })) });
    renderPanel();
    const dialog = await pickFirstSlot(user);
    await fillGuest(dialog, user);
    await user.click(within(dialog).getByRole('button', { name: 'Confirm booking' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('We could not complete your booking. Please try again.');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm booking' }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0].body?.requestId).toBe(posts[1].body?.requestId);
  });

  it('Health data minimization: the dialog carries the consent line and the failure texts never repeat the reason', async () => {
    const user = userEvent.setup();
    mockFetch({ post: () => Response.json({ error: 'Persistent cough' }, { status: 500 }) });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderPanel();
    const dialog = await pickFirstSlot(user);
    expect(within(dialog).getByTestId('booking-consent')).toBeInTheDocument();
    await fillGuest(dialog, user);
    await user.click(within(dialog).getByRole('button', { name: 'Confirm booking' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).not.toContain('cough');
    expect(log).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
    expect(location.href).not.toMatch(/cough|gina|555/i);
  });
});

import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefillView } from '@/lib/refill-types';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';

const refresh = vi.fn();
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }));

import { EnableRefillForm } from './EnableRefillForm';
import { OrderAutoRefill } from './OrderAutoRefill';
import { RefillList } from './RefillList';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
const answer = (body: unknown, status = 200) => fetchMock.mockImplementationOnce(async () => json(body, status));
beforeEach(() => {
  refresh.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const refill = (over: Partial<RefillView> = {}): RefillView => ({
  id: 'ro1',
  state: 'Active',
  cadence: 'monthly',
  nextOrderAt: '2026-11-08T10:00:00Z',
  lastOrderAt: null,
  skipping: false,
  lines: [{ name: 'Atorvastatin 20 mg tablets', quantity: 1 }],
  priceMode: 'Dynamic',
  lastRun: null,
  ...over,
});
const initOf = (i: number) => fetchMock.mock.calls[i]?.[1] as RequestInit;
const body = (i: number) => JSON.parse(initOf(i).body as string);

describe('subscriptions-and-recurring-orders › Recurring order created (page)', () => {
  it('the buyer sees the cadence and when the next order will be generated, and which price applies', () => {
    renderWithProviders(<RefillList refills={[refill()]} />);
    const card = document.querySelector('[data-refill-card]') as HTMLElement;
    expect(within(card).getByRole('heading')).toHaveTextContent('Atorvastatin 20 mg tablets');
    expect(within(card).getAllByText('Every month').length).toBeGreaterThan(0);
    expect(within(card).getByText('Next refill: November 8, 2026')).toBeInTheDocument();
    expect(within(card).getByText('Priced at the catalog price on the day each refill is created, so the amount can change.')).toBeInTheDocument();
    expect(within(card).getByText('No refill has been created yet.')).toBeInTheDocument();
  });

  it('empty: states the absence and points to the setup; a failed read says so', () => {
    const { unmount } = renderWithProviders(<RefillList refills={[]} />);
    expect(screen.getByText('You have no auto-refills yet.')).toBeInTheDocument();
    unmount();
    renderWithProviders(<RefillList refills={null} />);
    expect(screen.getByText('We could not load your auto-refills. Please try again.')).toBeInTheDocument();
  });

  it('shows why the last run did not happen', () => {
    renderWithProviders(<RefillList refills={[refill({ state: 'Paused', nextOrderAt: null, lastRun: { runAt: '2026-11-07T05:00:00Z', outcome: 'skipped', reason: 'authorization-expired' } })]} />);
    expect(screen.getByText('Last run: skipped (November 7, 2026), your prescription has expired.')).toBeInTheDocument();
    expect(screen.getByText('Paused: no further refills until you resume.')).toBeInTheDocument();
  });
});

describe('subscriptions-and-recurring-orders › Catalog price moved (page)', () => {
  it('a Fixed refill says the price is the one set at the start', () => {
    renderWithProviders(<RefillList refills={[refill({ priceMode: 'Fixed' })]} />);
    expect(screen.getByText('Priced at the amount set when you started, whatever the catalog price does.')).toBeInTheDocument();
  });
});

describe('subscriptions-and-recurring-orders › Paused or canceled (page)', () => {
  it('pause: one request, then the route refreshes; a paused refill offers Resume instead and shows no next date', async () => {
    answer(refill({ state: 'Paused' }));
    const { unmount } = renderWithProviders(<RefillList refills={[refill()]} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auto-refill/ro1');
    expect(body(0)).toEqual({ action: 'pause' });
    unmount();
    renderWithProviders(<RefillList refills={[refill({ state: 'Paused', nextOrderAt: null })]} />);
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.queryByText(/Next refill/)).toBeNull();
  });

  it('cancel asks first; canceled shows when the last refill was and no controls', async () => {
    answer(refill({ state: 'Canceled' }));
    const { unmount } = renderWithProviders(<RefillList refills={[refill()]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel auto-refill' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(body(0)).toEqual({ action: 'cancel' });
    unmount();
    renderWithProviders(<RefillList refills={[refill({ state: 'Canceled', nextOrderAt: null, lastOrderAt: '2026-10-08T10:00:00Z' })]} />);
    expect(screen.getByText('The last refill was on October 8, 2026.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('skip next sends the skip action; once set it says the refill will be skipped and the button is off', async () => {
    answer(refill({ skipping: true }));
    const { unmount } = renderWithProviders(<RefillList refills={[refill()]} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Skip next refill' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(body(0)).toEqual({ action: 'skip' });
    unmount();
    renderWithProviders(<RefillList refills={[refill({ skipping: true })]} />);
    expect(screen.getByText('The refill due November 8, 2026 will be skipped.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip next refill' })).toBeDisabled();
  });

  it('a blocked resume says why in words and nothing is refreshed', async () => {
    answer({ code: 'RESUME_BLOCKED', reason: 'authorization-expired', error: 'x' }, 409);
    renderWithProviders(<RefillList refills={[refill({ state: 'Paused', nextOrderAt: null })]} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Resume' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your prescription has expired, so this cannot be resumed.');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('a failure and a busy refill are worded; a failed refill explains itself and offers Resume', async () => {
    answer({ code: 'BUSY' }, 409);
    const { unmount } = renderWithProviders(<RefillList refills={[refill()]} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A refill is being prepared right now.');
    unmount();
    renderWithProviders(<RefillList refills={[refill({ state: 'Failed', nextOrderAt: null })]} />);
    expect(screen.getByText(/The last refill could not be created/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });
});

describe('subscriptions-and-recurring-orders › Schedule changed in place (page)', () => {
  it('changing the cadence patches the same refill; the button waits for a different choice', async () => {
    answer(refill({ cadence: 'quarterly' }));
    renderWithProviders(<RefillList refills={[refill()]} />);
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Change schedule' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Schedule' }), 'quarterly');
    await user.click(screen.getByRole('button', { name: 'Change schedule' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auto-refill/ro1');
    expect(initOf(0).method).toBe('PATCH');
    expect(body(0)).toEqual({ cadence: 'quarterly' });
    expect(screen.getByText('A new schedule applies from the next refill.')).toBeInTheDocument();
  });
});

const OPTIONS = [{ number: 'RX-77102', lines: [{ lineRef: 'a', name: 'Atorvastatin 20 mg tablets' }, { lineRef: 'b', name: 'Lisinopril 10 mg tablets' }] }];

describe('subscriptions-and-recurring-orders: setting one up (form)', () => {
  it('chosen lines and the cadence go in the body, never the URL; the result names what was left out', async () => {
    answer({ refill: refill(), notIncluded: [{ name: 'Lisinopril 10 mg tablets', reason: 'NO_REFILLS' }] }, 201);
    renderWithProviders(<EnableRefillForm options={OPTIONS} hasMethod />);
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Set up auto-refill' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Atorvastatin 20 mg tablets' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'How often' }), 'quarterly');
    await user.click(screen.getByRole('button', { name: 'Set up auto-refill' }));
    const result = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-setup-result]');
      if (!el) throw new Error('none');
      return el;
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auto-refill');
    expect(body(0)).toEqual({ rxNumber: 'RX-77102', lineRefs: ['a'], cadence: 'quarterly' });
    expect(result).toHaveTextContent('Auto-refill is set up: Atorvastatin 20 mg tablets.');
    expect(result.querySelector('[data-not-included]')).toHaveTextContent('Not included: Lisinopril 10 mg tablets (no refills left).');
    expect(refresh).toHaveBeenCalled();
  });

  it('without a saved payment method it says refills are charged to one, links to add it and cannot be submitted', async () => {
    renderWithProviders(<EnableRefillForm options={OPTIONS} hasMethod={false} />);
    expect(screen.getByText('Auto-refill charges a saved payment method.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Save a payment method' })).toHaveAttribute('href', '/en-US/account/payment-methods');
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Atorvastatin 20 mg tablets' }));
    expect(screen.getByRole('button', { name: 'Set up auto-refill' })).toBeDisabled();
  });

  it('a server refusal shows its sentence; no medicines to offer says so', async () => {
    answer({ code: 'NOT_DISPENSABLE', error: 'None of these medicines can be set up for auto-refill right now.' }, 422);
    const { unmount } = renderWithProviders(<EnableRefillForm options={OPTIONS} hasMethod />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Atorvastatin 20 mg tablets' }));
    await user.click(screen.getByRole('button', { name: 'Set up auto-refill' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('None of these medicines can be set up for auto-refill right now.');
    unmount();
    renderWithProviders(<EnableRefillForm options={[]} hasMethod />);
    expect(screen.getByText(/will appear here once you have a prescription with refills left/)).toBeInTheDocument();
  });
});

describe('subscriptions-and-recurring-orders: from an order', () => {
  it('posts the order id and the cadence, then confirms with a link to the page', async () => {
    answer({ refill: refill(), notIncluded: [] }, 201);
    renderWithProviders(<OrderAutoRefill orderId="o1" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Auto-refill this order' }));
    expect(await screen.findByText(/Auto-refill is set up\./)).toBeInTheDocument();
    expect(body(0)).toEqual({ orderId: 'o1', cadence: 'monthly' });
    expect(screen.getByRole('link', { name: 'See your auto-refills' })).toHaveAttribute('href', '/en-US/account/auto-refill');
  });

  it('shows the server sentence when it cannot (for example no saved payment method)', async () => {
    answer({ code: 'NO_PAYMENT_METHOD', error: 'Save a payment method first: refills are charged to it.' }, 409);
    renderWithProviders(<OrderAutoRefill orderId="o1" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Auto-refill this order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save a payment method first');
  });
});

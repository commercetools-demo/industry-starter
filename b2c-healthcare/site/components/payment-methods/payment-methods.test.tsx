import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredMethodDescriptor } from '@/lib/checkout/payment-provider';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';

const refresh = vi.fn();
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }));

import { PaymentMethodList } from './PaymentMethodList';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
const answer = (body: unknown, status = 200) => fetchMock.mockImplementationOnce(async () => json(body, status));
beforeEach(() => {
  refresh.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const visa: StoredMethodDescriptor = { id: 'pm1', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2030, isDefault: true };
const mc: StoredMethodDescriptor = { id: 'pm2', brand: 'Mastercard', last4: '4444', expMonth: 3, expYear: 2031, isDefault: false };

describe('payment-methods › Card tokenized then listed (page)', () => {
  it('lists each card by brand and last four digits with its expiry and a Default badge, as a card not a table', () => {
    renderWithProviders(<PaymentMethodList methods={[visa, mc]} />);
    const cards = document.querySelectorAll<HTMLElement>('[data-method-card]');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByRole('heading')).toHaveTextContent('Visa ending 4242');
    expect(within(cards[0]!).getByText('Expires 12/2030')).toBeInTheDocument();
    expect(within(cards[0]!).getByText('Default')).toBeInTheDocument();
    expect(within(cards[1]!).queryByText('Default')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('no card number, no token and no CVC is ever rendered: the page text holds no run of 8+ digits and no "tok_"', () => {
    renderWithProviders(<PaymentMethodList methods={[visa, mc]} />);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\d{8,}/);
    expect(text).not.toMatch(/tok_|token|cvc|cvv/i);
    expect(document.body.innerHTML).not.toMatch(/tok_|value="\d{13,}"/);
    expect(document.querySelector('input')).toBeNull();
  });

  it('a card without a readable last four shows only the brand, never a broken number', () => {
    renderWithProviders(<PaymentMethodList methods={[{ ...visa, last4: '', expMonth: null, expYear: null }]} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/^Visa$/);
    expect(screen.queryByText(/Expires/)).toBeNull();
  });
});

describe('payment-methods › No methods saved', () => {
  it('states the absence plainly with a path to add one, not an empty table', () => {
    renderWithProviders(<PaymentMethodList methods={[]} />);
    expect(screen.getByText('No payment methods saved.')).toBeInTheDocument();
    expect(screen.getByText(/You can save a card while you pay at checkout/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your cart' })).toHaveAttribute('href', '/en-US/cart');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('a failed read says so without breaking the page', () => {
    renderWithProviders(<PaymentMethodList methods={null} />);
    expect(screen.getByText('We could not load your payment methods. Please try again.')).toBeInTheDocument();
  });
});

describe('payment-methods › Default method removed (page)', () => {
  it('removing the default says no card is the default now and that the next checkout asks; another card is not promoted', async () => {
    answer({ methods: [mc.id ? { ...mc, isDefault: false } : mc], wasDefault: true, pausedRefills: 0 });
    renderWithProviders(<PaymentMethodList methods={[visa, mc]} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove Visa ending 4242' }));
    const notice = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-method-notice="defaultRemoved"]');
      if (!el) throw new Error('none');
      return el;
    });
    expect(notice).toHaveTextContent('No card is the default now: you will choose one at your next checkout.');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/payment-methods/pm1');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('DELETE');
    expect(refresh).toHaveBeenCalled();
  });

  it('removing a card that is not the default just says it was removed', async () => {
    answer({ methods: [visa], wasDefault: false, pausedRefills: 0 });
    renderWithProviders(<PaymentMethodList methods={[visa, mc]} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove Mastercard ending 4444' }));
    expect(await screen.findByText('Card removed.')).toBeInTheDocument();
  });

  it('when an active auto-refill is charged to the card it WARNS first and removes only after the buyer confirms', async () => {
    answer({ code: 'REFILL_DEPENDS', count: 2 }, 409);
    answer({ methods: [], wasDefault: true, pausedRefills: 2 });
    renderWithProviders(<PaymentMethodList methods={[visa]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove Visa ending 4242' }));
    const warning = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-refill-warning]');
      if (!el) throw new Error('none');
      return el;
    });
    expect(warning).toHaveTextContent('2 auto-refills are charged to this card. If you remove it, they will be paused.');
    expect(refresh).not.toHaveBeenCalled();
    await user.click(within(warning).getByRole('button', { name: 'Remove and pause' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/payment-methods/pm1?confirm=1');
    expect(await screen.findByText(/2 auto-refills were paused because it was charged to this card/)).toBeInTheDocument();
  });

  it('Keep this card dismisses the warning and nothing is removed', async () => {
    answer({ code: 'REFILL_DEPENDS', count: 1 }, 409);
    renderWithProviders(<PaymentMethodList methods={[visa]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove Visa ending 4242' }));
    await user.click(await screen.findByRole('button', { name: 'Keep this card' }));
    expect(document.querySelector('[data-refill-warning]')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('payment-methods: make default', () => {
  it('posts to the default route and refreshes; the default card offers no "Make default"', async () => {
    answer({ methods: [mc, visa] });
    renderWithProviders(<PaymentMethodList methods={[visa, mc]} />);
    expect(screen.queryByRole('button', { name: 'Make Visa ending 4242 the default' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Make Mastercard ending 4444 the default' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/payment-methods/pm2/default');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
  });

  it('a failure is an alert, nothing refreshes', async () => {
    answer({ error: 'x' }, 500);
    renderWithProviders(<PaymentMethodList methods={[visa, mc]} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Make Mastercard ending 4444 the default' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not do that.');
    expect(refresh).not.toHaveBeenCalled();
  });
});

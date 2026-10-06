import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SlotDay } from '@/lib/slots/types';
import type { Cart } from '@/lib/types';
import { makeCart, renderWithCart } from '@/test/cart';
import { CartDeliveryStep } from './CartDeliveryStep';

type Handler = (url: string, init?: RequestInit) => { body: unknown; status?: number };

function stubFetch(handler: Handler) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const { body, status = 200 } = handler(url, init);
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const address = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', postalCode: '10001', city: 'New York', country: 'US' };
const slot = (id: string, remaining = 6) => {
  const hour = Number(id.slice(9));
  const date = `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`;
  return {
    id,
    start: `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`,
    end: `${date}T${String(hour + 2).padStart(2, '0')}:00:00.000Z`,
    remaining,
  };
};
const days: SlotDay[] = [
  { date: '2026-10-12', slots: [slot('20261012-10'), slot('20261012-12')] },
  { date: '2026-10-13', slots: [slot('20261013-08', 1)] },
  { date: '2026-10-14', slots: [] },
];
const withAddress = (over: Partial<Cart> = {}) => makeCart({ shippingAddress: address, ...over });
const chosen = { id: '20261012-10', start: '2026-10-12T10:00:00.000Z', end: '2026-10-12T12:00:00.000Z', holdExpires: '2099-01-01T00:00:00.000Z' };

const fill = (values: Record<string, string>) => {
  for (const [label, value] of Object.entries(values)) fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

afterEach(() => vi.unstubAllGlobals());

describe('CartDeliveryStep', () => {
  it('no address yet: only the address form, no slot picker, no slot request', () => {
    const fetch = stubFetch(() => ({ body: {} }));
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    expect(screen.getByRole('heading', { name: 'Delivery' })).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.queryByText('Delivery slot')).not.toBeInTheDocument();
    expect(fetch.mock.calls.filter(([url]) => url !== '/api/cart')).toEqual([]);
  });

  it('country defaults to the shopper market', () => {
    stubFetch(() => ({ body: {} }));
    renderWithCart(<CartDeliveryStep />, { cart: makeCart(), locale: 'de-DE' });
    expect(screen.getByLabelText('Land')).toHaveValue('DE');
  });

  it('Invalid postcode shows an inline error and sends nothing', async () => {
    const fetch = stubFetch(() => ({ body: {} }));
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    fill({ 'First name': 'Ada', 'Last name': 'L', 'Street and number': '1 Main St', Postcode: '1234', City: 'NYC' });
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('Enter a valid postcode.')).toBeInTheDocument();
    expect(screen.getByLabelText('Postcode')).toHaveAttribute('aria-invalid', 'true');
    expect(fetch.mock.calls.filter(([url]) => url !== '/api/cart')).toEqual([]);
  });

  it('Missing required fields are flagged inline', async () => {
    stubFetch(() => ({ body: {} }));
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(5);
  });

  it('Valid address: saves it, then the slot picker lists the days and times', async () => {
    let cart: Cart = makeCart();
    const fetch = stubFetch((url, init) => {
      if (url === '/api/cart/address' && init?.method === 'PUT') {
        cart = withAddress();
        return { body: { cart, slotCleared: false } };
      }
      if (url === '/api/slots') return { body: { days } };
      return { body: { cart } };
    });
    renderWithCart(<CartDeliveryStep />, { cart });
    fill({ 'First name': 'Ada', 'Last name': 'Lovelace', 'Street and number': '1 Main St', Postcode: '10001', City: 'New York' });
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));

    expect(await screen.findByRole('radio', { name: /10:00–12:00/ })).toBeInTheDocument();
    const put = fetch.mock.calls.find(([url]) => url === '/api/cart/address');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ ...address, country: 'US' });
    expect(screen.getByRole('radio', { name: /12:00–14:00/ })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Delivery day' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Wed/ })).toBeDisabled(); // 2026-10-14 has no capacity
  });

  it('Pick a slot: calls the endpoint and the card is selected', async () => {
    let cart = withAddress();
    const fetch = stubFetch((url, init) => {
      if (url === '/api/slots') return { body: { days } };
      if (url === '/api/cart/slot' && init?.method === 'PUT') {
        cart = withAddress({ slot: chosen });
        return { body: { cart } };
      }
      return { body: { cart } };
    });
    renderWithCart(<CartDeliveryStep />, { cart });
    const radio = await screen.findByRole('radio', { name: /10:00–12:00/ });
    expect(radio).not.toBeChecked();
    fireEvent.click(radio);
    await waitFor(() => expect(screen.getByRole('radio', { name: /10:00–12:00/ })).toBeChecked());
    const put = fetch.mock.calls.find(([url]) => url === '/api/cart/slot');
    expect(put?.[1]?.method).toBe('PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ slotId: '20261012-10' });
  });

  it('The day tab switches the list of windows', async () => {
    stubFetch((url) => (url === '/api/slots' ? { body: { days } } : { body: { cart: withAddress() } }));
    renderWithCart(<CartDeliveryStep />, { cart: withAddress() });
    await screen.findByRole('radio', { name: /10:00–12:00/ });
    fireEvent.click(screen.getByRole('radio', { name: /Tue/ }));
    expect(await screen.findByRole('radio', { name: /08:00–10:00/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /10:00–12:00/ })).not.toBeInTheDocument();
  });

  it('The chosen slot opens on its own day', async () => {
    const onTuesday = { ...chosen, id: '20261013-08', start: '2026-10-13T08:00:00.000Z', end: '2026-10-13T10:00:00.000Z' };
    stubFetch((url) => (url === '/api/slots' ? { body: { days } } : { body: {} }));
    renderWithCart(<CartDeliveryStep />, { cart: withAddress({ slot: onTuesday }) });
    expect(await screen.findByRole('radio', { name: /08:00–10:00/ })).toBeChecked();
  });

  it('No capacity: shows the message and the next available date', async () => {
    stubFetch((url) =>
      url === '/api/slots' ? { body: { days: days.map((d) => ({ ...d, slots: [] })), nextAvailableDate: '2026-10-20' } } : { body: {} },
    );
    renderWithCart(<CartDeliveryStep />, { cart: withAddress() });
    expect(await screen.findByText('No delivery slots are available for this address right now.')).toBeInTheDocument();
    expect(screen.getByText(/Next available: Tuesday, Oct 20/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /:00/ })).not.toBeInTheDocument();
  });

  it('Slot taken meanwhile: the list refreshes from the 409 answer and a message is shown', async () => {
    const fresh: SlotDay[] = [{ date: '2026-10-12', slots: [slot('20261012-12')] }];
    stubFetch((url, init) => {
      if (url === '/api/slots') return { body: { days } };
      if (url === '/api/cart/slot' && init?.method === 'PUT') return { status: 409, body: { error: 'SLOT_FULL', days: fresh } };
      return { body: {} };
    });
    renderWithCart(<CartDeliveryStep />, { cart: withAddress() });
    fireEvent.click(await screen.findByRole('radio', { name: /10:00–12:00/ }));
    expect(await screen.findByText('That slot was just taken. Please pick another.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('radio', { name: /10:00–12:00/ })).not.toBeInTheDocument());
    expect(screen.getByRole('radio', { name: /12:00–14:00/ })).toBeInTheDocument();
  });

  it('Slot cleared notice: an undeliverable postcode shows the error, the notice and hides the picker', async () => {
    const before = withAddress({ slot: chosen });
    const after = withAddress({ shippingAddress: { ...address, postalCode: '99999' } });
    stubFetch((url, init) => {
      if (url === '/api/slots') return { body: { days } };
      if (url === '/api/cart/address' && init?.method === 'PUT') return { status: 422, body: { error: 'UNDELIVERABLE', slotCleared: true, cart: after } };
      return { body: { cart: after } };
    });
    renderWithCart(<CartDeliveryStep />, { cart: before });
    await screen.findByRole('radio', { name: /10:00–12:00/ });
    fill({ Postcode: '99999' });
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('We do not deliver to this postcode yet.')).toBeInTheDocument();
    expect(screen.getByText('Your delivery slot was removed because the address changed. Please choose a new one.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('radio', { name: /:00–/ })).not.toBeInTheDocument());
  });

  it('A slot whose hold ran out is not shown as chosen and the shopper is told', async () => {
    const expired = { ...chosen, holdExpires: '2020-01-01T00:00:00.000Z' };
    stubFetch((url) => (url === '/api/slots' ? { body: { days } } : { body: {} }));
    renderWithCart(<CartDeliveryStep />, { cart: withAddress({ slot: expired }) });
    expect(await screen.findByText('Your slot reservation ran out. Please choose a slot again.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /10:00–12:00/ })).not.toBeChecked();
  });

  it('Country mismatch is shown on the country field', async () => {
    stubFetch(() => ({ status: 422, body: { error: 'COUNTRY_MISMATCH' } }));
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    fill({ 'First name': 'Ada', 'Last name': 'L', 'Street and number': '1 Main St', Postcode: '10115', City: 'Berlin', Country: 'DE' });
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText(/needs the other store/)).toBeInTheDocument();
  });
});

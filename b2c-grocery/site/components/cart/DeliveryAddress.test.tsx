import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cart, SavedAddress } from '@/lib/types';
import { makeCart, renderWithCart } from '@/test/cart';
import { CartDeliveryStep } from './CartDeliveryStep';

const saved = (id: string, extra: Partial<SavedAddress> = {}): SavedAddress => ({
  id,
  firstName: 'Ada',
  lastName: id.toUpperCase(),
  streetName: `${id} Main St`,
  postalCode: '94105',
  city: 'San Francisco',
  country: 'US',
  isDefaultShipping: false,
  isDefaultBilling: false,
  ...extra,
});
const user = { id: 'c1', email: 'a@example.com', firstName: 'Ada', lastName: 'L' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

type Options = { user?: typeof user | null; addresses?: SavedAddress[]; cart?: Cart; putStatus?: number; putBody?: unknown };

/** Stateful stub: `PUT /api/cart/address` answers with a cart holding the sent address, like the real route. */
function stubApi({ user: account = user, addresses = [], cart = makeCart(), putStatus = 200, putBody }: Options = {}) {
  let current = cart;
  const puts: Record<string, string>[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/me') return json({ user: account });
    if (url === '/api/account/addresses') return json({ addresses });
    if (url === '/api/cart') return json({ cart: current });
    if (url === '/api/cart/address' && init?.method === 'PUT') {
      const sent = JSON.parse(String(init.body)) as Record<string, string>;
      puts.push(sent);
      if (putStatus !== 200) return json(putBody ?? { error: 'ERROR' }, putStatus);
      current = { ...current, shippingAddress: sent as unknown as Cart['shippingAddress'] };
      return json({ cart: current, slotCleared: false });
    }
    if (url === '/api/slots') return json({ days: [] });
    throw new Error(`unexpected ${init?.method ?? 'GET'} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { puts, fetchMock };
}

afterEach(() => vi.unstubAllGlobals());

const radios = () => screen.getAllByRole('radio');

describe('Delivery step with saved addresses', () => {
  it('Pick saved address: the default is preselected and applied to the cart', async () => {
    const { puts } = stubApi({ addresses: [saved('a1'), saved('a2', { isDefaultShipping: true })] });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ firstName: 'Ada', lastName: 'A2', streetName: 'a2 Main St', postalCode: '94105', city: 'San Francisco', country: 'US' });
    await waitFor(() => expect(radios()[1]).toBeChecked());
    expect(radios()).toHaveLength(3);
    expect(radios()[0]).not.toBeChecked();
    expect(screen.getByText('Default')).toHaveClass('tag-accent-2');
    // The manual form stays hidden until "Add a new address" is chosen.
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
  });

  it('picking another saved address calls the cart address endpoint with it', async () => {
    const { puts } = stubApi({ addresses: [saved('a1'), saved('a2', { isDefaultShipping: true, additionalStreetInfo: 'Apt 4', phone: '+1 415 555 0100' })] });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    await waitFor(() => expect(puts).toHaveLength(1));
    await waitFor(() => expect(radios()[1]).toBeChecked());
    await userEvent.click(radios()[0]);
    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1]).toMatchObject({ streetName: 'a1 Main St', lastName: 'A1' });
    expect(puts[1]).not.toHaveProperty('additionalStreetInfo');
    await waitFor(() => expect(radios()[0]).toBeChecked());
  });

  it('a saved address with optional parts sends them', async () => {
    const { puts } = stubApi({ addresses: [saved('a1', { isDefaultShipping: true, additionalStreetInfo: 'Apt 4', phone: '+1 415 555 0100' })] });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({ additionalStreetInfo: 'Apt 4', phone: '+1 415 555 0100' });
  });

  it('"Add a new address" shows the manual form and sends nothing by itself', async () => {
    const { puts } = stubApi({ addresses: [saved('a1', { isDefaultShipping: true })] });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    await waitFor(() => expect(puts).toHaveLength(1));
    await waitFor(() => expect(radios()[0]).toBeChecked());
    await userEvent.click(screen.getByRole('radio', { name: 'Add a new address' }));
    expect(await screen.findByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Add a new address' })).toBeChecked();
    expect(puts).toHaveLength(1);
  });

  it('a cart that already has a saved address selects it and does not apply the default', async () => {
    const a1 = saved('a1');
    const { puts } = stubApi({
      addresses: [a1, saved('a2', { isDefaultShipping: true })],
      cart: makeCart({ shippingAddress: { firstName: 'Ada', lastName: 'A1', streetName: 'a1 Main St', postalCode: '94105', city: 'San Francisco', country: 'US' } }),
    });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart({ shippingAddress: { firstName: 'Ada', lastName: 'A1', streetName: 'a1 Main St', postalCode: '94105', city: 'San Francisco', country: 'US' } }) });
    await waitFor(() => expect(radios()).toHaveLength(3));
    expect(radios()[0]).toBeChecked();
    expect(puts).toEqual([]);
  });

  it('a cart address that is not a saved one stays and shows in the form under "Add a new address"', async () => {
    const typed = { firstName: 'Zed', lastName: 'Z', streetName: '5 Elm', postalCode: '10001', city: 'New York', country: 'US' };
    const { puts } = stubApi({ addresses: [saved('a1', { isDefaultShipping: true })], cart: makeCart({ shippingAddress: typed }) });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart({ shippingAddress: typed }) });
    await waitFor(() => expect(radios()).toHaveLength(2));
    expect(screen.getByRole('radio', { name: 'Add a new address' })).toBeChecked();
    expect(await screen.findByLabelText('First name')).toHaveValue('Zed');
    expect(puts).toEqual([]);
  });

  it('an address for the other country is disabled and the default is not applied', async () => {
    const { puts } = stubApi({ addresses: [saved('de1', { country: 'DE', postalCode: '10115', isDefaultShipping: true })] });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    await waitFor(() => expect(radios()).toHaveLength(2));
    const dialogRadio = radios()[0];
    expect(dialogRadio).toBeDisabled();
    expect(screen.getByText(/needs the other store/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Add a new address' })).toBeChecked();
    expect(puts).toEqual([]);
  });

  it('a failing pick shows the message and keeps the picker', async () => {
    const { puts } = stubApi({ addresses: [saved('a1', { isDefaultShipping: true })], putStatus: 422, putBody: { error: 'UNDELIVERABLE' } });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('We do not deliver to this postcode yet.');
    expect(radios()).toHaveLength(2);
  });

  it('German locale: DE addresses are usable, US ones are not', async () => {
    const { puts } = stubApi({ addresses: [saved('us1'), saved('de1', { country: 'DE', postalCode: '10115', city: 'Berlin', isDefaultShipping: true })] });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart({ currencyCode: 'EUR' }), locale: 'de-DE' });
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({ country: 'DE', city: 'Berlin' });
    expect(radios()[0]).toBeDisabled();
  });

  it('Anonymous shopper: only the manual form, saved addresses are never requested', async () => {
    const { fetchMock } = stubApi({ user: null });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    expect(await screen.findByLabelText('First name')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => u === '/api/auth/me')).toBe(true));
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/account/addresses')).toBe(false);
  });

  it('Signed in without saved addresses: the manual form, no radios', async () => {
    const { fetchMock } = stubApi({ addresses: [] });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => u === '/api/account/addresses')).toBe(true));
    await waitFor(() => expect(screen.queryByText('Loading your saved addresses...')).not.toBeInTheDocument());
    expect(await screen.findByLabelText('First name')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('the picker is a labelled group', async () => {
    stubApi({ addresses: [saved('a1', { isDefaultShipping: true })] });
    renderWithCart(<CartDeliveryStep />, { cart: makeCart() });
    const group = await screen.findByRole('group', { name: 'Saved addresses' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
  });
});

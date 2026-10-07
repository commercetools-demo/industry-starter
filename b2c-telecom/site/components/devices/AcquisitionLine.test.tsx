import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { BundleView } from '@/components/bundle/BundleView';
import { NOVA_5G_128, NOVA_PRO_256, deviceLine, usd } from '@/lib/devices/__fixtures__/devices';
import type { Cart, CartLine } from '@/lib/types';
import { makeCart } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const LINKS = [{ key: 'phone', href: '/shop/phone-plans' }] as const;

const installments = (id = 'D1', patch: Partial<CartLine> = {}): CartLine =>
  deviceLine(id, { mode: 'installments', termMonths: 24, endOfTerm: 'owned-after-final-payment' }, usd(4200), 1, { device: { color: 'black', memoryGb: 256, prices: NOVA_PRO_256 }, ...patch });
const lease = (id = 'D2'): CartLine => deviceLine(id, { mode: 'lease', termMonths: 24, endOfTerm: 'return' }, usd(3300), 1, { device: { color: 'black', memoryGb: 256, prices: NOVA_PRO_256 } });
const outright = (id = 'D3'): CartLine => deviceLine(id, { mode: 'outright', termMonths: 0, endOfTerm: 'owned' }, usd(100800), 1, { device: { color: 'silver', memoryGb: 256, prices: NOVA_PRO_256 } });

/** A server whose cart is what the last successful mutation answered, so a revalidation never brings back an older cart. */
function stubServer(initial: Cart, onMutation: (url: string, init: RequestInit) => Promise<Response>) {
  let current = initial;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/cart') return reply(200, { cart: current });
    if (url === '/api/cart/prompts') return reply(200, { prompts: [] });
    const response = await onMutation(url, init ?? {});
    if (response.ok) current = ((await response.clone().json()) as { cart: Cart }).cart;
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const show = (cart: Cart) => renderWithProviders(<BundleView initialCart={cart} signedIn links={[...LINKS]} />);

afterEach(() => vi.unstubAllGlobals());

describe('AcquisitionLine in My bundle', () => {
  it('states the mode, the term, what is due today and monthly, and the end of term', () => {
    const cart = makeCart({ lines: [installments()] });
    stubServer(cart, async () => reply(200, { cart }));
    show(cart);
    expect(screen.getByRole('heading', { level: 2, name: 'Devices' })).toBeInTheDocument();
    expect(screen.getByText('Nova Pro')).toBeInTheDocument();
    expect(screen.getByText('Black · 256 GB')).toBeInTheDocument();
    expect(screen.getByText('Installments · Over 24 months')).toBeInTheDocument();
    expect(screen.getByText('Then $42.00/mo for 23 more months')).toBeInTheDocument();
    expect(screen.getByText('Total payable: $1,008.00')).toBeInTheDocument();
    expect(screen.getByText(/You own the device after your final payment on .*\. Estimated, if you order today\./)).toBeInTheDocument();
  });

  it('a recorded end date (after the financing decision) is stated without the estimate label', () => {
    const cart = makeCart({ lines: [lease()].map((line) => ({ ...line, acquisition: { ...(line.acquisition as NonNullable<CartLine['acquisition']>), endDate: '2028-10-07' } })) });
    stubServer(cart, async () => reply(200, { cart }));
    show(cart);
    const notice = screen.getByText(/At the end of the lease you must return the device by October 7, 2028/);
    expect(notice).not.toHaveTextContent('Estimated');
  });

  it('Mode changed before checkout: due now, recurring amount and term are restated', async () => {
    const before = makeCart({ lines: [installments('D1')] });
    const after = makeCart({ version: 5, lines: [lease('D9')] });
    const fetchMock = stubServer(before, async () => reply(200, { cart: after }));
    show(before);
    expect(screen.getByText('Then $42.00/mo for 23 more months')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Change how you pay' }));
    fireEvent.click(screen.getByRole('radio', { name: /Lease/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(screen.getByText('Then $33.00/mo for 23 more months')).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls.find(([target]) => String(target).startsWith('/api/cart/devices')) as unknown as [string, RequestInit];
    expect(url).toBe('/api/cart/devices/D1');
    expect(init).toMatchObject({ method: 'PATCH', body: JSON.stringify({ mode: 'lease', termMonths: 24 }) });
    expect(screen.getByText('Lease · Over 24 months')).toBeInTheDocument();
    expect(screen.getByText('Total payable: $792.00')).toBeInTheDocument();
    expect(screen.getByText(/At the end of the lease you must return the device by/)).toBeInTheDocument();
    expect(screen.queryByText('Then $42.00/mo for 23 more months')).toBeNull();
    // the picker is closed again
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  });

  it('back to pay in full: the term and the monthly amount disappear', async () => {
    const before = makeCart({ lines: [installments('D1')] });
    stubServer(before, async () => reply(200, { cart: makeCart({ version: 5, lines: [outright('D8')] }) }));
    show(before);
    fireEvent.click(screen.getByRole('button', { name: 'Change how you pay' }));
    fireEvent.click(screen.getByRole('radio', { name: /Pay in full/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(screen.getByText('You own the device from day one.')).toBeInTheDocument());
    expect(screen.queryByText(/Then \$/)).toBeNull();
    expect(screen.getByText('Pay in full')).toBeInTheDocument();
  });

  it('Update stays disabled until the choice differs, and Cancel closes the picker without a request', () => {
    const cart = makeCart({ lines: [installments()] });
    const fetchMock = stubServer(cart, async () => reply(200, { cart }));
    show(cart);
    fireEvent.click(screen.getByRole('button', { name: 'Change how you pay' }));
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: '36 months' }));
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('radiogroup', { name: 'Installment term' })).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/cart/devices'))).toBe(false);
  });

  it('a mode the device does not have is disabled in the picker, with the reason', () => {
    const cart = makeCart({ lines: [installments('D1', { device: { color: 'black', memoryGb: 128, prices: NOVA_5G_128 }, name: 'Nova 5G' })] });
    stubServer(cart, async () => reply(200, { cart }));
    show(cart);
    fireEvent.click(screen.getByRole('button', { name: 'Change how you pay' }));
    expect(screen.getByRole('radio', { name: /Lease/ })).toBeDisabled();
    expect(screen.getByText('Not available for Nova 5G')).toBeInTheDocument();
  });

  it('a refusal is said in words on the line and the line is unchanged', async () => {
    const cart = makeCart({ lines: [installments()] });
    stubServer(cart, async () => reply(422, { error: { code: 'PRICE_NOT_FOR_TERM', message: 'x', details: { check: 'price-has-no-policy' } }, cart }));
    show(cart);
    fireEvent.click(screen.getByRole('button', { name: 'Change how you pay' }));
    fireEvent.click(screen.getByRole('radio', { name: /Lease/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This device has no price for that term, so it was not added.');
    expect(screen.getByText('Then $42.00/mo for 23 more months')).toBeInTheDocument();
  });

  it('removing the line calls the line route', async () => {
    const cart = makeCart({ lines: [installments()] });
    const fetchMock = stubServer(cart, async () => reply(200, { cart: makeCart({ lines: [] }) }));
    show(cart);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Nova Pro' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/cart/line-items/D1' && (init as RequestInit).method === 'DELETE')).toBe(true));
  });

  it('a line without price data has no change button; German copy follows the locale', () => {
    const cart = makeCart({ lines: [installments('D1', { device: undefined })] });
    stubServer(cart, async () => reply(200, { cart }));
    renderWithProviders(<BundleView initialCart={cart} signedIn links={[...LINKS]} />, { locale: 'de-DE' });
    expect(screen.queryByRole('button', { name: 'Zahlungsart ändern' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Geräte' })).toBeInTheDocument();
    expect(screen.getByText('Ratenzahlung · Über 24 Monate')).toBeInTheDocument();
    const summary = screen.getAllByText('Heute fällig')[0]?.closest('div') as HTMLElement;
    expect(within(summary).getByText(/42,00/)).toBeInTheDocument();
  });
});

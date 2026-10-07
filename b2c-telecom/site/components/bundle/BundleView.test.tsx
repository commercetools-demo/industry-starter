import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cart, DiscountPrompt } from '@/lib/types';
import { addonLine, feeLine, makeCart, phoneLine, planLine, usd } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';
import { BundleView } from './BundleView';

const links = [
  { key: 'phone', href: '/shop/phone-plans' },
  { key: 'wireless', href: '/shop/home-wireless-internet' },
  { key: 'cable', href: '/shop/cable-internet' },
] as const;

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

function stubServer(cart: Cart | null, prompts: DiscountPrompt[] = [], onMutation?: (url: string, init: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/cart') return reply(200, { cart });
    if (url === '/api/cart/prompts') return reply(200, { prompts });
    return onMutation ? onMutation(url, init ?? {}) : reply(200, { cart });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('BundleView', () => {
  it('Empty cart: empty state with category links and no summary block with zero totals', () => {
    stubServer(null);
    renderWithProviders(<BundleView initialCart={null} signedIn={false} links={[...links]} />);
    expect(screen.getByRole('heading', { name: 'Your bundle is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cable internet' })).toHaveAttribute('href', '/en-US/shop/cable-internet');
    expect(screen.queryByRole('complementary', { name: 'Order summary' })).not.toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('a cart without lines is the empty state too', () => {
    stubServer(makeCart({ lines: [] }));
    renderWithProviders(<BundleView initialCart={makeCart({ lines: [] })} signedIn links={[...links]} />);
    expect(screen.getByRole('heading', { name: 'Your bundle is empty' })).toBeInTheDocument();
  });

  it('full state renders plans, add-ons and the summary on the first render (no flash of the empty state)', () => {
    const cart = makeCart({ lines: [planLine(), addonLine(), feeLine()] });
    stubServer(cart);
    renderWithProviders(<BundleView initialCart={cart} signedIn links={[...links]} />);
    expect(screen.getByRole('heading', { name: 'Plans' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add-ons' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cable 500' })).toBeInTheDocument();
    expect(screen.getByText('For Cable 500')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Order summary' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your bundle is empty' })).not.toBeInTheDocument();
    // the activation fee is a summary line, not a row
    expect(screen.queryByText('Activation fee')).toBeInTheDocument();
  });

  it('with no add-ons: "No add-ons yet" and a link to browse them', () => {
    const cart = makeCart({ lines: [planLine(), feeLine()] });
    stubServer(cart);
    renderWithProviders(<BundleView initialCart={cart} signedIn links={[...links]} />);
    expect(screen.getByText(/No add-ons yet\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse add-ons' })).toHaveAttribute('href', '/en-US/shop/add-ons');
  });

  it('an anonymous visitor sees "Check out" and the login link; a signed-in buyer only "Check out"', () => {
    const cart = makeCart();
    stubServer(cart);
    const first = renderWithProviders(<BundleView initialCart={cart} signedIn={false} links={[...links]} />);
    expect(screen.getByRole('link', { name: 'Check out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in to check out with your account' })).toBeInTheDocument();
    first.unmount();
    renderWithProviders(<BundleView initialCart={cart} signedIn links={[...links]} />);
    expect(screen.getByRole('link', { name: 'Check out' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in to check out with your account' })).not.toBeInTheDocument();
  });

  it('Quantity changed: the stepper sends one PATCH and the page shows the server cart', async () => {
    const before = makeCart({ lines: [phoneLine()] });
    const after = makeCart({ version: 5, lines: [phoneLine({ quantity: 2, total: usd(11000) })] });
    const fetchMock = stubServer(before, [], async () => reply(200, { cart: after }));
    renderWithProviders(<BundleView initialCart={before} signedIn links={[...links]} />);
    await userEvent.click(screen.getByRole('button', { name: 'More lines' }));
    await waitFor(() => expect(screen.getByRole('group', { name: 'Number of lines' })).toHaveTextContent('2'));
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/cart/line-items/P1');
    expect(call?.[1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ quantity: 2 }) });
    expect(within(screen.getByRole('complementary', { name: 'Order summary' })).getAllByText('$110.00').length).toBeGreaterThan(0);
  });

  it('a refused add shows the reason, keeps the server cart and offers no override', async () => {
    const cart = makeCart({ lines: [planLine(), feeLine()] });
    const prompt: DiscountPrompt = {
      pairingKey: 'bundle-cable-phone',
      discountKey: 'malva-cd-bundle-5',
      candidate: { offerKey: 'malva-offer-phone-essential', sku: 'MLV-PHN-ESS-M2M', name: 'Essential 5GB', quantity: 1, termMonths: 0 },
      saving: usd(500),
      messageKey: 'bundle.prompt.cablePhone',
      params: { name: 'Essential 5GB' },
    };
    const blocked = { kind: 'ineligible', offerKey: 'malva-offer-phone-essential', reasons: [{ code: 'NOT_ELIGIBLE_AUDIENCE', messageKey: 'offers.reason.NOT_ELIGIBLE_AUDIENCE', params: { offerName: 'Essential 5GB' }, offerKeys: [] }] };
    stubServer(cart, [prompt], async () => reply(403, { error: { code: 'OFFER_BLOCKED', message: 'x', details: blocked }, cart }));
    renderWithProviders(<BundleView initialCart={cart} signedIn links={[...links]} />);
    await userEvent.click(await screen.findByRole('button', { name: /^Add Essential 5GB/ }));
    expect(await screen.findByText("Essential 5GB isn't available for your account type.")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cable 500' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Replace/ })).not.toBeInTheDocument();
  });

  it('blocking issues show the banner and block the checkout link', () => {
    const cart = makeCart({
      lines: [planLine()],
      canCheckout: false,
      checkoutBlockedBy: ['ISSUES'],
      issues: [{ code: 'NOT_SERVICEABLE', severity: 'blocking', lineId: 'L1', offerKey: 'malva-offer-cable-500', resolution: 'remove', reasons: [{ code: 'NOT_SERVICEABLE', messageKey: 'offers.reason.NOT_SERVICEABLE', params: { offerName: 'Cable 500', postalCode: '59001' }, offerKeys: [] }] }],
    });
    stubServer(cart);
    renderWithProviders(<BundleView initialCart={cart} signedIn links={[...links]} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Cable 500 isn't available at 59001.");
    expect(screen.queryByRole('link', { name: 'Check out' })).not.toBeInTheDocument();
  });

  it('a prompt shows the saving and adds the suggested line', async () => {
    const cart = makeCart({ lines: [planLine(), feeLine()] });
    const prompt: DiscountPrompt = {
      pairingKey: 'bundle-cable-phone',
      discountKey: 'malva-cd-bundle-5',
      candidate: { offerKey: 'malva-offer-phone-essential', sku: 'MLV-PHN-ESS-M2M', name: 'Essential 5GB', quantity: 1, termMonths: 0 },
      saving: usd(500),
      messageKey: 'bundle.prompt.cablePhone',
      params: { name: 'Essential 5GB' },
    };
    const fetchMock = stubServer(cart, [prompt]);
    renderWithProviders(<BundleView initialCart={cart} signedIn links={[...links]} />);
    expect(await screen.findByText('Save $5.00/mo')).toBeInTheDocument();
    expect(screen.getByText('Add Essential 5GB to your Cable internet and save $5.00/mo.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add Essential 5GB and save $5.00 per month' }));
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/cart/line-items');
    expect(call?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ offerKey: 'malva-offer-phone-essential', sku: 'MLV-PHN-ESS-M2M', quantity: 1 }) });
  });
});

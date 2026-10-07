import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { NOVA_5G, NOVA_PRO } from '@/lib/devices/__fixtures__/devices';
import { renderWithProviders } from '@/test/utils';
import type { ListingCandidates } from './ListingProvider';
import { OfferGrid } from './OfferGrid';

const CANDIDATES: ListingCandidates = {
  addons: [],
  equipment: [],
  plans: [],
  preferredParentLineId: null,
  links: { addons: '/shop/add-ons', internetPlans: '/shop/cable-internet', phonePlans: '/shop/phone-plans' },
};
const DEVICES = { offers: [NOVA_5G, NOVA_PRO], today: '2026-10-07' };
const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe('OfferGrid for devices', () => {
  it('shows one device card per handset, in order, with its prices', () => {
    renderWithProviders(<OfferGrid kind="devices" offers={[]} highlightKey={null} candidates={CANDIDATES} devices={DEVICES} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Nova 5G', 'Nova Pro']);
    expect(screen.getByText('From $20.00/mo')).toBeInTheDocument();
    expect(screen.getByText('From $28.00/mo')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add to bundle' })).toHaveLength(2);
  });

  it('adds through the device route and confirms with the bundle toast', async () => {
    const fetchMock = vi.fn(() => reply(200, { cart: { id: 'c1', version: 2, lines: [], itemCount: 1 } }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<OfferGrid kind="devices" offers={[]} highlightKey={null} candidates={CANDIDATES} devices={DEVICES} />);
    const card = screen.getByRole('heading', { name: 'Nova Pro' }).closest('article') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Add to bundle' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/cart/devices');
    expect(JSON.parse(String(init.body))).toEqual({ offerKey: 'malva-offer-phone-nova-pro', sku: 'MLV-DEV-NOVAPRO-BLK-256', quantity: 1, mode: 'installments', termMonths: 24 });
    expect(await screen.findByText('Nova Pro added to your bundle')).toBeInTheDocument();
  });

  it('a refusal stays on the card in words and shows no toast', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => reply(409, { error: { code: 'TERM_UNAVAILABLE', message: 'x', details: { mode: 'installments', termMonths: 36, availableTerms: [12, 24] } }, cart: null })),
    );
    renderWithProviders(<OfferGrid kind="devices" offers={[]} highlightKey={null} candidates={CANDIDATES} devices={DEVICES} />);
    const card = screen.getByRole('heading', { name: 'Nova Pro' }).closest('article') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Add to bundle' }));
    expect(await within(card).findByRole('alert')).toHaveTextContent('The 36-month term is not available for this color and memory.');
    expect(screen.queryByText(/added to your bundle/)).toBeNull();
  });

  it('the offer of the ?offer= link is outlined and scrolled to', () => {
    const { container } = renderWithProviders(<OfferGrid kind="devices" offers={[]} highlightKey="malva-offer-phone-nova-5g" candidates={CANDIDATES} devices={DEVICES} />);
    const highlighted = container.querySelectorAll('[data-highlighted="true"]');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]).toHaveAttribute('id', 'offer-malva-offer-phone-nova-5g');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('renders an empty grid, not a crash, when no device data came with the page', () => {
    const { container } = renderWithProviders(<OfferGrid kind="devices" offers={[]} highlightKey={null} candidates={CANDIDATES} />);
    expect(container.querySelectorAll('article')).toHaveLength(0);
  });
});

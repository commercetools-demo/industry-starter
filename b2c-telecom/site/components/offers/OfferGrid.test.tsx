import { screen, within } from '@testing-library/react';
import {
  LISTED_ADDONS,
  LISTED_CABLE_100,
  LISTED_CABLE_500,
  LISTED_CABLE_GIG,
  LISTED_EQUIPMENT,
  LISTED_PLANS,
  LISTED_SPOTIFY,
} from '@/lib/listing/__fixtures__/catalog';
import { renderWithProviders } from '@/test/utils';
import { cartOf } from './__fixtures__/cart';
import type { ListingCandidates } from './ListingProvider';

const ctx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/context/CartProvider', () => ({ useCartContext: () => ctx.value }));

import { OfferGrid } from './OfferGrid';

const CANDIDATES: ListingCandidates = {
  addons: LISTED_ADDONS,
  equipment: LISTED_EQUIPMENT,
  plans: LISTED_PLANS,
  preferredParentLineId: null,
  links: { addons: '/shop/add-ons', internetPlans: '/shop/cable-internet', phonePlans: '/shop/phone-plans' },
};

beforeEach(() => {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  ctx.value = { cart: cartOf([]), isLoading: false, itemCount: 0, addLine: vi.fn(), removeLine: vi.fn(), setQuantity: vi.fn() };
});

describe('OfferGrid', () => {
  it('plans: one plan card per offer, in the given order', () => {
    renderWithProviders(<OfferGrid kind="plans" offers={[LISTED_CABLE_100, LISTED_CABLE_500, LISTED_CABLE_GIG]} highlightKey={null} candidates={CANDIDATES} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Cable 100', 'Cable 500', 'Cable Gig']);
    expect(screen.getAllByRole('button', { name: 'Choose plan' })).toHaveLength(3);
  });

  it('add-ons: one add-on card per offer with its toggle', () => {
    renderWithProviders(<OfferGrid kind="addons" offers={[LISTED_SPOTIFY]} highlightKey={null} candidates={CANDIDATES} />);
    expect(screen.getByRole('heading', { name: 'Spotify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs a plan' })).toBeDisabled();
  });

  it('the offer of the ?offer= link is outlined and scrolled to', () => {
    const { container } = renderWithProviders(<OfferGrid kind="plans" offers={[LISTED_CABLE_100, LISTED_CABLE_GIG]} highlightKey="malva-offer-cable-gig" candidates={CANDIDATES} />);
    const highlighted = container.querySelectorAll('[data-highlighted="true"]');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]).toHaveAttribute('id', 'offer-malva-offer-cable-gig');
    expect(within(highlighted[0] as HTMLElement).getByRole('heading', { name: 'Cable Gig' })).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('no highlighted card and no scrolling without an anchor', () => {
    const { container } = renderWithProviders(<OfferGrid kind="plans" offers={[LISTED_CABLE_100]} highlightKey={null} candidates={CANDIDATES} />);
    expect(container.querySelector('[data-highlighted]')).toBeNull();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});

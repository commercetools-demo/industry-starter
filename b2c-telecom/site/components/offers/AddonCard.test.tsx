import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  LISTED_APPLETV,
  LISTED_CABLE_500,
  LISTED_DEVICE_CARE,
  LISTED_PHONE_ESSENTIAL,
  LISTED_PLANS,
  LISTED_ROUTER_AC1200,
  LISTED_SPOTIFY,
} from '@/lib/listing/__fixtures__/catalog';
import type { Cart, Offer } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { blockedError, cartLine, cartOf } from './__fixtures__/cart';
import { ListingProvider } from './ListingProvider';

const ctx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/context/CartProvider', () => ({ useCartContext: () => ctx.value }));

import { AddonCard } from './AddonCard';

const addLine = vi.fn();
const removeLine = vi.fn();
const cable = cartLine({ id: 'cable', offerKey: LISTED_CABLE_500.key, kind: 'plan', quantity: 1 });
const phone = cartLine({ id: 'phone', offerKey: LISTED_PHONE_ESSENTIAL.key, kind: 'plan', quantity: 2 });

function setCart(cart: Cart | null): void {
  ctx.value = { cart, isLoading: false, itemCount: 0, addLine, removeLine };
}

function renderCard(offer: Offer, options: { preferred?: string | null; locale?: 'en-US' | 'de-DE' } = {}) {
  return renderWithProviders(
    <ListingProvider
      candidates={{
        addons: [],
        equipment: [],
        plans: LISTED_PLANS,
        preferredParentLineId: options.preferred ?? null,
        links: { addons: '/shop/add-ons', internetPlans: '/shop/cable-internet', phonePlans: '/shop/phone-plans' },
      }}
    >
      <AddonCard offer={offer} />
    </ListingProvider>,
    { locale: options.locale ?? 'en-US' },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  addLine.mockResolvedValue(null);
  removeLine.mockResolvedValue(null);
  setCart(null);
});

describe('AddonCard', () => {
  it('shows the banner with the name, the tag, the price and "Add to bundle"', () => {
    setCart(cartOf([cable]));
    renderCard(LISTED_SPOTIFY);
    expect(screen.getByRole('heading', { name: 'Spotify' })).toBeInTheDocument();
    expect(screen.getByText('Music')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('/mo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to bundle' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('needs-plan state: disabled "Needs a plan", the reason and a link to choose one', () => {
    renderCard(LISTED_SPOTIFY);
    expect(screen.getByRole('button', { name: 'Needs a plan' })).toBeDisabled();
    expect(screen.getByText('Needs a compatible plan in your bundle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a plan' })).toHaveAttribute('href', '/en-US/shop/cable-internet');
  });

  it('a phone-only add-on sends you to the phone plans', () => {
    setCart(cartOf([cable]));
    renderCard(LISTED_DEVICE_CARE);
    expect(screen.getByRole('button', { name: 'Needs a plan' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Choose a plan' })).toHaveAttribute('href', '/en-US/shop/phone-plans');
  });

  it('an internet-only add-on still needs a plan in a phone-only bundle', () => {
    setCart(cartOf([phone]));
    renderCard(LISTED_APPLETV);
    expect(screen.getByRole('button', { name: 'Needs a plan' })).toBeDisabled();
  });

  it('first compatible parent: adds under the first plan in the bundle that it fits, with that plan\'s quantity', async () => {
    setCart(cartOf([phone, cable]));
    renderCard(LISTED_SPOTIFY);
    await userEvent.click(screen.getByRole('button', { name: 'Add to bundle' }));
    expect(addLine).toHaveBeenCalledWith({ offerKey: 'malva-offer-spotify', sku: 'malva-spotify-sku', quantity: 2, parentLineId: 'phone' });
  });

  it('the plan named by ?for= is the parent when it fits', async () => {
    setCart(cartOf([phone, cable]));
    renderCard(LISTED_SPOTIFY, { preferred: 'cable' });
    await userEvent.click(screen.getByRole('button', { name: 'Add to bundle' }));
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ parentLineId: 'cable' }));
  });

  it('added: filled button; a click removes the line', async () => {
    setCart(cartOf([cable, cartLine({ id: 'sp', offerKey: LISTED_SPOTIFY.key, kind: 'addon', parentLineId: 'cable' })]));
    renderCard(LISTED_SPOTIFY);
    const button = screen.getByRole('button', { name: 'Added ✓' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(button);
    expect(removeLine).toHaveBeenCalledWith('sp');
  });

  it('a plan that fits but is too slow: disabled with the first reason', () => {
    setCart(cartOf([cable]));
    renderCard(LISTED_ROUTER_AC1200);
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
    expect(screen.getByText('Supports up to 300 Mbps; Cable 500 delivers 500 Mbps.')).toBeInTheDocument();
  });

  it('a server refusal shows its reasons and the bundle is not changed', async () => {
    setCart(cartOf([cable]));
    addLine.mockRejectedValueOnce(
      blockedError({
        kind: 'incompatible',
        offerKey: LISTED_SPOTIFY.key,
        reasons: [{ code: 'ALREADY_ATTACHED', messageKey: 'offers.reason.ALREADY_ATTACHED', params: { planName: 'Cable 500' }, offerKeys: [] }],
      }),
    );
    renderCard(LISTED_SPOTIFY);
    await userEvent.click(screen.getByRole('button', { name: 'Add to bundle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Already added to Cable 500.');
  });

  it('is German in de-DE', () => {
    renderCard(LISTED_SPOTIFY, { locale: 'de-DE' });
    expect(screen.getByRole('button', { name: 'Tarif nötig' })).toBeDisabled();
    expect(screen.getByText('Musik')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tarif wählen' })).toHaveAttribute('href', '/de-DE/shop/cable-internet');
  });
});

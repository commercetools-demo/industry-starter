import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LISTED_ADDONS, LISTED_APPLETV, LISTED_CABLE_500, LISTED_CABLE_GIG, LISTED_DEVICE_CARE, LISTED_SPOTIFY } from '@/lib/listing/__fixtures__/catalog';
import type { Cart, CartLine } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { blockedError, cartLine, cartOf } from './__fixtures__/cart';

const ctx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/context/CartProvider', () => ({ useCartContext: () => ctx.value }));

import { AddonPicker } from './AddonPicker';

const addLine = vi.fn();
const removeLine = vi.fn();
const PLAN_LINE = cartLine({ id: 'plan-1', offerKey: LISTED_CABLE_500.key, kind: 'plan', quantity: 1 });

function setCart(cart: Cart | null): void {
  ctx.value = { cart, isLoading: false, itemCount: 0, addLine, removeLine };
}

function renderPicker(planLine: CartLine | undefined, attached: CartLine[] = [], plan = LISTED_CABLE_500, locale: 'en-US' | 'de-DE' = 'en-US') {
  return renderWithProviders(<AddonPicker plan={plan} planLine={planLine} attached={attached} addons={LISTED_ADDONS} browseHref="/shop/add-ons" />, { locale });
}

beforeEach(() => {
  vi.clearAllMocks();
  addLine.mockResolvedValue(null);
  removeLine.mockResolvedValue(null);
  setCart(cartOf([PLAN_LINE]));
});

describe('AddonPicker', () => {
  it('Add-ons reached from the offer being configured: selectable in place; add-ons page still lists them', async () => {
    renderPicker(PLAN_LINE);
    const spotify = screen.getByRole('checkbox', { name: /Spotify/ });
    expect(spotify).toBeEnabled();
    await userEvent.click(spotify);
    expect(addLine).toHaveBeenCalledWith({ offerKey: 'malva-offer-spotify', sku: 'malva-spotify-sku', quantity: 1, parentLineId: 'plan-1' });
    expect(screen.getByRole('link', { name: 'Browse all add-ons' })).toHaveAttribute('href', '/en-US/shop/add-ons');
  });

  it('a phone-only add-on is not listed on an internet card', () => {
    renderPicker(PLAN_LINE);
    expect(screen.queryByText(LISTED_DEVICE_CARE.name)).toBeNull();
    expect(screen.getByText(LISTED_APPLETV.name)).toBeInTheDocument();
  });

  it('before the plan is chosen the rows are shown but cannot be changed', async () => {
    renderPicker(undefined);
    const spotify = screen.getByRole('checkbox', { name: /Spotify/ });
    expect(spotify).toBeDisabled();
    await userEvent.click(spotify);
    expect(addLine).not.toHaveBeenCalled();
  });

  it('an included add-on is checked, disabled and says "Included"', () => {
    renderPicker({ ...PLAN_LINE, offerKey: LISTED_CABLE_GIG.key }, [], LISTED_CABLE_GIG);
    const appletv = screen.getByRole('checkbox', { name: /Apple TV\+/ });
    expect(appletv).toBeChecked();
    expect(appletv).toBeDisabled();
    expect(screen.getByText('Included')).toBeInTheDocument();
  });

  it('an attached add-on is checked and unchecking removes its line', async () => {
    const line = cartLine({ id: 'sp-1', offerKey: LISTED_SPOTIFY.key, kind: 'addon', parentLineId: 'plan-1' });
    renderPicker(PLAN_LINE, [line]);
    const spotify = screen.getByRole('checkbox', { name: /Spotify/ });
    expect(spotify).toBeChecked();
    await userEvent.click(spotify);
    expect(removeLine).toHaveBeenCalledWith('sp-1');
  });

  it('the add-on quantity follows the plan lines (phone plans)', async () => {
    const phone = LISTED_ADDONS.find((offer) => offer.key === 'malva-offer-cloud-200');
    expect(phone).toBeDefined();
    renderWithProviders(
      <AddonPicker plan={{ ...LISTED_CABLE_500, key: 'malva-offer-phone-unlimited', facts: { ...(LISTED_CABLE_500.facts as object), family: 'phone', technology: 'mobile' } as typeof LISTED_CABLE_500.facts }} planLine={{ ...PLAN_LINE, quantity: 3 }} attached={[]} addons={LISTED_ADDONS} browseHref={null} />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /Cloud 200GB/ }));
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ offerKey: 'malva-offer-cloud-200', quantity: 3, parentLineId: 'plan-1' }));
  });

  it('Server re-checks what the card allowed: a refusal leaves the box unchecked and shows the reason', async () => {
    addLine.mockRejectedValueOnce(
      blockedError({
        kind: 'incompatible',
        offerKey: LISTED_SPOTIFY.key,
        reasons: [{ code: 'DECLARED_INCOMPATIBLE', messageKey: 'offers.reason.DECLARED_INCOMPATIBLE', params: { planName: 'Cable 500' }, offerKeys: [] }],
      }),
    );
    renderPicker(PLAN_LINE);
    const spotify = screen.getByRole('checkbox', { name: /Spotify/ });
    await userEvent.click(spotify);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not compatible with Cable 500.'));
    expect(spotify).not.toBeChecked();
  });

  it('labels and prices are German in de-DE', () => {
    renderPicker(PLAN_LINE, [], LISTED_CABLE_500, 'de-DE');
    expect(screen.getByText('Zusatzoptionen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alle Zusatzoptionen ansehen' })).toHaveAttribute('href', '/de-DE/shop/add-ons');
  });
});

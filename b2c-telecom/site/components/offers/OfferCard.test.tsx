import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  LISTED_ADDONS,
  LISTED_CABLE_500,
  LISTED_EQUIPMENT,
  LISTED_PHONE_ESSENTIAL,
  LISTED_WIRELESS_5G,
  termVariants,
} from '@/lib/listing/__fixtures__/catalog';
import type { Cart } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { cartLine, cartOf } from './__fixtures__/cart';
import { ListingProvider } from './ListingProvider';

const ctx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/context/CartProvider', () => ({ useCartContext: () => ctx.value }));

import { OfferCard } from './OfferCard';

const addLine = vi.fn();
const removeLine = vi.fn();
const setQuantity = vi.fn();

function setCart(cart: Cart | null): void {
  ctx.value = { cart, isLoading: false, itemCount: cart?.itemCount ?? 0, addLine, removeLine, setQuantity };
}

function renderCard(offer = LISTED_CABLE_500, options: { locale?: 'en-US' | 'de-DE'; highlighted?: boolean } = {}) {
  return renderWithProviders(
    <ListingProvider
      candidates={{ addons: LISTED_ADDONS, equipment: LISTED_EQUIPMENT, plans: [], preferredParentLineId: null, links: { addons: '/shop/add-ons', internetPlans: null, phonePlans: null } }}
    >
      <OfferCard offer={offer} highlighted={options.highlighted} />
    </ListingProvider>,
    { locale: options.locale ?? 'en-US' },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  addLine.mockResolvedValue(null);
  removeLine.mockResolvedValue(null);
  setQuantity.mockResolvedValue(null);
  setCart(null);
});

describe('OfferCard', () => {
  it('shows tag, name, master price, bullets, validity and an outlined "Choose plan"', () => {
    renderCard(LISTED_WIRELESS_5G);
    expect(screen.getByText('5G · Most popular')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Air 5G' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Air 5G' }).closest('article')).toHaveTextContent('$55/mo');
    expect(screen.getByText('Fast and reliable')).toBeInTheDocument();
    expect(screen.getByText('12-month price lock', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose plan' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('No price for this buyer: shows "Price not available", no zero, CTA disabled', () => {
    const noPrice = { ...LISTED_CABLE_500, variants: termVariants('X', [['24M', 1]]).map((variant) => ({ ...variant, recurringPrice: undefined })) };
    renderCard(noPrice);
    expect(screen.getAllByText('Price not available').length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$0/)).toBeNull();
    const cta = screen.getByRole('button', { name: 'Unavailable' });
    expect(cta).toBeDisabled();
  });

  it('picking a term changes price and validity and the SKU that is added', async () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Cable 500' }).closest('article')).toHaveTextContent('$59.99/mo');
    await userEvent.click(screen.getByRole('radio', { name: '12 months · $64.99' }));
    expect(screen.getByRole('heading', { name: 'Cable 500' }).closest('article')).toHaveTextContent('$64.99/mo');
    expect(screen.getByText('12-month price lock', { selector: 'div' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose plan' }));
    expect(addLine).toHaveBeenCalledWith({ offerKey: 'malva-offer-cable-500', sku: 'MLV-cable-500-12M', quantity: 1 });
  });

  it('Selected is read from the bundle: filled button, term locked, customize enabled', () => {
    setCart(cartOf([cartLine({ id: 'p1', offerKey: LISTED_CABLE_500.key, kind: 'plan', sku: 'MLV-cable-500-12M' })]));
    renderCard();
    expect(screen.getByRole('button', { name: 'Selected ✓' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: '12 months · $64.99' })).toBeChecked();
    for (const radio of screen.getAllByRole('radio', { name: /months|Month-to-month/ })) expect(radio).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Spotify/ })).toBeEnabled();
  });

  it('before the plan is chosen the Customize area says to choose it first', () => {
    renderCard();
    expect(screen.getByText('Choose this plan to add extras')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Spotify/ })).toBeDisabled();
  });

  it('clicking "Selected ✓" removes the plan (no dependents: no question)', async () => {
    setCart(cartOf([cartLine({ id: 'p1', offerKey: LISTED_CABLE_500.key, kind: 'plan', sku: 'MLV-cable-500-24M' })]));
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Selected ✓' }));
    expect(removeLine).toHaveBeenCalledWith('p1', undefined);
  });

  it('with dependents the removal asks first and names how many', async () => {
    setCart(
      cartOf([
        cartLine({ id: 'p1', offerKey: LISTED_CABLE_500.key, kind: 'plan' }),
        cartLine({ id: 'a1', offerKey: 'malva-offer-spotify', kind: 'addon', parentLineId: 'p1' }),
      ]),
    );
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Selected ✓' }));
    expect(removeLine).not.toHaveBeenCalled();
    expect(screen.getByText('Remove Cable 500 and its 1 add-on?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove', hidden: true }));
    expect(removeLine).toHaveBeenCalledWith('p1', { cascade: true });
  });

  it('phone plans have a Lines stepper from 1 to 5 that is local until the plan is selected', async () => {
    renderCard(LISTED_PHONE_ESSENTIAL);
    const group = screen.getByRole('group', { name: 'Number of lines' });
    await userEvent.click(within(group).getByRole('button', { name: 'More lines' }));
    await userEvent.click(within(group).getByRole('button', { name: 'More lines' }));
    expect(within(group).getByText('3')).toBeInTheDocument();
    expect(setQuantity).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Choose plan' }));
    expect(addLine).toHaveBeenCalledWith({ offerKey: 'malva-offer-phone-essential', sku: 'MLV-phone-essential-M2M', quantity: 3 });
  });

  it('a selected phone plan changes its lines on the line', async () => {
    setCart(cartOf([cartLine({ id: 'p9', offerKey: LISTED_PHONE_ESSENTIAL.key, kind: 'plan', quantity: 2 })]));
    renderCard(LISTED_PHONE_ESSENTIAL);
    await userEvent.click(screen.getByRole('button', { name: 'More lines' }));
    expect(setQuantity).toHaveBeenCalledWith('p9', 3);
  });

  it('other plans have no lines stepper', () => {
    renderCard(LISTED_CABLE_500);
    expect(screen.queryByRole('group', { name: 'Number of lines' })).toBeNull();
  });

  it('carries the anchor id and marks the highlighted card', () => {
    const { container } = renderCard(LISTED_CABLE_500, { highlighted: true });
    const anchor = container.querySelector('#offer-malva-offer-cable-500');
    expect(anchor).toHaveAttribute('data-highlighted', 'true');
  });

  it('copy is German in de-DE', () => {
    renderCard(LISTED_WIRELESS_5G, { locale: 'de-DE' });
    expect(screen.getByRole('button', { name: 'Tarif wählen' })).toBeInTheDocument();
    expect(screen.getByText('12 Monate Preisgarantie', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('5G · Am beliebtesten')).toBeInTheDocument();
  });
});

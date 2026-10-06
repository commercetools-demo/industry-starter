import { screen, within } from '@testing-library/react';
import { cartLine, makeCart, renderWithCart } from '@/test/cart';
import { renderWithProviders } from '@/test/utils';
import { CartSummary } from './CartSummary';
import { ProvisionalNotice } from './ProvisionalNotice';

const approx = cartLine({ id: 'b', name: 'Bananas', approximateWeight: true, increment: { value: 500, unit: 'g', label: '500 g' } });
const exact = cartLine({ id: 'm', name: 'Milk' });

function summary() {
  return screen.getByRole('heading', { level: 3, name: 'Summary' }).closest('div') as HTMLElement;
}

describe('Cart summary provisional total', () => {
  it('Approximate line present: "Total (provisional)" and the note', () => {
    const cart = makeCart({ lines: [approx, exact], isProvisional: true });
    renderWithCart(<CartSummary cart={cart} />, { cart });
    expect(within(summary()).getByText('Total (provisional)')).toBeInTheDocument();
    expect(within(summary()).getByText('The final amount depends on the weight we pick.')).toBeInTheDocument();
    expect(within(summary()).queryByText('Total')).not.toBeInTheDocument();
  });

  it('Exact lines only: plain "Total" and no note', () => {
    const cart = makeCart({ lines: [exact], isProvisional: false });
    renderWithCart(<CartSummary cart={cart} />, { cart });
    expect(within(summary()).getByText('Total')).toBeInTheDocument();
    expect(screen.queryByText(/provisional/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/depends on the weight/i)).not.toBeInTheDocument();
  });

  it('German: label and note are translated', () => {
    const cart = makeCart({ lines: [approx], isProvisional: true });
    renderWithCart(<CartSummary cart={cart} />, { cart, locale: 'de-DE' });
    expect(screen.getByText('Gesamt (vorläufig)')).toBeInTheDocument();
    expect(screen.getByText(/Endbetrag hängt vom Gewicht ab/)).toBeInTheDocument();
  });
});

describe('ProvisionalNotice', () => {
  it('without a cart (orders) it always renders', () => {
    renderWithProviders(<ProvisionalNotice />);
    expect(screen.getByTestId('provisional-note')).toBeInTheDocument();
  });

  it('with a non-provisional cart it renders nothing in both variants', () => {
    renderWithProviders(
      <>
        <ProvisionalNotice cart={{ isProvisional: false }} />
        <ProvisionalNotice cart={{ isProvisional: false }} variant="total" />
      </>,
    );
    expect(screen.queryByText(/provisional|weight/i)).not.toBeInTheDocument();
  });
});

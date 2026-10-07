import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { PriceBlock } from './PriceBlock';

const g500 = { value: 500, unit: 'g' as const, label: '500 g' };

describe('PriceBlock unit price line', () => {
  it('500 g pack: shows the per-kg price under the price', () => {
    renderWithProviders(<PriceBlock price={{ centAmount: 240, currencyCode: 'USD' }} increment={g500} />);
    expect(screen.getByText('$2.40')).toBeInTheDocument();
    expect(screen.getByTestId('unit-price')).toHaveTextContent('$4.80 / kg');
  });

  it('Each item: no unit line', () => {
    renderWithProviders(<PriceBlock price={{ centAmount: 240, currencyCode: 'USD' }} increment={{ value: 1, unit: 'each', label: '1 pc' }} />);
    expect(screen.queryByTestId('unit-price')).not.toBeInTheDocument();
  });

  it('No increment prop: no unit line', () => {
    renderWithProviders(<PriceBlock price={{ centAmount: 240, currencyCode: 'USD' }} />);
    expect(screen.queryByTestId('unit-price')).not.toBeInTheDocument();
  });

  it('Millilitres: per-litre price', () => {
    renderWithProviders(<PriceBlock price={{ centAmount: 100, currencyCode: 'USD' }} increment={{ value: 250, unit: 'ml', label: '250 ml' }} />);
    expect(screen.getByTestId('unit-price')).toHaveTextContent('$4.00 / l');
  });

  it('Discount: the unit line is based on the discounted amount', () => {
    renderWithProviders(
      <PriceBlock price={{ centAmount: 240, currencyCode: 'USD', discounted: { centAmount: 200, currencyCode: 'USD' } }} increment={g500} />,
    );
    expect(screen.getByTestId('unit-price')).toHaveTextContent('$4.00 / kg');
  });

  it('German locale: euro formatting with comma', () => {
    renderWithProviders(<PriceBlock price={{ centAmount: 240, currencyCode: 'EUR' }} increment={g500} />, { locale: 'de-DE' });
    expect(screen.getByTestId('unit-price').textContent).toMatch(/^4,80\s€ \/ kg$/);
    expect(screen.getByText(/^2,40\s€$/)).toBeInTheDocument();
  });
});

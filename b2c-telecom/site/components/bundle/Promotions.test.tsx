import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { LinePromotions, Promotions } from './Promotions';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const welcome = { key: 'malva-cd-welcome-10', name: 'Welcome offer', amount: usd(1000), lineIds: [] };

describe('Promotions', () => {
  it('lists each promotion with its name and the amount off, under a heading', () => {
    renderWithProviders(<Promotions promotions={[welcome]} />);
    expect(screen.getByRole('region', { name: 'Promotions' })).toBeInTheDocument();
    expect(screen.getByText('Welcome offer: $10.00 off')).toBeInTheDocument();
  });

  it('renders nothing when no promotion applied', () => {
    renderWithProviders(<Promotions promotions={[]} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('German copy', () => {
    renderWithProviders(<Promotions promotions={[{ ...welcome, name: 'Willkommensangebot' }]} />, { locale: 'de-DE' });
    expect(screen.getByText(/Willkommensangebot: .*10,00.* Rabatt/)).toBeInTheDocument();
  });

  it('a line promotion shows under its line; none shows nothing', () => {
    renderWithProviders(<LinePromotions promotions={[{ key: 'k', name: 'First month free', amount: usd(5999), lineIds: ['L1'] }]} />);
    expect(screen.getByText('First month free: $59.99 off')).toBeInTheDocument();
  });

  it('LinePromotions without promotions renders nothing', () => {
    renderWithProviders(<LinePromotions />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

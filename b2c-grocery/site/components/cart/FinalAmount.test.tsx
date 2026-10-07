import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { FinalAmount } from './FinalAmount';

const eur = (centAmount: number) => ({ centAmount, currencyCode: 'EUR' });

describe('FinalAmount', () => {
  it('Final amount recorded higher: shows the amount and a positive difference', () => {
    renderWithProviders(<FinalAmount provisional={eur(1000)} final={eur(1130)} />);
    expect(screen.getByTestId('final-amount')).toHaveTextContent('Final amount €11.30 · difference +€1.30');
  });

  it('Final amount lower: negative difference', () => {
    renderWithProviders(<FinalAmount provisional={eur(1000)} final={eur(940)} />);
    expect(screen.getByTestId('final-amount')).toHaveTextContent('Final amount €9.40 · difference -€0.60');
  });

  it('Equal amounts: "No difference"', () => {
    renderWithProviders(<FinalAmount provisional={eur(1000)} final={eur(1000)} />);
    expect(screen.getByTestId('final-amount')).toHaveTextContent('Final amount €10.00 · No difference');
  });

  it('Absent final amount: renders nothing', () => {
    renderWithProviders(<FinalAmount provisional={eur(1000)} />);
    expect(screen.queryByTestId('final-amount')).not.toBeInTheDocument();
    expect(screen.queryByText(/final amount/i)).not.toBeInTheDocument();
  });

  it('German: euro formatting and translated text', () => {
    renderWithProviders(<FinalAmount provisional={eur(1000)} final={eur(1130)} />, { locale: 'de-DE' });
    expect(screen.getByTestId('final-amount').textContent).toMatch(/Endbetrag 11,30\s€ · Differenz \+1,30\s€/);
  });
});

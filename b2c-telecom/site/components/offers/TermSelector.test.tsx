import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LISTED_CABLE_500 } from '@/lib/listing/__fixtures__/catalog';
import { toPlanCardData } from '@/lib/listing/cardData';
import { renderWithProviders } from '@/test/utils';
import { TermSelector } from './TermSelector';

const TERMS = toPlanCardData(LISTED_CABLE_500).terms;

describe('TermSelector', () => {
  it('is a labelled radio group with term and price on every pill, the chosen one checked', () => {
    renderWithProviders(<TermSelector terms={TERMS} value="MLV-cable-500-24M" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'Contract term' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Month-to-month · $69.99' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '12 months · $64.99' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '24 months · $59.99' })).toBeChecked();
  });

  it('choosing a pill reports its SKU', async () => {
    const onChange = vi.fn();
    renderWithProviders(<TermSelector terms={TERMS} value="MLV-cable-500-24M" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '12 months · $64.99' }));
    expect(onChange).toHaveBeenCalledWith('MLV-cable-500-12M');
  });

  it('locked: every radio is disabled and the group explains why', () => {
    renderWithProviders(<TermSelector terms={TERMS} value="MLV-cable-500-24M" onChange={vi.fn()} locked />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByRole('radiogroup')).toHaveAttribute('title', 'Deselect to change the contract term');
  });

  it('a term without a price for this buyer is disabled and says so', () => {
    renderWithProviders(<TermSelector terms={[{ ...TERMS[0], price: null }, TERMS[1]]} value={TERMS[1].sku} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Month-to-month · Price not available' })).toBeDisabled();
  });

  it('prices and terms are German in de-DE', () => {
    renderWithProviders(<TermSelector terms={TERMS} value="MLV-cable-500-24M" onChange={vi.fn()} />, { locale: 'de-DE' });
    expect(screen.getByRole('radio', { name: /^Monatlich kündbar · 69,99/ })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Vertragslaufzeit' })).toBeInTheDocument();
  });
});

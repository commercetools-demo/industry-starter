import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { BundlePill } from './BundlePill';

describe('BundlePill', () => {
  it('Bundle count counts plans and add-ons: renders My bundle · 3', () => {
    renderWithProviders(<BundlePill count={3} />);
    const link = screen.getByRole('link', { name: 'My bundle · 3' });
    expect(link).toHaveAttribute('href', '/en-US/bundle');
    expect(link).toHaveTextContent('My bundle · 3');
    expect(link).toHaveClass('bg-brand-950', 'rounded-pill');
  });

  it('Anonymous buyer: the pill shows the count it is given', () => {
    renderWithProviders(<BundlePill count={0} />);
    expect(screen.getByRole('link', { name: 'My bundle · 0' })).toBeInTheDocument();
  });

  it('de-DE text', () => {
    renderWithProviders(<BundlePill count={2} />, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Mein Bundle · 2' })).toHaveAttribute('href', '/de-DE/bundle');
  });
});

import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { PolicyLink } from './PolicyLink';

describe('PolicyLink', () => {
  it('Opened from checkout: the link opens a new tab with noopener so the checkout tab is untouched', () => {
    renderWithProviders(<PolicyLink policy="terms">Terms</PolicyLink>);
    const link = screen.getByRole('link', { name: 'Terms' });
    expect(link).toHaveAttribute('href', '/en-US/legal/terms');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('is locale aware', () => {
    renderWithProviders(<PolicyLink policy="privacy">Datenschutz</PolicyLink>, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/de-DE/legal/privacy');
  });
});

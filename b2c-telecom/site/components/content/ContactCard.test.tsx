import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ContactCard } from './ContactCard';

describe('ContactCard', () => {
  it('Replacement behaviour: email channel shown, no offices heading', () => {
    for (const locale of ['en-US', 'de-DE'] as const) {
      const { unmount } = renderWithProviders(<ContactCard />, { locale });
      expect(screen.getByText('support@malva.example')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: locale === 'en-US' ? 'Email support' : 'E-Mail an den Support' })).toHaveAttribute('href', expect.stringMatching(/^mailto:support@malva\.example\?subject=/));
      expect(screen.queryByText(/office|büro|standort|location/i)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('tells the reader not to send card numbers or passwords', () => {
    renderWithProviders(<ContactCard />);
    expect(screen.getByText('Please do not include payment card numbers or passwords in your email.')).toBeInTheDocument();
  });
});

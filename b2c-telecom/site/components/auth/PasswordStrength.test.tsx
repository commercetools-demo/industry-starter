import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { PasswordStrength } from './PasswordStrength';

describe('PasswordStrength', () => {
  it('lists the five requirements and counts none for an empty password', () => {
    renderWithProviders(<PasswordStrength password="" />);
    expect(screen.getByText('0 of 5 requirements met')).toHaveAttribute('aria-live', 'polite');
    const list = screen.getByRole('list', { name: 'Password requirements' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(within(list).getAllByText('not met')).toHaveLength(5);
  });

  it('marks each requirement met as the password gets better, with a visually hidden "met"', () => {
    const { unmount } = renderWithProviders(<PasswordStrength password="abc" />);
    expect(screen.getByText('2 of 5 requirements met')).toBeInTheDocument();
    const lowercase = screen.getByText('Add a lowercase letter.').closest('li');
    expect(lowercase).toHaveAttribute('data-met', 'true');
    expect(within(lowercase as HTMLElement).getByText('met')).toHaveClass('sr-only');
    unmount();
    renderWithProviders(<PasswordStrength password="Aa1-valid-pass" />);
    expect(screen.getByText('5 of 5 requirements met')).toBeInTheDocument();
  });

  it('applies the not-email rule only with an email and lists max-length only when it fails', () => {
    renderWithProviders(<PasswordStrength password="Xx1-jane.doe-pass" email="jane.doe@example.com" />);
    expect(screen.getByText('Do not use your email address in the password.').closest('li')).toHaveAttribute('data-met', 'false');
    expect(screen.queryByText('Use at most 128 characters.')).not.toBeInTheDocument();
  });

  it('shows the max-length row when the password is too long', () => {
    renderWithProviders(<PasswordStrength password={`Aa1${'x'.repeat(130)}`} />);
    expect(screen.getByText('Use at most 128 characters.').closest('li')).toHaveAttribute('data-met', 'false');
  });

  it('de-DE texts', () => {
    renderWithProviders(<PasswordStrength password="abc" />, { locale: 'de-DE' });
    expect(screen.getByText('2 von 5 Anforderungen erfüllt')).toBeInTheDocument();
    expect(screen.getByText('Fügen Sie einen Großbuchstaben hinzu.')).toBeInTheDocument();
  });
});

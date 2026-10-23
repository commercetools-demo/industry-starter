import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AuthCard from '@/components/auth/AuthCard';
import PasswordField from '@/components/auth/PasswordField';
import PasswordStrength from '@/components/auth/PasswordStrength';
import { renderWithIntl } from '@/test/render';

describe('auth atoms', () => {
  it('Strength list names the failing rule', () => {
    renderWithIntl(<PasswordStrength id="s" password="abc" email="a@example.com" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(screen.getByText('At least 10 characters').closest('li')).toHaveAttribute('data-met', 'false');
    expect(screen.getByText('Contains a letter').closest('li')).toHaveAttribute('data-met', 'true');
    expect(screen.getByText('Contains a number').closest('li')).toHaveAttribute('data-met', 'false');
    expect(screen.getByText('2 of 4 rules met')).toHaveAttribute('aria-live', 'polite');
  });

  it('Strength list shows nothing met for an empty password and the max rule only when failing', () => {
    const { rerender } = renderWithIntl(<PasswordStrength id="s" password="" />);
    expect(screen.getByText('0 of 4 rules met')).toBeInTheDocument();
    rerender(<PasswordStrength id="s" password={`${'a1'.repeat(70)}`} />);
    expect(screen.getByText('At most 128 characters')).toBeInTheDocument();
  });

  it('Show password toggle exposes its state', async () => {
    renderWithIntl(<PasswordField id="pw" label="Password" autoComplete="new-password" />);
    const input = screen.getByLabelText('Password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('PasswordField ties its error and description to the input', () => {
    renderWithIntl(<PasswordField id="pw" label="Password" error="Nope" describedBy="rules" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe('pw-error rules');
  });

  it('AuthCard has one H1', () => {
    render(
      <AuthCard eyebrow="Your account" title="Sign in" intro="Welcome back." below={<p>below</p>}>
        <p>body</p>
      </AuthCard>,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByText('below')).toBeInTheDocument();
  });
});

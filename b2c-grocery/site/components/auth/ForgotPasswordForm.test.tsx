import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { ForgotPasswordForm } from './ForgotPasswordForm';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const submit = async (email: string) => {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
};

describe('ForgotPasswordForm', () => {
  it('Unknown email: the same confirmation appears for any email', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    renderWithProviders(<ForgotPasswordForm />);
    await submit('nobody@b.co');
    expect(await screen.findByText('If an account exists for that email, a reset link has been prepared.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('Dev stub: in development a link to the stub page is offered', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    renderWithProviders(<ForgotPasswordForm />);
    await submit('a@b.co');
    expect(await screen.findByRole('link', { name: /reset link/i })).toHaveAttribute('href', '/en-US/account/dev/reset-link');
  });

  it('Validation error: an empty email is flagged and nothing is sent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ForgotPasswordForm />);
    await submit('');
    const field = screen.getByLabelText('Email');
    expect(document.getElementById(field.getAttribute('aria-describedby')!)).toHaveTextContent('This field is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

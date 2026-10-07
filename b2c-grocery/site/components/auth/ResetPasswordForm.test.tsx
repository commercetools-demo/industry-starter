import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { ResetPasswordForm } from './ResetPasswordForm';

const replace = vi.fn();
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const reply = (body: unknown, status = 200) => vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

async function submit(password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Save and sign in' }));
}

describe('ResetPasswordForm', () => {
  it('Valid token: posts token and password, signs in and lands on the account page', async () => {
    const fetchMock = reply({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ResetPasswordForm token="tok-1" />);
    await submit('new-password');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/account'));
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/auth/reset-password');
    expect(JSON.parse(call![1].body)).toEqual({ token: 'tok-1', password: 'new-password' });
  });

  it('Expired token: explains and offers a new link', async () => {
    vi.stubGlobal('fetch', reply({ error: 'INVALID_TOKEN' }, 400));
    renderWithProviders(<ResetPasswordForm token="old" />);
    await submit('new-password');
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.');
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/en-US/account/forgot-password');
  });

  it('No token in the URL: the invalid-link message shows and the form cannot be submitted', () => {
    renderWithProviders(<ResetPasswordForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.');
    expect(screen.getByRole('button', { name: 'Save and sign in' })).toBeDisabled();
  });

  it('Validation error: a short password is explained with aria-describedby', async () => {
    const fetchMock = reply({});
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ResetPasswordForm token="tok" />);
    await submit('short');
    const field = screen.getByLabelText('Password');
    expect(document.getElementById(field.getAttribute('aria-describedby')!)).toHaveTextContent('Use at least 8 characters');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

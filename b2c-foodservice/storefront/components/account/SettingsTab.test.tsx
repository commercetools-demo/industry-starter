import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import SettingsTab from '@/components/account/SettingsTab';
import { nav, renderShell, stubFetch } from '@/test/shell';

beforeEach(() => {
  nav.pathname = '/account/settings';
  nav.replace.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('Settings tab', () => {
  it('Settings offers no email or notification control', () => {
    stubFetch({});
    const { container } = renderShell(<SettingsTab />);
    expect(container.querySelectorAll('[role="switch"], input[type="checkbox"]')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/newsletter|notification alert|sms|text message alerts|subscribe to/i);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument();
  });

  it('Delete account: the modal states what is erased and what is retained before anything happens', async () => {
    const { calls } = stubFetch({});
    renderShell(<SettingsTab />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete your account?' });
    expect(within(dialog).getByTestId('delete-erased')).toHaveTextContent('This erases your profile, addresses, saved items and saved cards.');
    expect(within(dialog).getByTestId('delete-retained')).toHaveTextContent('Order records are kept for legal and tax reasons.');
    expect(calls).toHaveLength(0);
  });

  it('needs a password: an empty one sends nothing', async () => {
    const { calls } = stubFetch({});
    renderShell(<SettingsTab />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('That password is not correct.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('a wrong password is refused by the server and the account stays', async () => {
    const { calls } = stubFetch({
      '/api/account/delete': () => Response.json({ error: { code: 'current_password_invalid', message: 'x' } }, { status: 400 }),
    });
    renderShell(<SettingsTab />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    await userEvent.type(screen.getByLabelText('Enter your password to confirm'), 'wrong-pass-1');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('That password is not correct.')).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/auth/logout')).toBe(false);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('success signs out and goes to sign-in', async () => {
    const { calls } = stubFetch({ '/api/account/delete': () => ({ ok: true }), '/api/auth/logout': () => ({ ok: true }) });
    renderShell(<SettingsTab />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    await userEvent.type(screen.getByLabelText('Enter your password to confirm'), 'right-pass-1');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/account/sign-in?notice=signedOut'));
    expect(JSON.parse(String(calls.find((c) => c.url === '/api/account/delete')?.init?.body))).toEqual({ confirmPassword: 'right-pass-1' });
    expect(await screen.findByText('Your account was deleted.')).toBeInTheDocument();
  });
});

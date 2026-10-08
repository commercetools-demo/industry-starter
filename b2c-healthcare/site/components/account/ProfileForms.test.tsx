import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { ProfileForms } from './ProfileForms';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const renderForms = () => renderWithProviders(<ProfileForms firstName="Sam" lastName="Rivera" email="sam@example.com" />);
const sent = (index = 0) => {
  const [path, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { path, method: init.method, body: JSON.parse(String(init.body)) as Record<string, unknown> };
};

describe('account-and-self-service: profile', () => {
  it('shows the email read-only and the current name; there is no notification, photo or family setting', () => {
    const { container } = renderForms();
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue('Sam');
    expect(screen.getByLabelText(/Last name/)).toHaveValue('Rivera');
    expect(container.textContent).not.toMatch(/notification|photo|family/i);
  });

  it('saves a new name through PATCH /api/account/profile and confirms', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(json({ id: 'c1', firstName: 'Alex', lastName: 'Chen', email: 'sam@example.com' }));
    renderForms();
    await user.clear(screen.getByLabelText(/First name/));
    await user.type(screen.getByLabelText(/First name/), 'Alex');
    await user.clear(screen.getByLabelText(/Last name/));
    await user.type(screen.getByLabelText(/Last name/), 'Chen');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({ path: '/api/account/profile', method: 'PATCH', body: { firstName: 'Alex', lastName: 'Chen' } });
    expect(await screen.findAllByText('Your name is updated.')).not.toHaveLength(0);
  });

  it('an empty name shows an inline error, focuses the field and sends nothing', async () => {
    const user = userEvent.setup();
    renderForms();
    await user.clear(screen.getByLabelText(/First name/));
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(screen.getByText('Enter your first name.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/First name/)).toHaveFocus());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('password: mismatch and too-short are caught before any request, focus on the first problem', async () => {
    const user = userEvent.setup();
    renderForms();
    await user.type(screen.getByLabelText('Current password'), 'old-password-1');
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getAllByText('Use at least 10 characters.').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByLabelText('New password')).toHaveFocus());
    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'a-long-new-password');
    await user.type(screen.getByLabelText('Repeat new password'), 'different-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('password change posts the current and new password (reusing /api/account/password), clears the fields and confirms', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(json({ ok: true }));
    renderForms();
    await user.type(screen.getByLabelText('Current password'), 'old-password-1');
    await user.type(screen.getByLabelText('New password'), 'a-long-new-password');
    await user.type(screen.getByLabelText('Repeat new password'), 'a-long-new-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({ path: '/api/account/password', method: 'POST', body: { currentPassword: 'old-password-1', newPassword: 'a-long-new-password' } });
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveValue(''));
    expect(screen.getByLabelText('New password')).toHaveValue('');
    expect(await screen.findAllByText('Your password is changed.')).not.toHaveLength(0);
  });

  it('a wrong current password is named, the field is cleared and focused', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(json({ error: 'Your current password is not correct.' }, 400));
    renderForms();
    await user.type(screen.getByLabelText('Current password'), 'wrong-password');
    await user.type(screen.getByLabelText('New password'), 'a-long-new-password');
    await user.type(screen.getByLabelText('Repeat new password'), 'a-long-new-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Your current password is not correct.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveFocus());
  });

  it('a 429 and an expired session are handled (message; sign-in prompt)', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(json({ error: 'Too many attempts.' }, 429));
    renderForms();
    await user.type(screen.getByLabelText('Current password'), 'old-password-1');
    await user.type(screen.getByLabelText('New password'), 'a-long-new-password');
    await user.type(screen.getByLabelText('Repeat new password'), 'a-long-new-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Too many attempts. Please try again in a few minutes.')).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(json({ error: 'Please sign in to continue.' }, 401));
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});

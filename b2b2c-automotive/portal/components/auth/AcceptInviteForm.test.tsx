// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/accept-invite/tok',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

import { AcceptInviteForm } from './AcceptInviteForm';

const fetchMock = vi.fn();
beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const fill = async (password: string) => {
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.type(screen.getByLabelText('Repeat the password'), password);
};

describe('AcceptInviteForm', () => {
  it('keeps the button disabled until the password is valid and matching', async () => {
    renderWithProviders(<AcceptInviteForm token="tok" />, { messages: en, locale: 'en-US' });
    expect(screen.getByRole('button', { name: 'Set password' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    expect(screen.getByText('Too short')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Password'));
    await fill('a-long-enough-password');
    expect(screen.getByText('Looks good')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set password' })).toBeEnabled();
  });

  it('posts the token and password, then offers sign-in', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'accepted' }));
    renderWithProviders(<AcceptInviteForm token="tok" />, { messages: en, locale: 'en-US' });
    await fill('a-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText('Your password is set. You can sign in now.')).toBeInTheDocument();
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ token: 'tok', password: 'a-long-enough-password' });
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toBeInTheDocument();
  });

  it('an invalid or expired token shows one generic message', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'x' }, { status: 400 }));
    renderWithProviders(<AcceptInviteForm token="tok" />, { messages: en, locale: 'en-US' });
    await fill('a-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This invitation link is invalid or has expired.');
  });
});

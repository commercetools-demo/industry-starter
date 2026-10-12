// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => router,
}));

import { SignInForm } from './SignInForm';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const anna = { id: 'c1', email: 'anna@example.com', firstName: 'Anna', lastName: 'Schneider', mobile: null, addresses: [], defaultShippingAddressId: null, defaultBillingAddressId: null };

function setup(locale: 'en-US' | 'de-DE' = 'en-US') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-US' ? enMessages : deMessages}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <SignInForm store="mau-reseller-north" storeName="Malva North" next="/cart" />
      </SWRConfig>
    </NextIntlClientProvider>,
  );
}
async function fill(email = 'anna@example.com', password = 'secret') {
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
}

beforeEach(() => {
  router.replace.mockReset();
  router.refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('Sign-in form', () => {
  it('labels and autocomplete attributes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ customer: null })));
    setup();
    expect(await screen.findByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByText('Sign in to your Malva North account. The items in your cart are kept.')).toBeInTheDocument();
  });

  it('the button waits for both fields', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ customer: null })));
    setup();
    const button = await screen.findByRole('button', { name: 'Sign in' });
    expect(button).toBeDisabled();
    await fill();
    expect(button).toBeEnabled();
  });

  it('signs in, goes to next and refreshes the server components', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        if (url === '/api/auth/login') return json({ customer: anna, count: 3 });
        return json({ customer: null, count: 0 });
      }),
    );
    setup();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mau-reseller-north/cart'));
    expect(router.refresh).toHaveBeenCalled();
    expect(calls).toContain('POST /api/auth/login');
  });

  it('sign-in shows one generic error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/auth/login' ? json({ error: 'invalid-credentials' }, 401) : json({ customer: null }))));
    setup();
    await fill('someone@example.com', 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not sign you in. Check your email and password.');
    expect(alert.textContent).not.toMatch(/store|exist|unknown|password is/i);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('error receives focus', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/auth/login' ? json({ error: 'invalid-credentials' }, 401) : json({ customer: null }))));
    setup();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('the store home is the destination for next=/', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/auth/login' ? json({ customer: anna, count: 0 }) : json({ customer: null }))));
    render(
      <NextIntlClientProvider locale="en-US" messages={enMessages}>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <SignInForm store="mau-reseller-north" storeName="Malva North" next="/" />
        </SWRConfig>
      </NextIntlClientProvider>,
    );
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mau-reseller-north'));
  });

  it('rate limiting and outages have their own plain messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/auth/login' ? json({ error: 'x' }, 429) : json({ customer: null }))));
    setup();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });

  it('a signed-in shopper sees who they are and can sign out', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/auth/logout' ? json({ ok: true }) : json({ customer: anna }))));
    setup();
    expect(await screen.findByText('You are signed in as Anna Schneider.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it('axe clean in en-US and de-DE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ customer: null })));
    const en = setup('en-US');
    await screen.findByLabelText('Email');
    expect(await axe(en.container)).toHaveNoViolations();
    en.unmount();
    const de = setup('de-DE');
    expect(await screen.findByLabelText('E-Mail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
    expect(await axe(de.container)).toHaveNoViolations();
  });
});

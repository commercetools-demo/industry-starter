// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('@/i18n/routing', () => ({ useRouter: () => router }));

import { ImpersonationBanner } from './ImpersonationBanner';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const setup = (name: string | null = 'Anna M', locale: 'en-US' | 'de-DE' = 'en-US') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-US' ? enMessages : deMessages}>
      <SWRConfig value={{ provider: () => new Map() }}>
        <ImpersonationBanner name={name} store="mau-reseller-north" />
      </SWRConfig>
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  router.replace.mockReset();
  router.refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('ImpersonationBanner', () => {
  it('renders the text with the customer name in a status region and an exit button', () => {
    setup();
    expect(screen.getByRole('status')).toHaveTextContent('You are shopping as Anna M. Orders are placed on their behalf.');
    expect(screen.getByRole('button', { name: 'Exit customer session' })).toBeEnabled();
  });
  it('a customer without a name gets the generic text', () => {
    setup(null);
    expect(screen.getByRole('status')).toHaveTextContent('You are shopping as a customer.');
  });
  it('is available in German', () => {
    setup('Anna M', 'de-DE');
    expect(screen.getByRole('button', { name: 'Kundensitzung beenden' })).toBeInTheDocument();
  });
  it('Exit calls the exit route, disappears and refreshes the page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Exit customer session' }));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/impersonate/exit');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(router.replace).toHaveBeenCalledWith('/mau-reseller-north');
    expect(router.refresh).toHaveBeenCalled();
  });
  it('a failed exit keeps the banner and says so', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'x' }, 500)));
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Exit customer session' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be ended');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it('has no accessibility violations', async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });
});

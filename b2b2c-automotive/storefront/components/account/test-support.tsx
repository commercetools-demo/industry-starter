// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Test helpers of the account area (workstream Q): provider wrapper, a routing mock whose router can be spied on, and a fetch stub keyed by
// "METHOD /path". Only tests import it.
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { vi } from 'vitest';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';

export const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };

/** Factory for `vi.mock('@/i18n/routing', async () => (await import('./test-support')).routingMock())`. */
export const routingMock = () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => '/mau-reseller-north/account',
});

export function renderAccount(ui: ReactElement, locale: 'en-US' | 'de-DE' = 'en-US') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-US' ? enMessages : deMessages}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>
    </NextIntlClientProvider>,
  );
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Handler = unknown | ((body: unknown) => unknown);
export interface FetchCall {
  key: string;
  body: unknown;
}

/**
 * Stubs `fetch`. A route value is a body (answered 200), a function of the request body, or `new Response(...)` for a status. Unknown routes answer
 * 404. Returns the calls (`key` is "METHOD /path") so a test can assert what was sent.
 */
export function stubFetch(routes: Record<string, Handler>): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ key, body });
      const handler = routes[key];
      if (handler === undefined) return json({ error: 'Not found' }, 404);
      const value = typeof handler === 'function' ? (handler as (b: unknown) => unknown)(body) : handler;
      return value instanceof Response ? value : json(value);
    }),
  );
  return calls;
}

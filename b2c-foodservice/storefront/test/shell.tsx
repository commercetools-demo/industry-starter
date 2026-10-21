import { render, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';
import { SWRConfig } from 'swr';
import { ShellUiProvider } from '@/context/shell-ui-context';
import { StoreProvider } from '@/context/store-context';
import { ToastProvider } from '@/context/toast';
import enCA from '@/messages/en-CA.json';
import enUS from '@/messages/en-US.json';

const CATALOGUES: Record<string, typeof enUS> = { 'en-US': enUS, 'en-CA': enCA };

/** Spies shared with the mocked '@/i18n/routing' (see `routingMock`). */
export const nav = {
  pathname: '/',
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
};

/** `vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock())` */
export async function routingMock() {
  const React = await import('react');
  return {
    routing: { locales: ['en-US', 'en-CA'], defaultLocale: 'en-US' },
    Link: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) =>
      React.createElement('a', { href, ...rest }, children),
    usePathname: () => nav.pathname,
    useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: nav.refresh }),
    redirect: vi.fn(),
    getPathname: vi.fn(),
  };
}

export interface ShellRenderOptions {
  locale?: string;
  /** SWR cache seed, keyed by `unstable_serialize` strings or plain keys. */
  fallback?: Record<string, unknown>;
}

/** Renders with intl, an isolated SWR cache and every shell provider. */
export function renderShell(ui: ReactElement, { locale = 'en-US', fallback = {} }: ShellRenderOptions = {}): RenderResult {
  return render(
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]}>
      <SWRConfig value={{ provider: () => new Map(), fallback, dedupingInterval: 0 }}>
        <ToastProvider>
          <StoreProvider>
            <ShellUiProvider>{ui}</ShellUiProvider>
          </StoreProvider>
        </ToastProvider>
      </SWRConfig>
    </NextIntlClientProvider>,
  );
}

/** A fetch stub answering by URL prefix; unknown URLs return 404 with the error body. */
export function stubFetch(routes: Record<string, (init?: RequestInit) => unknown>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url === k || url.startsWith(k));
    if (!key) return Response.json({ error: { code: 'not_found', message: 'x' } }, { status: 404 });
    const out = await routes[key](init);
    return out instanceof Response ? out : Response.json(out);
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

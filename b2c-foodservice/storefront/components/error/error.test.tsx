import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import GlobalError from '@/app/global-error';
import LocaleError from '@/app/[locale]/error';
import Forbidden from '@/app/[locale]/forbidden';
import LocaleNotFound from '@/app/[locale]/not-found';
import RootNotFound from '@/app/not-found';
import { renderWithIntl } from '@/test/render';
import { nav } from '@/test/shell';
import { GLOBAL_ERROR_DICTIONARY, localeFromPath } from './global-error-dictionary';
import ErrorPage from './ErrorPage';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

const ROOT = process.cwd();

describe('Error pages', () => {
  it('Address resolves to nothing: not found page has search and category links and no session read', () => {
    renderWithIntl(<LocaleNotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("We can't find that page.");
    expect(screen.getByText('The address may be mistyped, or the product may no longer be available.')).toBeInTheDocument();
    const search = screen.getByRole('search');
    expect(search).toHaveAttribute('action', '/en-US/search');
    expect(search).toHaveAttribute('method', 'get');
    expect(screen.getByLabelText('Search the shop')).toHaveAttribute('name', 'q');
    const browse = screen.getByRole('navigation', { name: 'Browse the shop' });
    expect(browse.querySelectorAll('a')).toHaveLength(5);
    expect(browse.querySelector('a')).toHaveAttribute('href', '/category/pods');
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('alert')).toBeNull();
    for (const file of ['components/error/ErrorPage.tsx', 'app/[locale]/not-found.tsx', 'app/not-found.tsx']) {
      expect(readFileSync(join(ROOT, file), 'utf8')).not.toMatch(/lib\/session|cookies\(|headers\(/);
    }
  });

  it('every error page sets a document title (WCAG 2.4.2): not found, server error and the listing and product read failures', async () => {
    renderWithIntl(<LocaleNotFound />);
    expect(document.title).toBe("We can't find that page.");
    renderWithIntl(<LocaleError error={new Error('x')} reset={() => {}} />);
    expect(document.title).toBe('Something went wrong on our side.');
    const ListingError = (await import('@/app/[locale]/(listing)/error')).default;
    renderWithIntl(<ListingError error={new Error('x')} reset={() => {}} />);
    expect(document.title).toBe('We couldn’t load the products.');
    const ProductError = (await import('@/app/[locale]/p/[slug]/[sku]/error')).default;
    renderWithIntl(<ProductError error={new Error('x')} reset={() => {}} />);
    expect(document.title).not.toBe('');
  });

  it('Upstream fault: server error page offers retry and does not touch cookies', () => {
    const before = document.cookie;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const retry = vi.fn();
    renderWithIntl(<LocaleError error={Object.assign(new Error('db password leaked'), { digest: 'dg-123' })} retry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(screen.getByText('Your bag and your account are safe. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeInTheDocument();
    expect(document.cookie).toBe(before);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('Upstream fault: retry calls reset', () => {
    const reset = vi.fn();
    renderWithIntl(<LocaleError error={new Error('x')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('retry is preferred over reset when both are given', () => {
    const retry = vi.fn();
    const reset = vi.fn();
    renderWithIntl(<LocaleError error={new Error('x')} retry={retry} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it('server error page shows only the digest never the message', () => {
    const { container } = renderWithIntl(<LocaleError error={Object.assign(new Error('secret db password'), { digest: 'dg-123' })} retry={() => {}} />);
    expect(screen.getByText('Reference dg-123')).toBeInTheDocument();
    expect(container.textContent).not.toContain('secret db password');
  });

  it('server error without a digest shows no reference line', () => {
    renderWithIntl(<ErrorPage kind="server-error" onRetry={() => {}} />);
    expect(screen.queryByText(/Reference/)).toBeNull();
  });

  it('forbidden offers the account and contact, with no permission names', () => {
    const { container } = renderWithIntl(<Forbidden />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("You don't have access to this page.");
    expect(screen.getByRole('link', { name: 'Go to my account' })).toHaveAttribute('href', '/account');
    expect(container.textContent).not.toMatch(/associate|business unit|permission/i);
  });

  it('unauthorized links to sign-in with the current path', () => {
    nav.pathname = '/account/orders';
    renderWithIntl(<ErrorPage kind="unauthorized" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/account/sign-in?redirect=%2Faccount%2Forders');
    nav.pathname = '/';
  });

  it('each kind has one h1', () => {
    for (const kind of ['not-found', 'server-error', 'forbidden', 'unauthorized'] as const) {
      const { unmount } = renderWithIntl(<ErrorPage kind={kind} />);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      unmount();
    }
  });

  it('only the server error region has role alert', () => {
    for (const kind of ['not-found', 'forbidden', 'unauthorized'] as const) {
      const { unmount } = renderWithIntl(<ErrorPage kind={kind} />);
      expect(screen.queryByRole('alert')).toBeNull();
      unmount();
    }
  });

  it('global error dictionary has both locales', () => {
    expect(Object.keys(GLOBAL_ERROR_DICTIONARY).sort()).toEqual(['en-CA', 'en-US']);
    for (const entry of Object.values(GLOBAL_ERROR_DICTIONARY)) {
      expect(Object.keys(entry).sort()).toEqual(['home', 'reference', 'retry', 'text', 'title']);
    }
    expect(localeFromPath('/en-CA/cart')).toBe('en-CA');
    expect(localeFromPath('/xx/foo')).toBe('en-US');
    expect(localeFromPath('/')).toBe('en-US');
  });

  it('the global error page owns html and body, offers retry and shows the digest only', () => {
    const markup = renderToStaticMarkup(<GlobalError error={Object.assign(new Error('boom secret'), { digest: 'gd-9' })} retry={() => {}} />);
    expect(markup).toContain('<html');
    expect(markup).toContain('<body');
    expect(markup).toContain('Something went wrong on our side.');
    expect(markup).toContain('gd-9');
    expect(markup).not.toContain('boom secret');
  });

  it('unknown locale path renders the default-locale 404', () => {
    renderWithIntl(<RootNotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("We can't find that page.");
    expect(screen.getByRole('search')).toHaveAttribute('action', '/en-US/search');
  });

  it('the catch-all route calls notFound when the page builder has no page for the path', async () => {
    vi.doMock('@/components/page-builder/renderPage', () => ({ renderPage: async () => ({ kind: 'none' }) }));
    vi.doMock('next-intl/server', async (orig) => ({ ...(await orig<object>()), setRequestLocale: () => {} }));
    vi.resetModules();
    const { default: CatchAll } = await import('@/app/[locale]/[...rest]/page');
    await expect(CatchAll({ params: Promise.resolve({ locale: 'en-US', rest: ['nothing-here'] }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    vi.doUnmock('@/components/page-builder/renderPage');
    vi.doUnmock('next-intl/server');
  });

  it('error page imports nothing from lib/ct', () => {
    const files = [
      ...readdirSync(join(ROOT, 'components/error')).filter((f) => !f.includes('.test.')).map((f) => join('components/error', f)),
      'app/[locale]/not-found.tsx',
      'app/[locale]/error.tsx',
      'app/[locale]/forbidden.tsx',
      'app/[locale]/unauthorized.tsx',
      'app/[locale]/[...rest]/page.tsx',
      'app/not-found.tsx',
      'app/global-error.tsx',
    ];
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      expect(src, f).not.toMatch(/lib\/ct\/|lib\/session|@commercetools/);
    }
  });
});

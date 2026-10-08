import { useTranslations } from 'next-intl';
import useSWR, { useSWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import { makeJsonRequest, makeRequest, withSessionCookie } from './request';
import { renderWithProviders, screen, waitFor } from './utils';

function Probe({ id }: { id: string }) {
  const { data } = useSWR(`probe-${id}`, () => Promise.resolve(`value-${id}`));
  return <p>{data ?? 'loading'}</p>;
}

function CacheSize() {
  const { cache } = useSWRConfig();
  return <p>{`size:${[...cache.keys()].length}`}</p>;
}

function Brand() {
  const t = useTranslations('common');
  return <p>{t('brand')}</p>;
}

describe('test helpers', () => {
  it('renderWithProviders renders and jest-dom matchers are installed', async () => {
    renderWithProviders(<Probe id="a" />);
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('value-a')).toBeInTheDocument());
  });

  it('renderWithProviders gives every render a fresh SWR cache', () => {
    renderWithProviders(<CacheSize />);
    expect(screen.getByText('size:0')).toBeInTheDocument();
  });

  it('renderWithProviders provides next-intl with the en-US catalog', () => {
    renderWithProviders(<Brand />);
    expect(screen.getByText('Malva Healthcare')).toBeInTheDocument();
  });

  it('makeRequest builds an absolute Request and passes init through', async () => {
    const request = makeRequest('/api/cart', { method: 'DELETE' });
    expect(request.url).toBe('http://localhost:3000/api/cart');
    expect(request.method).toBe('DELETE');
  });

  it('withSessionCookie sets and merges the cookie header', () => {
    const init = withSessionCookie({ headers: { cookie: 'a=1' } }, 'tok');
    expect(new Headers(init.headers).get('cookie')).toBe('a=1; session=tok');
    expect(new Headers(withSessionCookie().headers).get('cookie')).toBe('session=test-session-token');
  });

  it('makeJsonRequest sends a JSON body', async () => {
    const request = makeJsonRequest('/api/cart/items', { sku: 'x' });
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toBe('application/json');
    await expect(request.json()).resolves.toEqual({ sku: 'x' });
  });
});

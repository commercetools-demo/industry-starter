import { screen } from '@testing-library/react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { describe, expect, it } from 'vitest';
import { makeRequest } from './request';
import { renderWithProviders } from './render';

function Probe() {
  const t = useTranslations('probe');
  const { data } = useSWR('probe', () => Promise.resolve('loaded'));
  return <p>{t('hello')} {data ?? 'loading'}</p>;
}

describe('test helpers', () => {
  it('renderWithProviders supplies messages and an SWR cache', async () => {
    renderWithProviders(<Probe />, { messages: { probe: { hello: 'Hello' } } });
    expect(await screen.findByText('Hello loaded')).toBeInTheDocument();
  });
  it('makeRequest builds an absolute request with JSON body and cookie', async () => {
    const req = makeRequest('/api/x', { method: 'POST', json: { a: 1 }, cookie: 'c=1' });
    expect(req.url).toBe('http://localhost:3000/api/x');
    expect(req.headers.get('cookie')).toBe('c=1');
    expect(await req.json()).toEqual({ a: 1 });
  });
});

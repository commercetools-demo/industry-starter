// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import type { ThemeTokens } from '@commercetools-demo/puck-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoreTheme, themePrimaryColour } from './theme';

const theme = (colorPrimary: unknown) => ({ colorPrimary }) as unknown as ThemeTokens;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('getStoreTheme', () => {
  it('reads the store theme with the project key and no token', async () => {
    fetchMock.mockResolvedValue(Response.json({ colorPrimary: '#1d3b78' }));
    expect(await getStoreTheme('mau-reseller-north')).toEqual({ colorPrimary: '#1d3b78' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://contentools.example.test/service/mau-reseller-north/configuration/theme');
    expect(init.headers).toEqual({ 'x-project-key': 'test-project' });
  });

  it('404 falls back to the default namespace, then to null', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 })).mockResolvedValueOnce(Response.json({ colorPrimary: '#821810' }));
    expect(await getStoreTheme('mau-reseller-south')).toEqual({ colorPrimary: '#821810' });
    expect(fetchMock.mock.calls[1][0]).toContain('/service/default/');
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
    expect(await getStoreTheme('x-none')).toBeNull();
  });

  it('a failure or a non-object body is null and never throws; an invalid key goes straight to default', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    expect(await getStoreTheme('mau-reseller-north')).toBeNull();
    fetchMock.mockResolvedValue(Response.json(null));
    expect(await getStoreTheme('mau-reseller-north')).toBeNull();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(Response.json({ colorPrimary: '#821810' }));
    await getStoreTheme('../evil');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/service/default/');
  });
});

describe('themePrimaryColour', () => {
  it('sanitises: hex, rgb and hsl come out as #rrggbb', () => {
    expect(themePrimaryColour(theme('#1D3B78'))).toBe('#1d3b78');
    expect(themePrimaryColour(theme('rgb(29, 59, 120)'))).toBe('#1d3b78');
    expect(themePrimaryColour(theme('hsl(0, 100%, 50%)'))).toBe('#ff0000');
  });

  it('anything else is the Malva default', () => {
    for (const bad of ['red; background: url(x)', 'url(javascript:alert(1))', '', 12, undefined, '#12']) expect(themePrimaryColour(theme(bad))).toBe('#821810');
    expect(themePrimaryColour(null)).toBe('#821810');
  });
});

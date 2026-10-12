import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

const headerValue = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('next/headers', () => ({ headers: async () => new Headers(headerValue.value ? { 'x-next-intl-locale': headerValue.value } : {}) }));
vi.mock('@/lib/fonts', () => ({ fontClassNames: '__inter' }));
vi.mock('./globals.css', () => ({}));

import RootLayout from './layout';

async function htmlProps(locale: string | null) {
  headerValue.value = locale;
  const el = await RootLayout({ children: null });
  expect(isValidElement(el)).toBe(true);
  return (el as ReactElement<Record<string, unknown>>).props;
}

describe('Root layout', () => {
  it('Root layout sets lang from the proxy header', async () => {
    expect((await htmlProps('en-US')).lang).toBe('en-US');
    expect((await htmlProps('de-DE')).lang).toBe('de-DE');
  });
  it('falls back to de-DE without or with an unsupported header', async () => {
    expect((await htmlProps(null)).lang).toBe('de-DE');
    expect((await htmlProps('fr-FR')).lang).toBe('de-DE');
  });
  it('Root layout starts light and carries the font class', async () => {
    const props = await htmlProps(null);
    expect(props['data-theme']).toBe('light');
    expect(props.className).toBe('__inter');
  });
});

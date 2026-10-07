import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({ getLocale: vi.fn().mockResolvedValue('de-DE') }));

import RootLayout from './layout';

describe('RootLayout', () => {
  it('Fonts available without a flash of wrong type: html carries the three next/font variables and no Google Fonts link', async () => {
    const markup = renderToStaticMarkup(
      await RootLayout({
        children: <p>child</p>,
      }),
    );
    const htmlTag = markup.match(/<html[^>]*>/)?.[0] ?? '';
    expect(htmlTag).toContain('font-exo-var');
    expect(htmlTag).toContain('font-inter-var');
    expect(htmlTag).toContain('font-roboto-var');
    expect(markup).not.toContain('fonts.googleapis.com');
    expect(markup).not.toContain('fonts.gstatic.com');
  });

  it('sets the html lang attribute to the request locale', async () => {
    const markup = renderToStaticMarkup(await RootLayout({ children: <p>child</p> }));
    expect(markup).toContain('<html lang="de-DE"');
  });
});

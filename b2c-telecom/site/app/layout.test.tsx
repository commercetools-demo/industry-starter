import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RootLayout from './layout';

describe('RootLayout', () => {
  it('Fonts available without a flash of wrong type: html carries the three next/font variables and no Google Fonts link', () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <p>child</p>
      </RootLayout>,
    );
    const htmlTag = markup.match(/<html[^>]*>/)?.[0] ?? '';
    expect(htmlTag).toContain('font-exo-var');
    expect(htmlTag).toContain('font-inter-var');
    expect(htmlTag).toContain('font-roboto-var');
    expect(markup).not.toContain('fonts.googleapis.com');
    expect(markup).not.toContain('fonts.gstatic.com');
  });
});

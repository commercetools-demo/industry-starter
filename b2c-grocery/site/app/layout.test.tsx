import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout from './layout';

describe('RootLayout', () => {
  const html = renderToStaticMarkup(<RootLayout>content</RootLayout>);

  it('puts both font variable classes on <html>', () => {
    expect(html).toMatch(/^<html[^>]*class="font-var font-var"/);
  });

  it('Network requests: no runtime Google fonts link', () => {
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });
});

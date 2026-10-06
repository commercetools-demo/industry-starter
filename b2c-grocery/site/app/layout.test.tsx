import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout from './layout';

vi.mock('next-intl/server', () => ({ getLocale: vi.fn(async () => 'de-DE') }));

describe('RootLayout', () => {
  it('sets <html lang> from the active locale and both font variable classes', async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: 'content' }));
    expect(html).toMatch(/^<html[^>]*lang="de-DE"/);
    expect(html).toMatch(/class="font-var font-var"/);
  });

  it('Network requests: no runtime Google fonts link', async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: 'content' }));
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });
});

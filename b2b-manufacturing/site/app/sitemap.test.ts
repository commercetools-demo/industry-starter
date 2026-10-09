// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const services = Array.from({ length: 12 }, (_, i) => ({ category: i < 5 ? 'plumbing' : 'waste-management', slug: `svc-${i}` }));
const fetchAll = vi.fn(async () => services);
vi.mock('@/lib/ct/services', () => ({ fetchAllServices: fetchAll }));
const { default: sitemap } = await import('./sitemap');
const { default: robots } = await import('./robots');

describe('malva-homepage › Sitemap and robots', () => {
  it('lists the public pages and all 12 services in both locales; the portal and API are absent', async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toHaveLength((6 + 12) * 2);
    for (const l of ['en-US', 'de-DE']) {
      for (const p of ['', '/plumbing', '/waste-management', '/about', '/request-a-quote', '/privacy', '/plumbing/svc-0', '/waste-management/svc-11']) expect(urls).toContain(`https://www.malva.example/${l}${p}`);
    }
    expect(urls.filter((u) => /account|\/api\//.test(u))).toEqual([]);
    expect(new Set(urls).size).toBe(urls.length);
  });
  it('every entry carries hreflang alternates', async () => {
    const e = (await sitemap())[0]!;
    expect(Object.keys(e.alternates?.languages ?? {})).toEqual(['en-US', 'de-DE', 'x-default']);
  });
  it('still lists the static pages when the catalogue is unreachable', async () => {
    fetchAll.mockRejectedValueOnce(new Error('down'));
    expect(await sitemap()).toHaveLength(12);
  });
  it('robots allows the site, blocks API and portal, points at the sitemap', () => {
    const r = robots();
    expect(r.rules).toEqual([{ userAgent: '*', allow: '/', disallow: ['/api/', '/en-US/account', '/de-DE/account'] }]);
    expect(r.sitemap).toBe('https://www.malva.example/sitemap.xml');
  });
});

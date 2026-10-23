import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { ARTICLES } from '@/content/journal';
import { buildSitemap } from './sitemap';
import { siteOrigin } from './seo';

describe('SEO', () => {
  // The origin comes from the environment; a shell with a site URL set (a developer's, a host's build) must not change the result.
  beforeEach(() => {
    for (const name of ['NEXT_PUBLIC_SITE_URL', 'URL', 'DEPLOY_PRIME_URL']) vi.stubEnv(name, '');
    vi.stubEnv('APP_MODE', 'website'); // these are the website's rules; the in-store mode is in app/robots.instore.test.ts
  });
  afterEach(() => vi.unstubAllEnvs());

  it('sitemap lists content pages in both locales', () => {
    const urls = sitemap().map((e) => e.url);
    for (const locale of ['en-US', 'en-CA']) {
      for (const path of ['', '/about', '/contact', '/faq', '/journal', '/policies/shipping-returns', '/policies/terms', '/policies/privacy', '/policies/accessibility', '/journal/brew-a-better-cup']) {
        expect(urls, `${locale}${path}`).toContain(`http://localhost:3000/${locale}${path}`);
      }
    }
  });

  it('withdrawn articles are not in the sitemap', () => {
    const urls = buildSitemap('https://shop.example', ['en-US', 'en-CA']).map((e) => e.url);
    expect(urls.some((u) => u.includes('capsule-take-back-plan'))).toBe(false);
    expect(ARTICLES.some((a) => a.status === 'withdrawn')).toBe(true);
  });

  it('alternates only list locales with their own text and lastModified comes from the content', () => {
    const entries = buildSitemap('https://shop.example', ['en-US', 'en-CA']);
    const faq = entries.find((e) => e.url === 'https://shop.example/en-CA/faq')!;
    expect(Object.keys(faq.alternates?.languages ?? {})).toEqual(['en-US']);
    const article = entries.find((e) => e.url.endsWith('/en-US/journal/brew-a-better-cup'))!;
    expect(article.lastModified).toBe('2026-10-09');
    const terms = entries.find((e) => e.url.endsWith('/en-US/policies/terms'))!;
    expect(terms.lastModified).toBe('2026-10-01');
  });

  it('robots disallows api account cart and checkout and points at the sitemap', () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.allow).toBe('/');
    expect(rules.disallow).toEqual(['/api/', '/*/account', '/*/cart', '/*/checkout']);
    expect(r.sitemap).toBe('http://localhost:3000/sitemap.xml');
  });

  it('the site origin comes from the environment without a trailing slash', () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'https://shop.example/' })).toBe('https://shop.example');
    expect(siteOrigin({})).toBe('http://localhost:3000');
  });
});

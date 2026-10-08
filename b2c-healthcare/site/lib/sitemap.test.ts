// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getPublishedArticles } from './content';
import { absoluteUrl, languageAlternates, pageMetadata, siteUrl } from './seo';
import { buildRobots, buildSitemap } from './sitemap';

const origin = 'https://shop.example';

describe('blog-resources › Articles addressable and indexable (sitemap, robots, canonical)', () => {
  it('siteUrl: SITE_URL when valid (trailing slash trimmed), else the local default', () => {
    expect(siteUrl({ SITE_URL: 'https://shop.example/' })).toBe(origin);
    expect(siteUrl({ SITE_URL: 'not a url' })).toBe('http://localhost:3000');
    expect(siteUrl({})).toBe('http://localhost:3000');
  });

  it('absolute canonical and hreflang URLs carry the locale prefix', () => {
    expect(absoluteUrl('en-US', '/faq', origin)).toBe('https://shop.example/en-US/faq');
    expect(absoluteUrl('en-US', '/', origin)).toBe('https://shop.example/en-US');
    expect(languageAlternates('/faq', origin)).toEqual({
      'en-US': 'https://shop.example/en-US/faq',
      'x-default': 'https://shop.example/en-US/faq',
    });
    expect(pageMetadata({ locale: 'en-US', path: '/faq', title: 'FAQ' }).alternates?.canonical).toMatch(/^https?:\/\/.+\/en-US\/faq$/);
  });

  it('sitemap lists the static pages, the journal and each published article; not the withdrawn one', () => {
    const urls = buildSitemap(origin).map((entry) => entry.url);
    for (const path of ['', '/about', '/contact', '/faq', '/journal', '/policies/terms', '/policies/privacy', '/policies/shipping-and-returns']) {
      expect(urls).toContain(`${origin}/en-US${path}`);
    }
    for (const article of getPublishedArticles('en-US')) expect(urls).toContain(`${origin}/en-US/journal/${article.slug}`);
    expect(urls).not.toContain(`${origin}/en-US/journal/retired-article`);
    expect(urls.every((url) => url.startsWith('https://'))).toBe(true);
    const entry = buildSitemap(origin).find((e) => e.url.endsWith('/journal/sleep-basics'));
    expect(entry?.alternates?.languages?.['x-default']).toBe(`${origin}/en-US/journal/sleep-basics`);
    expect(entry?.lastModified).toBe('2026-09-01');
  });

  it('robots points at the sitemap and keeps private areas out', () => {
    const robots = buildRobots(origin);
    expect(robots.sitemap).toBe(`${origin}/sitemap.xml`);
    expect(JSON.stringify(robots.rules)).toContain('/*/cart');
    expect(JSON.stringify(robots.rules)).not.toContain('/faq');
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { absoluteUrl, alternateLanguages, organizationJsonLd, pageMetadata, siteUrl } from './seo';

describe('malva-homepage › SEO metadata', () => {
  it('SITE_URL wins, then the deploy URL, then a placeholder; never the request host', () => {
    expect(siteUrl({ SITE_URL: 'https://malva.example/', DEPLOY_PRIME_URL: 'https://preview' })).toBe('https://malva.example');
    expect(siteUrl({ DEPLOY_PRIME_URL: 'https://deploy-preview-1--malva.netlify.app' })).toBe('https://deploy-preview-1--malva.netlify.app');
    expect(siteUrl({})).toBe('https://www.malva.example');
  });
  it('canonical and hreflang are absolute, include x-default and both locales', () => {
    const m = pageMetadata({ locale: 'de-DE', title: 'T', description: 'D', path: '/about' });
    expect(m.alternates?.canonical).toBe(`${siteUrl()}/de-DE/about`);
    expect(m.alternates?.languages).toEqual({ 'en-US': `${siteUrl()}/en-US/about`, 'de-DE': `${siteUrl()}/de-DE/about`, 'x-default': `${siteUrl()}/en-US/about` });
    expect(m.openGraph).toMatchObject({ url: `${siteUrl()}/de-DE/about`, locale: 'de-DE', type: 'website' });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
  });
  it('the home path has no trailing slash', () => {
    expect(absoluteUrl('en-US', '')).toBe(`${siteUrl()}/en-US`);
    expect(absoluteUrl('en-US', '/')).toBe(`${siteUrl()}/en-US`);
    expect(Object.keys(alternateLanguages())).toEqual(['en-US', 'de-DE', 'x-default']);
  });
  it('noindex pages say so', () => {
    expect(pageMetadata({ locale: 'en-US', title: 'T', description: 'D', noindex: true }).robots).toEqual({ index: false, follow: false });
  });
  it('Organization JSON-LD has no rating, price or sample content', () => {
    const json = JSON.stringify(organizationJsonLd('+448005550142'));
    expect(JSON.parse(json)['@type']).toBe('Organization');
    expect(json).not.toMatch(/aggregateRating|review|price|sample/i);
  });
});

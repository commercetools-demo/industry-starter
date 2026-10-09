// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { auditPage, crossChecks } from './seo-audit.mjs';

const page = (over = {}) => `<html lang="en-US"><head><title>${over.title ?? 'About Malva'}</title><meta name="description" content="${over.description ?? 'About us'}"/><link rel="canonical" href="https://x.example/en-US/about"/><link rel="alternate" hrefLang="en-US" href="a"/><link rel="alternate" hrefLang="de-DE" href="b"/><link rel="alternate" hrefLang="x-default" href="c"/><meta property="og:title" content="t"/><meta property="og:image" content="i"/><meta name="twitter:card" content="summary"/></head><body>${over.body ?? '<h1>Hi</h1>'}</body></html>`;

describe('malva-homepage › SEO audit script', () => {
  it('passes a complete page', () => { expect(auditPage(page(), '/en-US/about').problems).toEqual([]); });
  it('flags long titles, missing or extra h1 and a wrong canonical', () => {
    expect(auditPage(page({ title: 'x'.repeat(61) }), '/en-US/about').problems).toEqual(['title is 61 characters']);
    expect(auditPage(page({ body: '<h1>a</h1><h1>b</h1>' }), '/en-US/about').problems).toEqual(['2 h1 elements']);
    expect(auditPage(page(), '/en-US/other').problems[0]).toMatch(/canonical/);
  });
  it('flags unparseable JSON-LD and sample content in it', () => {
    expect(auditPage(page({ body: '<h1>a</h1><script type="application/ld+json">{bad</script>' }), '/en-US/about').problems).toEqual(['JSON-LD does not parse']);
    expect(auditPage(page({ body: '<h1>a</h1><script type="application/ld+json">{"name":"Sample content"}</script>' }), '/en-US/about').problems).toEqual(['JSON-LD mentions sample content']);
  });
  it('finds duplicate titles and descriptions across pages', () => {
    expect(crossChecks([{ path: '/en-US/a', title: 'T', description: 'D1' }, { path: '/en-US/b', title: 'T', description: 'D2' }, { path: '/de-DE/a', title: 'T', description: 'D3' }])).toEqual(['duplicate title "T": /en-US/a, /en-US/b']);
  });
});

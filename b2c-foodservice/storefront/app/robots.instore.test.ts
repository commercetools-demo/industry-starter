import { afterEach, describe, expect, it, vi } from 'vitest';
import robots from './robots';
import sitemap from './sitemap';

afterEach(() => vi.unstubAllEnvs());

describe('Crawlers in instore mode (workstream R)', () => {
  it('robots disallows everything and sitemap is empty', () => {
    vi.stubEnv('APP_MODE', 'instore');
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
    expect(sitemap()).toEqual([]);
  });

  it('the website still lists its pages and keeps its rules', () => {
    vi.stubEnv('APP_MODE', 'website');
    const r = robots();
    expect(r.sitemap).toMatch(/sitemap\.xml$/);
    expect(sitemap().length).toBeGreaterThan(0);
  });
});

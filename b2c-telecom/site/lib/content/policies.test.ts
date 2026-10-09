// @vitest-environment node
import { makeContentRoot, removeContentRoots } from '@/test/content-fixtures';
import { LEGAL_SLUGS, getPolicy, legalPath, listVersions } from './policies';
import { ContentError } from './types';

afterEach(removeContentRoots);

function version(effective: string, body: string): string {
  return `---\ntitle: Shipping ${effective}\ndescription: d\neffective: ${effective}\n---\n${body}\n`;
}

const NOW = new Date('2026-03-15T10:00:00Z');
const base = (extra: Record<string, string> = {}) =>
  makeContentRoot({
    'en-US/legal/shipping-returns/2025-06-01.md': version('2025-06-01', 'Old text'),
    'en-US/legal/shipping-returns/2026-01-01.md': version('2026-01-01', 'Current text'),
    ...extra,
  });

describe('getPolicy', () => {
  it('Version superseded: the newest effective version is served with its own effective date', () => {
    const root = base();
    const doc = getPolicy('shipping-returns', 'en-US', { root, now: NOW })!;
    expect(doc.effective).toBe('2026-01-01');
    expect(doc.currentEffective).toBe('2026-01-01');
    expect(doc.superseded).toBe(false);
    expect(doc.earlier).toEqual(['2025-06-01']);
    expect(doc.html).toContain('Current text');
  });

  it('a version dated in the future stays hidden until its date', () => {
    const root = base({ 'en-US/legal/shipping-returns/2026-06-01.md': version('2026-06-01', 'Future text') });
    expect(getPolicy('shipping-returns', 'en-US', { root, now: NOW })!.effective).toBe('2026-01-01');
    expect(getPolicy('shipping-returns', 'en-US', { root, now: new Date('2026-06-01T00:00:00Z') })!.effective).toBe('2026-06-01');
  });

  it('asOf in the future cannot reveal an unpublished version', () => {
    const root = base({ 'en-US/legal/shipping-returns/2026-06-01.md': version('2026-06-01', 'Future text') });
    expect(getPolicy('shipping-returns', 'en-US', { root, now: NOW, asOf: '2030-01-01' })!.effective).toBe('2026-01-01');
  });

  it('asOf selects the older version and sets superseded and supersededOn', () => {
    const doc = getPolicy('shipping-returns', 'en-US', { root: base(), now: NOW, asOf: '2025-12-31' })!;
    expect(doc).toMatchObject({ effective: '2025-06-01', superseded: true, supersededOn: '2026-01-01', currentEffective: '2026-01-01', earlier: [] });
    expect(doc.html).toContain('Old text');
  });

  it('an invalid asOf is ignored', () => {
    for (const asOf of ['banana', '2026-13-45', '2026-02-30', '']) {
      expect(getPolicy('shipping-returns', 'en-US', { root: base(), now: NOW, asOf })!.effective).toBe('2026-01-01');
    }
  });

  it('asOf before the first version is null', () => {
    expect(getPolicy('shipping-returns', 'en-US', { root: base(), now: NOW, asOf: '2020-01-01' })).toBeNull();
  });

  it('an unknown policy is null', () => {
    expect(getPolicy('nope', 'en-US', { root: base(), now: NOW })).toBeNull();
    expect(getPolicy('../terms', 'en-US', { root: base(), now: NOW })).toBeNull();
  });

  it('Policy not translated: the English version set is served and flagged', () => {
    const doc = getPolicy('shipping-returns', 'de-DE', { root: base(), now: NOW })!;
    expect(doc).toMatchObject({ servedLocale: 'en-US', fallback: true, effective: '2026-01-01' });
    expect(doc.earlier).toEqual(['2025-06-01']);
  });

  it('a German set is used whole when it exists', () => {
    const root = base({ 'de-DE/legal/shipping-returns/2026-01-01.md': version('2026-01-01', 'Deutscher Text') });
    const doc = getPolicy('shipping-returns', 'de-DE', { root, now: NOW })!;
    expect(doc).toMatchObject({ servedLocale: 'de-DE', fallback: false, earlier: [] });
    expect(doc.html).toContain('Deutscher Text');
  });

  it('front matter effective date must equal the file name', () => {
    const root = makeContentRoot({ 'en-US/legal/terms/2026-01-01.md': version('2026-02-02', 'x') });
    expect(() => getPolicy('terms', 'en-US', { root, now: NOW })).toThrow(ContentError);
    expect(() => getPolicy('terms', 'en-US', { root, now: NOW })).toThrow('must equal the file name');
  });

  it('listVersions lists newest first and ignores other files', () => {
    const root = base({ 'en-US/legal/shipping-returns/notes.txt': 'x', 'en-US/legal/shipping-returns/readme.md': 'x' });
    expect(listVersions('shipping-returns', 'en-US', { root })).toEqual(['2026-01-01', '2025-06-01']);
  });

  it('exposes the three policy slugs and their paths', () => {
    expect([...LEGAL_SLUGS]).toEqual(['shipping-returns', 'terms', 'privacy']);
    expect(legalPath('terms')).toBe('/legal/terms');
  });
});

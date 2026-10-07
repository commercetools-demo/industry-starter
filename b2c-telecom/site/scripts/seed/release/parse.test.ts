// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ManifestError, canonicalJson, parseReleaseManifest, sha256OfManifest } from './parse';

const examples = path.resolve(__dirname, '..', 'releases', 'examples');
const read = (name: string): string => readFileSync(path.join(examples, `${name}.release.json`), 'utf8');

function issuesOf(input: unknown): string[] {
  try {
    parseReleaseManifest(input);
  } catch (err) {
    if (err instanceof ManifestError) return err.issues.map((i) => `${i.code} ${i.key}`);
    throw err;
  }
  return [];
}

describe('parseReleaseManifest', () => {
  it('parses the summer example and fills the empty lists', () => {
    const manifest = parseReleaseManifest(read('malva-rel-example-summer-unlimited'));
    expect(manifest.key).toBe('malva-rel-example-summer-unlimited');
    expect(manifest.createOffers).toHaveLength(1);
    expect(manifest.replaces).toEqual([{ old: 'malva-offer-phone-online-only', new: 'malva-offer-phone-unlimited-summer' }]);
    expect(manifest.patchOffers).toEqual([]);
  });

  it('parses the broken example (it is valid JSON that names a missing offer)', () => {
    const manifest = parseReleaseManifest(read('malva-rel-example-broken'));
    expect(manifest.withdrawOffers).toEqual(['malva-offer-nope']);
    expect(manifest.createOffers).toEqual([]);
  });

  it('rejects a releaseAt without Z', () => {
    const raw = JSON.parse(read('malva-rel-example-broken')) as Record<string, unknown>;
    expect(issuesOf({ ...raw, releaseAt: '2026-12-01T09:00:00' })).toEqual(['PARSE releaseAt']);
    expect(issuesOf({ ...raw, releaseAt: '2026-12-01T09:00:00+01:00' })).toEqual(['PARSE releaseAt']);
  });

  it('rejects a bad key pattern', () => {
    const raw = JSON.parse(read('malva-rel-example-broken')) as Record<string, unknown>;
    expect(issuesOf({ ...raw, key: 'rel-1' })).toContain('PARSE key');
    expect(issuesOf({ ...raw, key: 'malva-rel-UPPER' })).toContain('PARSE key');
  });

  it('rejects unknown fields and names a forbidden resource', () => {
    const raw = JSON.parse(read('malva-rel-example-broken')) as Record<string, unknown>;
    expect(issuesOf({ ...raw, surprise: true })).toEqual(['PARSE surprise']);
    expect(issuesOf({ ...raw, productTypes: [] })).toEqual(['FORBIDDEN_RESOURCE productTypes']);
  });

  it('rejects text that is not JSON and values of the wrong shape', () => {
    expect(issuesOf('{nope')).toEqual(['PARSE -']);
    const raw = JSON.parse(read('malva-rel-example-broken')) as Record<string, unknown>;
    expect(issuesOf({ ...raw, withdrawOffers: 'malva-offer-x' })).toEqual(['PARSE withdrawOffers']);
  });

  it('hash is stable across key order', () => {
    const manifest = parseReleaseManifest(read('malva-rel-example-summer-unlimited'));
    const reordered = parseReleaseManifest(JSON.stringify(Object.fromEntries(Object.entries(manifest).reverse())));
    expect(sha256OfManifest(reordered)).toBe(sha256OfManifest(manifest));
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"b":1}');
    expect(sha256OfManifest({ ...manifest, name: 'other' })).not.toBe(sha256OfManifest(manifest));
  });
});

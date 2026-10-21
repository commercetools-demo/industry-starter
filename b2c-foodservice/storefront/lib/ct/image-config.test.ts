import { describe, expect, it } from 'vitest';
import {
  cleanImageUrl, transformDetailImageUrl, transformListingImageUrl, transformThumbnailImageUrl,
} from '@/lib/ct/image-config';
import { mapImages } from '@/lib/mappers/image';

const URL_DIRTY = 'https://img.example.com/a/b.jpg?w=10&token=x#frag';
const URL_CLEAN = 'https://img.example.com/a/b.jpg';

describe('image config', () => {
  it('cleanImageUrl removes query and fragment', () => {
    expect(cleanImageUrl(URL_DIRTY)).toBe(URL_CLEAN);
  });

  it('Transforms add size parameters to a clean URL', () => {
    expect(transformListingImageUrl(URL_CLEAN)).toBe(`${URL_CLEAN}?auto=compress&fit=crop&w=600&h=720`);
  });

  it('Transforms never double a query that is already stripped', () => {
    const out = transformListingImageUrl(URL_DIRTY);
    expect(out.match(/\?/g)).toHaveLength(1);
    expect(out).not.toContain('token');
    expect(out).not.toContain('#');
  });

  it('A non-https or invalid URL is returned unchanged', () => {
    for (const u of ['http://x.example.com/a.jpg?w=1', 'not a url', '/local/a.jpg']) {
      expect(cleanImageUrl(u)).toBe(u);
      expect(transformDetailImageUrl(u)).toBe(u);
    }
  });

  it('mapImages stores and returns the clean URL even if the source has a query', () => {
    const [img] = mapImages([{ url: URL_DIRTY, dimensions: { w: 100, h: 120 }, label: 'Pack' }], 'Name');
    expect(img).toEqual({ url: URL_CLEAN, width: 100, height: 120, alt: 'Pack' });
    expect(mapImages(undefined, 'x')).toEqual([]);
    expect(mapImages([{ url: URL_CLEAN, dimensions: { w: 1, h: 1 } }], 'Fallback')[0].alt).toBe('Fallback');
  });

  it('Components call the three transforms: listing, detail and thumbnail differ in size', () => {
    const outs = [transformListingImageUrl, transformDetailImageUrl, transformThumbnailImageUrl].map((f) => f(URL_CLEAN));
    expect(new Set(outs).size).toBe(3);
    expect(outs[1]).toContain('w=1200&h=1440');
    expect(outs[2]).toContain('w=160&h=192');
  });
});

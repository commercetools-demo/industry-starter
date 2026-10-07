// @vitest-environment node
import { makeContentRoot, removeContentRoots } from '@/test/content-fixtures';
import path from 'node:path';
import { getImageCredits } from './credits';

afterEach(removeContentRoots);

function lock(json: unknown): string {
  return path.join(makeContentRoot({ 'lock.json': JSON.stringify(json) }), 'lock.json');
}

describe('getImageCredits', () => {
  it('credits are de-duplicated by photographer and sorted', () => {
    const file = lock({
      a: { images: [{ photographer: 'Zoe Lee', photoUrl: 'https://www.pexels.com/photo/1' }, { photographer: 'Ada Ng', photoUrl: 'https://www.pexels.com/photo/2' }] },
      b: [{ photographer: 'Zoe Lee', url: 'https://images.pexels.com/photos/3.jpg' }],
    });
    expect(getImageCredits({ file })).toEqual([
      { photographer: 'Ada Ng', url: 'https://www.pexels.com/photo/2' },
      { photographer: 'Zoe Lee', url: 'https://www.pexels.com/photo/1' },
    ]);
  });

  it('a missing or unparsable file gives an empty list', () => {
    expect(getImageCredits({ file: path.join(makeContentRoot({}), 'none.json') })).toEqual([]);
    const root = makeContentRoot({ 'bad.json': '{not json' });
    expect(getImageCredits({ file: path.join(root, 'bad.json') })).toEqual([]);
  });

  it('entries without a photographer or without an https link are skipped', () => {
    const file = lock({ a: { images: [{ photographer: null, url: 'https://x.test/1' }, { photographer: '  ', url: 'https://x.test/2' }, { photographer: 'No Link', url: 'http://x.test/3' }] } });
    expect(getImageCredits({ file })).toEqual([]);
  });

  it('accepts array values and falls back from photoUrl to page to url', () => {
    const file = lock({ a: [{ photographer: 'Pat', page: 'https://www.pexels.com/photo/9', url: 'https://images.pexels.com/9.jpg' }] });
    expect(getImageCredits({ file })).toEqual([{ photographer: 'Pat', url: 'https://www.pexels.com/photo/9' }]);
  });

  it('the real lock file (all photographers null today) yields a list without throwing', () => {
    expect(Array.isArray(getImageCredits())).toBe(true);
  });
});

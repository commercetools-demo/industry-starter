// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getPage, parseFrontMatter } from './content';

describe('parseFrontMatter', () => {
  it('reads title and description and strips the block', () => {
    const { data, body } = parseFrontMatter('---\ntitle: "Hello: world"\ndescription: Short\n---\n# Body\n');
    expect(data).toEqual({ title: 'Hello: world', description: 'Short' });
    expect(body).toBe('# Body\n');
  });

  it('no front matter: whole source is the body', () => {
    expect(parseFrontMatter('Just text')).toEqual({ data: {}, body: 'Just text' });
  });
});

describe('getPage', () => {
  it('reads the page from both locales with front matter and HTML', async () => {
    const en = await getPage('about', 'en-US');
    const de = await getPage('about', 'de-DE');
    expect(en?.title).toBe('About us');
    expect(en?.description).not.toBe('');
    expect(en?.html).toContain('<h2>');
    expect(de?.title).toBe('Über uns');
  });

  it('missing page: null', async () => {
    expect(await getPage('nope', 'en-US')).toBeNull();
    expect(await getPage('about', 'fr-FR')).toBeNull();
  });

  it('path traversal: null', async () => {
    expect(await getPage('../package', 'en-US')).toBeNull();
    expect(await getPage('about', '../x')).toBeNull();
  });
});

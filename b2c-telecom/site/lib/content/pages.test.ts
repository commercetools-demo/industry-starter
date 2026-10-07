// @vitest-environment node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { makeContentRoot, pageFile, removeContentRoots } from '@/test/content-fixtures';
import { getPage } from './pages';
import { ContentError } from './types';

afterEach(removeContentRoots);

describe('getPage', () => {
  it('Locale without translation: de-DE falls back to the English file and is flagged', () => {
    const root = makeContentRoot({ 'en-US/about.md': pageFile('About', 'English body') });
    const doc = getPage('about', 'de-DE', { root });
    expect(doc).toMatchObject({ title: 'About', servedLocale: 'en-US', fallback: true });
    expect(doc?.html).toContain('English body');
  });

  it('serves the German file when it exists, without a fallback flag', () => {
    const root = makeContentRoot({ 'en-US/about.md': pageFile('About'), 'de-DE/about.md': pageFile('Über', 'Deutscher Text', 'kicker: Über uns\n') });
    const doc = getPage('about', 'de-DE', { root });
    expect(doc).toMatchObject({ title: 'Über', kicker: 'Über uns', servedLocale: 'de-DE', fallback: false });
    expect(doc?.html).toContain('Deutscher Text');
  });

  it('en-US never falls back and a missing file is null', () => {
    const root = makeContentRoot({ 'de-DE/about.md': pageFile('Über') });
    expect(getPage('about', 'en-US', { root })).toBeNull();
  });

  it('getPage rejects slugs with dots, slashes or uppercase', () => {
    const root = makeContentRoot({ 'en-US/about.md': pageFile('About') });
    mkdirSync(path.join(root, 'en-US'), { recursive: true });
    writeFileSync(path.join(root, 'secret.md'), pageFile('Secret'));
    for (const slug of ['../secret', 'About', 'a/b', 'about.md', '']) {
      expect(getPage(slug as never, 'en-US', { root })).toBeNull();
    }
  });

  it('a file with a missing front matter key is a ContentError, not a blank page', () => {
    const root = makeContentRoot({ 'en-US/about.md': '---\ntitle: Only title\n---\nBody' });
    expect(() => getPage('about', 'en-US', { root })).toThrow(ContentError);
    expect(() => getPage('about', 'en-US', { root })).toThrow('en-US/about.md: missing description');
  });

  it('Replacement behaviour: rewriting the about file changes the served text and no old copy is reachable', () => {
    const root = makeContentRoot({ 'en-US/about.md': pageFile('About', 'Old claim') });
    expect(getPage('about', 'en-US', { root })?.html).toContain('Old claim');
    writeFileSync(path.join(root, 'en-US/about.md'), pageFile('About', 'Corrected text'));
    const html = getPage('about', 'en-US', { root })?.html ?? '';
    expect(html).toContain('Corrected text');
    expect(html).not.toContain('Old claim');
  });
});

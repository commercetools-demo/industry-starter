import { readFileSync } from 'node:fs';
import path from 'node:path';
import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { ContentArticle } from '@/components/content/ContentArticle';
import { contentMetadata } from '@/lib/content/metadata';
import { getPage } from '@/lib/content/pages';
import { makeContentRoot, pageFile, removeContentRoots } from '@/test/content-fixtures';
import { renderWithProviders } from '@/test/utils';
import enMessages from '@/messages/en-US.json';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => createTranslator({ locale: 'en-US', messages: enMessages }),
}));
// Every commerce module throws on import: the page must not need any of them.
vi.mock('@/lib/ct/client', () => {
  throw new Error('commerce tier is down');
});
vi.mock('@/lib/ct/session', () => {
  throw new Error('commerce tier is down');
});
vi.mock('@/lib/ct/catalog', () => {
  throw new Error('commerce tier is down');
});

import AboutPage, { generateMetadata } from './page';

const FORBIDDEN = [
  'certified', 'certification', 'accredited', 'ISO', 'SOC', 'GDPR-compliant', 'award', 'award-winning', 'best', 'fastest', '#1', 'guarantee',
  'guaranteed', 'licensed', 'zertifiziert', 'Zertifizierung', 'ausgezeichnet', 'beste', 'schnellste', 'garantiert', 'Garantie', 'lizenziert',
];

function params(locale: string) {
  return { params: Promise.resolve({ locale }) };
}

afterEach(removeContentRoots);

describe('about page', () => {
  it('Commerce tier degraded: the about page renders in full when every lib/ct module throws and imports none', async () => {
    const source = readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');
    expect(source).not.toMatch(/@\/lib\/ct/);
    renderWithProviders(await AboutPage(params('en-US')));
    expect(screen.getByRole('heading', { level: 1, name: 'About Malva Telecom' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'frequently asked questions' })).toHaveAttribute('href', '/en-US/faq');
    expect(screen.getByRole('link', { name: 'contact support' })).toHaveAttribute('href', '/en-US/support');
  });

  it('serves German for de-DE with the German title and no fallback notice', async () => {
    renderWithProviders(await AboutPage(params('de-DE')), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Über Malva Telecom' })).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    const metadata = await generateMetadata(params('de-DE'));
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates?.canonical).toMatch(/\/de-DE\/about$/);
  });

  it('Locale without translation: the fallback notice is shown and the page is noindex', async () => {
    const root = makeContentRoot({ 'en-US/about.md': pageFile('About English', 'English only') });
    const doc = getPage('about', 'de-DE', { root });
    expect(doc?.fallback).toBe(true);
    renderWithProviders(<ContentArticle doc={doc!} />, { locale: 'de-DE' });
    expect(screen.getByRole('note')).toHaveTextContent('Diese Seite ist in dieser Sprache noch nicht verfügbar');
    expect(screen.getByRole('article')).toHaveAttribute('lang', 'en');
    const metadata = contentMetadata({ title: doc!.title, description: doc!.description, locale: 'de-DE', pathname: '/about', fallback: true });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toMatch(/\/en-US\/about$/);
  });

  it('about files contain none of the forbidden claim words', () => {
    for (const locale of ['en-US', 'de-DE']) {
      const text = readFileSync(path.join(process.cwd(), 'content', locale, 'about.md'), 'utf8');
      for (const word of FORBIDDEN) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        expect(new RegExp(`(?<![\\w#])${escaped}(?![\\w])`, 'i').test(text), `${locale}: ${word}`).toBe(false);
      }
    }
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { getAbout } from '@/lib/content';
import messages from '@/messages/en-US.json';
import { localImportGraph } from '@/test/import-graph';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (namespace: string) => createTranslator({ locale: 'en-US', messages, namespace: namespace as 'static.about' }),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import AboutPage from './page';

const render = async (locale = 'en-US') => renderWithProviders(await AboutPage({ params: Promise.resolve({ locale }) }));

describe('about-us › About page assembled entirely from published CMS content', () => {
  it('renders the story, credentials and the route to sales from the content file', async () => {
    await render();
    expect(screen.getByRole('heading', { level: 1, name: 'About Malva Healthcare' })).toBeInTheDocument();
    for (const name of ['Our story', 'Credentials', 'Partnerships and sales']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/en-US/contact');
  });

  it('Editor publishes a correction: the page reads the current file, so the revised text replaces the old at the same address', () => {
    const root = mkdtempSync(join(tmpdir(), 'about-'));
    try {
      mkdirSync(join(root, 'about'));
      writeFileSync(join(root, 'about/index.md'), '---\ntitle: About\n---\nOld claim');
      expect(getAbout('en-US', root)?.body).toBe('Old claim');
      writeFileSync(join(root, 'about/index.md'), '---\ntitle: About\n---\nCorrected claim');
      expect(getAbout('en-US', root)?.body).toBe('Corrected claim');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('Commerce tier degraded: the page and everything it imports stay clear of lib/ct and lib/session', () => {
    const files = localImportGraph(`${import.meta.dirname}/page.tsx`);
    expect(files).toContain('lib/content.ts');
    expect(files.filter((file) => /^lib\/(ct|session)(\/|\.)/.test(file))).toEqual([]);
  });

  it('Locale without translation: the English page is served and identified as such', async () => {
    await render('fr-FR');
    expect(screen.getByText(messages.content.fallbackNotice)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'About Malva Healthcare' })).toBeInTheDocument();
  });
});

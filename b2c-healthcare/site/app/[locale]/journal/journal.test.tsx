import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { getSiteImage } from '@/lib/site-images';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (namespace: string) => createTranslator({ locale: 'en-US', messages, namespace: namespace as 'static.journal' }),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import ArticlePage, { generateMetadata, generateStaticParams } from './[slug]/page';
import JournalPage from './page';

const list = async (category?: string) =>
  renderWithProviders(await JournalPage({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve({ category }) }));
const article = async (slug: string) => renderWithProviders(await ArticlePage({ params: Promise.resolve({ locale: 'en-US', slug }) }));

describe('blog-resources › Articles addressable and indexable independently of the listing', () => {
  it('lists the three published articles with title, description, category and reading time; no withdrawn one', async () => {
    await list();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Five habits for better sleep' })).toHaveAttribute('href', '/en-US/journal/sleep-basics');
    expect(screen.queryByText('A retired article')).toBeNull();
    expect(screen.getByText('4 min read')).toBeInTheDocument();
  });

  it('covers: no seeded image falls back to a token-styled placeholder (nothing invented)', async () => {
    const { container } = await list();
    expect(getSiteImage('journal-1')).toBeNull();
    expect(container.querySelectorAll('[data-cover="placeholder"]')).toHaveLength(3);
    expect(container.querySelector('img')).toBeNull();
  });

  it('covers: a seeded slot renders its photo; non-https and unknown slots do not', () => {
    const images = { 'journal-1': { url: 'https://images.example/a.jpg', photographer: 'P' }, 'journal-2': { url: 'javascript:x' } };
    expect(getSiteImage('journal-1', images)).toEqual({ url: 'https://images.example/a.jpg', photographer: 'P' });
    expect(getSiteImage('journal-2', images)).toBeNull();
    expect(getSiteImage('journal-9', images)).toBeNull();
  });

  it('the category filter narrows the list and marks the applied filter', async () => {
    await list('Care');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Care' })).toHaveAttribute('aria-current', 'true');
  });

  it('Filter matches nothing: states that nothing matched, keeps the filter visible and offers to relax it', async () => {
    await list('Nonexistent');
    expect(screen.getByRole('heading', { name: 'No articles match' })).toBeInTheDocument();
    expect(screen.getByText('Category: Nonexistent')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Show all articles' })).toHaveAttribute('href', '/en-US/journal');
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('each article has its own address with title, description and absolute canonical metadata', async () => {
    expect(generateStaticParams().map((p) => p.slug)).toEqual(expect.arrayContaining(['sleep-basics', 'retired-article']));
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en-US', slug: 'sleep-basics' }) });
    expect(meta.title).toBe('Five habits for better sleep');
    expect(meta.description).toBe('Draft article about simple sleep habits.');
    expect(meta.alternates?.canonical).toBe('http://localhost:3000/en-US/journal/sleep-basics');
    await article('sleep-basics');
    expect(screen.getByRole('heading', { level: 1, name: 'Five habits for better sleep' })).toBeInTheDocument();
    expect(screen.getByText(/Keep a steady schedule/)).toBeInTheDocument();
  });

  it('Article withdrawn: the text is not served and the reader is directed to the topic', async () => {
    const { container } = await article('retired-article');
    expect(screen.getByRole('heading', { level: 1, name: 'This article is no longer available' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('must never be served');
    expect(screen.queryByText('A retired article')).toBeNull();
    expect(screen.getByRole('link', { name: 'More articles in Care' })).toHaveAttribute('href', '/en-US/journal?category=Care');
    expect(screen.getByRole('link', { name: 'Back to the health journal' })).toHaveAttribute('href', '/en-US/journal');
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en-US', slug: 'retired-article' }) });
    expect(meta.robots).toMatchObject({ index: false });
  });

  it('an unknown slug is a not-found', async () => {
    await expect(article('does-not-exist')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('Article without tags: the related-content block is omitted', async () => {
    await article('preparing-for-a-video-visit');
    expect(screen.queryByRole('heading', { name: 'Related articles' })).toBeNull();
  });

  it('a tagged article shows related articles that share a tag', async () => {
    await article('sleep-basics');
    expect(screen.getByRole('heading', { name: 'Related articles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How to read your lab results' })).toBeInTheDocument();
  });
});

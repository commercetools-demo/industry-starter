import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: 'en-US' | 'de-DE'; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : enMessages, namespace: namespace as 'content.blog' }),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
const overrides = vi.hoisted(() => ({ getArticle: null as null | ((actual: unknown) => unknown) }));
vi.mock('@/lib/content/blog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/content/blog')>();
  return { ...actual, getArticle: (...args: Parameters<typeof actual.getArticle>) => (overrides.getArticle ? overrides.getArticle(actual.getArticle(...args)) : actual.getArticle(...args)) };
});

import ArticlePage, { generateMetadata, generateStaticParams } from './page';

function props(slug: string, locale = 'en-US') {
  return { params: Promise.resolve({ locale, slug }) };
}

afterEach(() => {
  overrides.getArticle = null;
});

describe('blog article page', () => {
  it('article metadata has title, description, canonical, language alternates and openGraph article fields', async () => {
    const metadata = await generateMetadata(props('reading-the-broadband-facts-label'));
    expect(metadata.title).toBe('How to read the Broadband Facts label');
    expect(metadata.description).toBe('What the label on every internet plan tells you.');
    expect(metadata.alternates?.canonical).toMatch(/\/en-US\/blog\/reading-the-broadband-facts-label$/);
    expect(Object.keys(metadata.alternates?.languages ?? {}).sort()).toEqual(['de-DE', 'en-US']);
    expect(metadata.openGraph).toMatchObject({ type: 'article', publishedTime: '2026-09-16', modifiedTime: '2026-09-16', locale: 'en_US' });
    expect(metadata.robots).toBeUndefined();
  });

  it('article JSON-LD has headline, datePublished, dateModified, inLanguage and escapes `<`', async () => {
    overrides.getArticle = (found) => {
      const result = found as { kind: 'article'; article: { title: string; updated?: string } };
      return { ...result, article: { ...result.article, title: 'Tags </script> inside', updated: '2026-10-01' } };
    };
    const { container } = renderWithProviders(await ArticlePage(props('reading-the-broadband-facts-label')));
    const script = container.querySelector('script[type="application/ld+json"]')!;
    expect(script.innerHTML).not.toContain('</script>');
    expect(script.innerHTML).toContain('\\u003c/script>');
    const data = JSON.parse(script.textContent!) as Record<string, unknown>;
    expect(data).toMatchObject({
      '@type': 'Article',
      headline: 'Tags </script> inside',
      datePublished: '2026-09-16',
      dateModified: '2026-10-01',
      inLanguage: 'en-US',
      author: { name: 'Malva Telecom' },
    });
    expect((data.mainEntityOfPage as { '@id': string })['@id']).toMatch(/\/en-US\/blog\/reading-the-broadband-facts-label$/);
  });

  it('renders the title, date, topic chips, body and the related block', async () => {
    renderWithProviders(await ArticlePage(props('reading-the-broadband-facts-label')));
    expect(screen.getByRole('heading', { level: 1, name: 'How to read the Broadband Facts label' })).toBeInTheDocument();
    expect(screen.getByText('Published September 16, 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Related articles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cable or home wireless: which internet fits you?' })).toBeInTheDocument();
  });

  it('Article without tags: the related block and its heading are omitted', async () => {
    overrides.getArticle = (found) => {
      const result = found as { kind: 'article'; article: { tags: string[] } };
      return { ...result, article: { ...result.article, tags: [] } };
    };
    renderWithProviders(await ArticlePage(props('reading-the-broadband-facts-label')));
    expect(screen.queryByRole('heading', { name: 'Related articles' })).not.toBeInTheDocument();
    expect(screen.queryByText('Related articles')).not.toBeInTheDocument();
  });

  it('Article withdrawn: notice with link to the topic, noindex, no article text', async () => {
    overrides.getArticle = () => ({ kind: 'withdrawn', slug: 'what-intro-pricing-means', topic: 'pricing' });
    const { container } = renderWithProviders(await ArticlePage(props('what-intro-pricing-means')));
    expect(screen.getByRole('heading', { level: 1, name: 'This article is no longer available' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See Pricing articles' })).toHaveAttribute('href', '/en-US/blog?tag=pricing');
    expect(container.textContent).not.toContain('introductory period starts');
    expect((await generateMetadata(props('what-intro-pricing-means'))).robots).toEqual({ index: false, follow: true });
  });

  it('a German request for an article without German text is flagged, noindex and canonical to English', async () => {
    overrides.getArticle = (found) => {
      const result = found as { kind: 'article'; article: object };
      return { ...result, article: { ...result.article, fallback: true, servedLocale: 'en-US' } };
    };
    const metadata = await generateMetadata(props('cable-or-home-wireless', 'de-DE'));
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toMatch(/\/en-US\/blog\/cable-or-home-wireless$/);
    renderWithProviders(await ArticlePage(props('cable-or-home-wireless', 'de-DE')), { locale: 'de-DE' });
    expect(screen.getByRole('note')).toHaveTextContent('Diese Seite ist in dieser Sprache noch nicht verfügbar');
  });

  it('serves German text for de-DE and an unknown slug is not found', async () => {
    renderWithProviders(await ArticlePage(props('cable-or-home-wireless', 'de-DE')), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Kabel oder Heim-Funk: Welches Internet passt zu Ihnen?' })).toBeInTheDocument();
    await expect(ArticlePage(props('nope'))).rejects.toThrow('NOT_FOUND');
    expect(await generateMetadata(props('nope'))).toEqual({});
  });

  it('generates a static param for every published article of every locale', () => {
    expect(generateStaticParams()).toHaveLength(6);
  });
});

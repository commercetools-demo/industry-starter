import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ARTICLES } from '@/content/journal';
import { renderWithIntl } from '@/test/render';
import ArticleView from './ArticleView';

const nav = vi.hoisted(() => ({ redirect: vi.fn((arg: { href: string; locale: string }) => {
  throw new Error(`REDIRECT ${arg.locale} ${arg.href}`);
}) }));
vi.mock('@/i18n/routing', async () => ({ ...(await (await import('@/test/shell')).routingMock()), redirect: nav.redirect }));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn(), getTranslations: vi.fn() }));

const bySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug)!;

async function loadPage() {
  return import('@/app/[locale]/journal/[slug]/page');
}

describe('Journal article', () => {
  it('Article withdrawn: redirects to its topic and serves no text', async () => {
    const { default: Page } = await loadPage();
    await expect(Page({ params: Promise.resolve({ locale: 'en-US', slug: 'capsule-take-back-plan' }) })).rejects.toThrow(
      'REDIRECT en-US /journal?tag=capsules',
    );
    expect(bySlug('capsule-take-back-plan').body['en-US']).toEqual([]);
  });

  it('unknown slug is not found', async () => {
    const { default: Page } = await loadPage();
    await expect(Page({ params: Promise.resolve({ locale: 'en-US', slug: 'does-not-exist' }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it('a published article renders', async () => {
    const { default: Page } = await loadPage();
    const element = await Page({ params: Promise.resolve({ locale: 'en-US', slug: 'brew-a-better-cup' }) });
    expect(element).toBeTruthy();
  });

  it('Article without tags: related block is omitted', () => {
    renderWithIntl(<ArticleView article={bySlug('from-the-roastery')} locale="en-US" />);
    expect(screen.queryByText('Keep reading')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A note from the roastery');
  });

  it('a tagged article shows related articles that share a tag, never itself or withdrawn ones', () => {
    renderWithIntl(<ArticleView article={bySlug('brew-a-better-cup')} locale="en-US" />);
    const related = screen.getByRole('region', { name: 'Keep reading' });
    expect(within(related).getByText('How to descale your capsule machine')).toBeInTheDocument();
    expect(within(related).queryByText('Five small habits for a better cup at home')).toBeNull();
    expect(within(related).queryByText('Our capsule take-back plan')).toBeNull();
  });

  it('shows the date, one h1, headings from the body and Article JSON-LD', () => {
    const { container } = renderWithIntl(<ArticleView article={bySlug('descale-your-machine')} locale="en-US" />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Published September 12, 2026')).toBeInTheDocument();
    expect(container.querySelector('#when')).not.toBeNull();
    const ld = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent ?? '{}') as Record<string, string>;
    expect(ld['@type']).toBe('Article');
    expect(ld.datePublished).toBe('2026-09-12');
  });

  it('fallback article shows the notice and marks the text lang en', () => {
    const { container } = renderWithIntl(<ArticleView article={bySlug('descale-your-machine')} locale="en-CA" />, { locale: 'en-CA' });
    expect(screen.getByRole('note')).toHaveTextContent('This page is shown in English');
    expect(container.querySelector('[lang="en"]')).not.toBeNull();
  });

  it('metadata has title description canonical and article time', async () => {
    const { generateMetadata } = await loadPage();
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en-US', slug: 'descale-your-machine' }) });
    expect(meta.title).toBe('How to descale your capsule machine');
    expect(String(meta.description).length).toBeGreaterThan(100);
    expect(meta.alternates?.canonical).toBe('/en-US/journal/descale-your-machine');
    expect(meta.openGraph).toMatchObject({ type: 'article', publishedTime: '2026-09-12' });
  });

  it('alternates list only locales with their own text', async () => {
    const { generateMetadata } = await loadPage();
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en-CA', slug: 'descale-your-machine' }) });
    expect(Object.keys(meta.alternates?.languages ?? {})).toEqual(['en-US']);
    expect(meta.alternates?.canonical).toBe('/en-CA/journal/descale-your-machine');
  });

  it('static params list published articles for both locales and no withdrawn ones', async () => {
    const { generateStaticParams } = await loadPage();
    const params = generateStaticParams();
    expect(params).toHaveLength(6);
    expect(params.some((p) => p.slug === 'capsule-take-back-plan')).toBe(false);
  });
});

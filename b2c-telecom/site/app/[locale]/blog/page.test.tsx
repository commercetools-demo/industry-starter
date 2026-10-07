import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: 'en-US' | 'de-DE'; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : enMessages, namespace: namespace as 'content.blog' }),
}));

import BlogPage, { generateMetadata } from './page';

function props(locale = 'en-US', tag?: string | string[]) {
  return { params: Promise.resolve({ locale }), searchParams: Promise.resolve(tag === undefined ? {} : { tag }) };
}

describe('blog listing', () => {
  it('lists the three seed articles newest first with dates and topic chips', async () => {
    renderWithProviders(await BlogPage(props()));
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['What an introductory price means', 'How to read the Broadband Facts label', 'Cable or home wireless: which internet fits you?']);
    expect(screen.getByText('Published September 30, 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'What an introductory price means' })).toHaveAttribute('href', '/en-US/blog/what-intro-pricing-means');
  });

  it('one tag narrows the list', async () => {
    renderWithProviders(await BlogPage(props('en-US', 'pricing')));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.queryByText('No articles match these filters.')).not.toBeInTheDocument();
  });

  it('Filter matches nothing: states it, keeps applied filters as chips and each chip link drops only its own tag', async () => {
    renderWithProviders(await BlogPage(props('en-US', ['phone', 'labels'])));
    expect(screen.getByText('No articles match these filters.')).toHaveAttribute('role', 'status');
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    const nav = screen.getByRole('navigation', { name: 'Filter by topic' });
    expect(within(nav).getByRole('link', { name: 'Remove filter: Phone' })).toHaveAttribute('href', '/en-US/blog?tag=labels');
    expect(within(nav).getByRole('link', { name: 'Remove filter: Labels' })).toHaveAttribute('href', '/en-US/blog?tag=phone');
    expect(within(nav).getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/en-US/blog');
  });

  it('ignores invalid tag values and keeps at most three', async () => {
    renderWithProviders(await BlogPage(props('en-US', ['internet', '../x', 'a', 'b', 'c'])));
    const nav = screen.getByRole('navigation', { name: 'Filter by topic' });
    expect(within(nav).queryByRole('link', { name: /\.\./ })).not.toBeInTheDocument();
    expect(within(nav).getAllByRole('link', { name: /^Remove filter/ })).toHaveLength(3);
  });

  it('serves German with a German title and canonical to the plain listing', async () => {
    renderWithProviders(await BlogPage(props('de-DE')), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Blog' })).toBeInTheDocument();
    expect(screen.getByText('Veröffentlicht am 30. September 2026')).toBeInTheDocument();
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'de-DE' }) });
    expect(metadata.alternates?.canonical).toMatch(/\/de-DE\/blog$/);
    expect(metadata.description).toBe('Ratgeber zu Internet, Mobilfunktarifen und Preisen.');
  });
});

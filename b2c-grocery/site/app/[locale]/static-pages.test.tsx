import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import AboutPage, { generateMetadata as aboutMeta } from './about/page';
import FaqPage from './faq/page';
import JournalPage from './journal/page';
import PolicyPage, { generateMetadata as policyMeta, generateStaticParams } from './policies/[slug]/page';

vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

const params = (locale: string) => ({ params: Promise.resolve({ locale }) });
const policy = (locale: string, slug: string) => ({ params: Promise.resolve({ locale, slug }) });

describe('static pages', () => {
  it('German About page: German title and content', async () => {
    expect(await aboutMeta(params('de-DE'))).toMatchObject({ title: 'Über uns' });
    renderWithProviders(await AboutPage(params('de-DE')), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Über uns' })).toBeInTheDocument();
    expect(screen.getByText(/kleiner Lebensmittelhändler/)).toBeInTheDocument();
  });

  it('English About page: title and description from front matter', async () => {
    const meta = await aboutMeta(params('en-US'));
    expect(meta.title).toBe('About us');
    expect(meta.description).toBeTruthy();
    renderWithProviders(await AboutPage(params('en-US')));
    expect(screen.getByRole('heading', { level: 1, name: 'About us' })).toBeInTheDocument();
  });

  it('policy page renders its content and metadata per slug', async () => {
    expect(await policyMeta(policy('en-US', 'returns'))).toMatchObject({ title: 'Returns and refunds' });
    renderWithProviders(await PolicyPage(policy('de-DE', 'privacy')), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeInTheDocument();
  });

  it('unknown policy slug: notFound', async () => {
    await expect(PolicyPage(policy('en-US', 'nope'))).rejects.toThrow('NOT_FOUND');
    await expect(PolicyPage(policy('en-US', '../about'))).rejects.toThrow('NOT_FOUND');
  });

  it('generateStaticParams lists the four policies', () => {
    expect(generateStaticParams().map((p) => p.slug)).toEqual(['delivery', 'returns', 'privacy', 'terms']);
  });

  it('FAQ and Journal render a heading in both locales', async () => {
    renderWithProviders(await FaqPage(params('en-US')));
    expect(screen.getByRole('heading', { level: 1, name: 'Frequently asked questions' })).toBeInTheDocument();
    renderWithProviders(await JournalPage(params('de-DE')), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Der stille Tisch' })).toBeInTheDocument();
  });
});

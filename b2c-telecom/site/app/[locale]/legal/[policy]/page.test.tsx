import { readFileSync } from 'node:fs';
import path from 'node:path';
import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import enMessages from '@/messages/en-US.json';
import deMessages from '@/messages/de-DE.json';
import { renderWithProviders } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: 'en-US' | 'de-DE'; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : enMessages, namespace: namespace as 'content' }),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

const credits = vi.hoisted(() => ({ list: [] as { photographer: string; url: string }[] }));
vi.mock('@/lib/content/credits', () => ({ getImageCredits: () => credits.list }));

import LegalPage, { generateMetadata } from './page';

function props(policy: string, locale = 'en-US', asOf?: string) {
  return { params: Promise.resolve({ locale, policy }), searchParams: Promise.resolve(asOf === undefined ? {} : { asOf }) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  credits.list = [];
});

describe('legal page', () => {
  it('shows the effective date under the title and lists earlier versions', async () => {
    renderWithProviders(await LegalPage(props('shipping-returns')));
    expect(screen.getByRole('heading', { level: 1, name: 'Shipping and returns' })).toBeInTheDocument();
    expect(screen.getByText('In effect since January 1, 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Earlier versions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'June 1, 2025' })).toHaveAttribute('href', '/en-US/legal/shipping-returns?asOf=2025-06-01');
    expect(screen.queryByText(/superseded version/)).not.toBeInTheDocument();
  });

  it('Version superseded: asOf shows the old version with the superseded banner and a link to the current one', async () => {
    renderWithProviders(await LegalPage(props('shipping-returns', 'en-US', '2025-06-01')));
    expect(screen.getByText('In effect since June 1, 2025')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('This is a superseded version. It was in effect until December 31, 2025.');
    expect(screen.getByRole('link', { name: 'View the current version' })).toHaveAttribute('href', '/en-US/legal/shipping-returns');
    const metadata = await generateMetadata(props('shipping-returns', 'en-US', '2025-06-01'));
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it('an asOf before the first version is not found and an invalid asOf shows the current version', async () => {
    await expect(LegalPage(props('shipping-returns', 'en-US', '2020-01-01'))).rejects.toThrow('NOT_FOUND');
    renderWithProviders(await LegalPage(props('shipping-returns', 'en-US', 'banana')));
    expect(screen.getByText('In effect since January 1, 2026')).toBeInTheDocument();
  });

  it('an unknown policy is not found', async () => {
    await expect(LegalPage(props('nope'))).rejects.toThrow('NOT_FOUND');
  });

  it('terms and privacy render in German with a German date', async () => {
    renderWithProviders(await LegalPage(props('terms', 'de-DE')), { locale: 'de-DE' });
    expect(screen.getByText('Gültig seit 1. Januar 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Allgemeine Geschäftsbedingungen' })).toBeInTheDocument();
  });

  it('image-credits page links to https://www.pexels.com with rel noopener and lists photographers', async () => {
    credits.list = [
      { photographer: 'Ada Ng', url: 'https://www.pexels.com/photo/2' },
      { photographer: 'Zoe Lee', url: 'https://www.pexels.com/photo/1' },
    ];
    renderWithProviders(await LegalPage(props('image-credits')));
    const pexels = screen.getByRole('link', { name: 'Pexels' });
    expect(pexels).toHaveAttribute('href', 'https://www.pexels.com');
    expect(pexels).toHaveAttribute('target', '_blank');
    expect(pexels.getAttribute('rel')).toContain('noopener');
    expect(screen.getAllByRole('link', { name: /^Photo by / }).map((l) => l.textContent)).toEqual(['Photo by Ada Ng on Pexels', 'Photo by Zoe Lee on Pexels']);
  });

  it('Opened from checkout: the policy page imports no cart or session module', () => {
    const source = readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');
    expect(source).not.toMatch(/@\/lib\/ct|@\/lib\/session|useCart|@\/hooks\/|@\/context\//);
  });
});

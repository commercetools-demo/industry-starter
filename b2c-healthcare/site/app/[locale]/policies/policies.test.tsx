import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (namespace: string) => createTranslator({ locale: 'en-US', messages, namespace: namespace as 'content' }),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import { PolicyLink } from '@/components/content/PolicyLink';
import PolicyPage, { generateMetadata, generateStaticParams } from './[slug]/page';

const render = async (slug: string, version?: string, locale = 'en-US') =>
  renderWithProviders(await PolicyPage({ params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve({ version }) }));

describe('policy-pages › Policy pages stating the effective date of the text shown', () => {
  it('serves the three policies at stable addresses', () => {
    expect(generateStaticParams().map((p) => p.slug)).toEqual(['shipping-and-returns', 'terms', 'privacy']);
  });

  it('Version superseded: the current text is served with its own effective date', async () => {
    const { container } = await render('terms');
    expect(screen.getByRole('heading', { level: 1, name: 'Terms and conditions' })).toBeInTheDocument();
    expect(container.querySelector('time')).toHaveAttribute('datetime', '2026-03-01');
    expect(screen.getByText('Effective March 1, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
    // The superseded version is kept and reachable by its date.
    expect(screen.getByRole('link', { name: 'Version effective June 1, 2025' })).toHaveAttribute(
      'href',
      '/en-US/policies/terms?version=2025-06-01',
    );
  });

  it('Version superseded: ?version= shows the earlier text with its own date and a link to the current one', async () => {
    const { container } = await render('terms', '2025-06-01');
    expect(container.querySelector('time')).toHaveAttribute('datetime', '2025-06-01');
    expect(screen.getByRole('note')).toHaveTextContent('earlier version');
    expect(screen.getByRole('link', { name: 'View the current version' })).toHaveAttribute('href', '/en-US/policies/terms');
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US', slug: 'terms' }), searchParams: Promise.resolve({ version: '2025-06-01' }) })).toMatchObject({
      robots: { index: false },
    });
  });

  it('every policy states an effective date; privacy describes the 90-day guest retention', async () => {
    for (const slug of ['shipping-and-returns', 'terms', 'privacy']) {
      const { container, unmount } = await render(slug);
      expect(container.querySelector('time')?.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      unmount();
    }
    await render('privacy');
    expect(screen.getByText(/90 days/)).toBeInTheDocument();
  });

  it('Policy not translated: the English text is served and identified as such', async () => {
    await render('privacy', undefined, 'fr-FR');
    expect(screen.getByText(messages.content.fallbackNotice)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument();
  });

  it('unknown policy or version is a not-found', async () => {
    await expect(render('nope')).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(render('terms', '1999-01-01')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('Opened from checkout: the consent link opens a new tab so the checkout page and cart stay as they were', () => {
    renderWithProviders(<PolicyLink slug="terms">Terms</PolicyLink>);
    const link = screen.getByRole('link', { name: 'Terms' });
    expect(link).toHaveAttribute('href', '/en-US/policies/terms');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('the policy page reads no session and no cart (nothing in it can disturb a checkout)', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(`${import.meta.dirname}/[slug]/page.tsx`, 'utf8');
    expect(source).not.toMatch(/lib\/(ct|session)|cart/i);
  });
});

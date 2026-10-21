import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { POLICIES } from '@/content/policies';
import { TOKEN_NAMES, tokensIn, blockTexts, type ContentFigures } from '@/lib/content/blocks';
import { POLICY_SLUGS } from '@/lib/routes';
import { renderWithIntl } from '@/test/render';
import PolicyView from './PolicyView';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('@/lib/content/figures', () => ({ getPageFigures: async () => ({}) }));

const FIGURES: ContentFigures = {
  freeShipping: '$40.00',
  collectMinutes: '30 minutes',
  returnDays: '30 days',
  supportEmail: 'care@malva-coffee.example',
  supportPhone: '+1 212 555 0100',
};

describe('Policy pages', () => {
  it('every policy has an iso effective date no later than today in every locale', () => {
    for (const slug of POLICY_SLUGS) {
      for (const text of Object.values(POLICIES[slug])) {
        expect(text.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(`${text.effectiveDate}T00:00:00Z`).getTime()).toBeLessThanOrEqual(Date.now());
      }
    }
  });

  it('Version superseded: the date comes from the same object as the text', () => {
    const policies = {
      ...POLICIES,
      terms: { 'en-US': { ...POLICIES.terms['en-US'], effectiveDate: '2027-01-15', title: 'Terms v2' } },
    };
    renderWithIntl(<PolicyView slug="terms" locale="en-US" figures={FIGURES} policies={policies} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terms v2');
    expect(screen.getByText('Effective from January 15, 2027')).toBeInTheDocument();
  });

  it('Policy not translated: fallback text and its own date are shown', () => {
    const { container } = renderWithIntl(<PolicyView slug="privacy" locale="en-CA" figures={FIGURES} />, { locale: 'en-CA' });
    expect(screen.getAllByRole('note')[0]).toHaveTextContent('This page is shown in English');
    expect(screen.getByText(/Effective from October 1, 2026/)).toBeInTheDocument();
    expect(container.querySelector('[lang="en"]')).not.toBeNull();
  });

  it('draft banner shows while the text is a draft and goes when it is final', () => {
    const final = { ...POLICIES, terms: { 'en-US': { ...POLICIES.terms['en-US'], isDraft: false } } };
    const { unmount } = renderWithIntl(<PolicyView slug="terms" locale="en-US" figures={FIGURES} />);
    expect(screen.getByText('This text is a draft and not final legal text.')).toBeInTheDocument();
    unmount();
    renderWithIntl(<PolicyView slug="terms" locale="en-US" figures={FIGURES} policies={final} />);
    expect(screen.queryByText('This text is a draft and not final legal text.')).toBeNull();
  });

  it('tokens are replaced and the table of contents links to headings', () => {
    const { container } = renderWithIntl(<PolicyView slug="shipping-returns" locale="en-US" figures={FIGURES} />);
    expect(container.textContent).toContain('Delivery is free on orders over $40.00');
    expect(container.textContent).not.toContain('{{');
    const toc = screen.getByRole('navigation', { name: 'On this page' });
    expect(toc.querySelectorAll('a[href^="#"]').length).toBeGreaterThan(3);
    expect(container.querySelector('#delivery')).not.toBeNull();
  });

  it('policy slugs are stable', () => {
    expect([...POLICY_SLUGS]).toEqual(['shipping-returns', 'terms', 'privacy', 'accessibility']);
  });

  it('every token used in a policy is a known token', () => {
    for (const slug of POLICY_SLUGS) {
      for (const text of Object.values(POLICIES[slug])) {
        for (const t of blockTexts(text.body).flatMap(tokensIn)) expect(TOKEN_NAMES as readonly string[]).toContain(t);
      }
    }
  });

  it('Opened from checkout: policy page needs no session and sets no redirect', () => {
    const view = readFileSync(join(process.cwd(), 'components/content/PolicyView.tsx'), 'utf8');
    const page = readFileSync(join(process.cwd(), 'app/[locale]/policies/[slug]/page.tsx'), 'utf8');
    for (const src of [view, page]) {
      expect(src).not.toMatch(/lib\/session|cookies\(|redirect\(/);
    }
  });

  it('policy page has no commerce import beyond tokens', () => {
    const page = readFileSync(join(process.cwd(), 'app/[locale]/policies/[slug]/page.tsx'), 'utf8');
    expect(page).not.toContain('@/lib/ct/');
  });

  it('unknown policy slug is not found', async () => {
    const mod = await import('@/app/[locale]/policies/[slug]/page');
    await expect(mod.default({ params: Promise.resolve({ locale: 'en-US', slug: 'nope' }) })).rejects.toThrow();
  });
});

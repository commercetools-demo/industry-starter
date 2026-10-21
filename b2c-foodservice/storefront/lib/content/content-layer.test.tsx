import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Blocks from '@/components/content/Blocks';
import { renderWithIntl } from '@/test/render';
import { renderTokens, type Block } from './blocks';
import { getContentFigures, FIGURES_TIMEOUT_MS } from './figures';
import { resolveLocalized } from './localized';
import { aboutHref, articleHref, contactHref, faqHref, journalHref, policyHref } from '@/lib/routes';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

const promise = vi.hoisted(() => ({ getPromiseFigures: vi.fn() }));
vi.mock('@/lib/ct/promise', () => promise);

const FALLBACKS = { freeShipping: 'our free-shipping threshold', collectMinutes: 'a short time', returnDays: 'the return period' };

afterEach(() => {
  vi.useRealTimers();
  promise.getPromiseFigures.mockReset();
});

describe('Locale without translation', () => {
  it('Locale without translation: fallback language is served and identified', () => {
    const content = { 'en-US': 'Hello' };
    expect(resolveLocalized(content, 'en-CA')).toEqual({ value: 'Hello', usedLocale: 'en-US', isFallback: true });
  });
  it('own locale text is used and is not a fallback', () => {
    const content = { 'en-US': 'Colour', 'en-CA': 'Colour (CA)' };
    expect(resolveLocalized(content, 'en-CA')).toEqual({ value: 'Colour (CA)', usedLocale: 'en-CA', isFallback: false });
  });
  it('fallback chain ends at en-US', () => {
    const r = resolveLocalized({ 'en-US': 'x' }, 'xx-XX');
    expect(r.usedLocale).toBe('en-US');
    expect(r.value).toBe('x');
  });
});

describe('Blocks', () => {
  const blocks: Block[] = [
    { type: 'h2', id: 'one', text: 'First' },
    { type: 'p', text: 'Plain <b>text</b> with {{returnDays}} days' },
    { type: 'ul', items: ['a', 'b'] },
    { type: 'ol', items: ['c'] },
    { type: 'h3', text: 'Sub' },
    { type: 'note', text: 'Note' },
    { type: 'cta', text: 'Go', href: '/contact' },
  ];
  it('blocks render semantic elements and no raw html', () => {
    const { container } = renderWithIntl(<Blocks blocks={blocks} figures={{ returnDays: '30' }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'First' })).toHaveAttribute('id', 'one');
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelectorAll('ol li')).toHaveLength(1);
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('Plain <b>text</b> with 30 days');
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/contact');
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' || name === '.next' ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

describe('no raw html', () => {
  it('no dangerouslySetInnerHTML in content components, pages or content modules', () => {
    const root = process.cwd();
    const dirs = ['components/content', 'components/contact', 'components/faq', 'components/journal', 'components/error', 'content', 'lib/content', 'app/[locale]'];
    const hits = dirs.flatMap((d) => {
      try {
        return sourceFiles(join(root, d)).filter((f) => readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML'));
      } catch {
        return [];
      }
    });
    // JSON-LD script tags are the one place structured data is injected, through a helper that escapes `<`.
    expect(hits.filter((f) => !f.endsWith('JsonLd.tsx'))).toEqual([]);
  });
});

describe('tokens', () => {
  it('tokens are replaced from figures', () => {
    expect(renderTokens('Free over {{freeShipping}} and back in {{returnDays}} days', { freeShipping: '$40.00', returnDays: '30' })).toBe(
      'Free over $40.00 and back in 30 days',
    );
  });
  it('tokens fall back when figures fail or time out', async () => {
    promise.getPromiseFigures.mockRejectedValue(new Error('boom'));
    const failed = await getContentFigures('en-US', FALLBACKS);
    expect(failed.freeShipping).toBe('our free-shipping threshold');
    expect(failed.returnDays).toBe('the return period');
    expect(failed.supportEmail).toContain('@');

    vi.useFakeTimers();
    promise.getPromiseFigures.mockReturnValue(new Promise(() => {}));
    const pending = getContentFigures('en-US', FALLBACKS);
    await vi.advanceTimersByTimeAsync(FIGURES_TIMEOUT_MS + 1);
    expect((await pending).collectMinutes).toBe('a short time');
  });
  it('figures from the promise source are formatted', async () => {
    promise.getPromiseFigures.mockResolvedValue({
      freeShippingThreshold: { centAmount: 4000, currencyCode: 'USD' },
      collectionMinutes: 30,
      returnDays: 30,
    });
    const f = await getContentFigures('en-US', FALLBACKS);
    expect(f).toMatchObject({ freeShipping: '$40.00', collectMinutes: '30', returnDays: '30' });
  });
  it('a missing part keeps only that fallback', async () => {
    promise.getPromiseFigures.mockResolvedValue({ freeShippingThreshold: null, collectionMinutes: null, returnDays: 30 });
    const f = await getContentFigures('en-CA', FALLBACKS);
    expect(f.freeShipping).toBe('our free-shipping threshold');
    expect(f.returnDays).toBe('30');
  });
});

describe('route helpers', () => {
  it('route helpers return stable paths', () => {
    expect(aboutHref()).toBe('/about');
    expect(contactHref()).toBe('/contact');
    expect(faqHref()).toBe('/faq');
    expect(faqHref('ordering-shipping-cost')).toBe('/faq?q=ordering-shipping-cost');
    expect(policyHref('terms')).toBe('/policies/terms');
    expect(journalHref()).toBe('/journal');
    expect(journalHref({ tags: ['brewing', 'capsules'], q: 'descale', page: 2 })).toBe('/journal?tag=brewing&tag=capsules&q=descale&page=2');
    expect(articleHref('how-to-descale')).toBe('/journal/how-to-descale');
  });
});

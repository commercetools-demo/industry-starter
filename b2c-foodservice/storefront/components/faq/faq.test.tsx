import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAQ_TOPICS, allFaqIds } from '@/content/faq';
import type { ContentFigures } from '@/lib/content/blocks';
import { renderWithIntl } from '@/test/render';
import FaqView from './FaqView';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

const FIGURES: ContentFigures = {
  freeShipping: '$40.00',
  collectMinutes: '30 minutes',
  returnDays: '30 days',
  supportEmail: 'care@malva-coffee.example',
  supportPhone: '+1 212 555 0100',
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.location.hash = '';
});

describe('FAQ page', () => {
  it('answers are present in the first response inside closed details', () => {
    const { container } = renderWithIntl(<FaqView locale="en-US" figures={FIGURES} />);
    const details = [...container.querySelectorAll('details')];
    expect(details).toHaveLength(allFaqIds().length);
    for (const d of details) {
      expect(d.open).toBe(false);
      expect(d.textContent?.length ?? 0).toBeGreaterThan(40);
    }
    expect(container.textContent).toContain('Delivery is free on orders over $40.00');
    expect(container.textContent).not.toContain('{{');
  });

  it('Deep link to one question: hash opens that answer', async () => {
    const { container } = renderWithIntl(<FaqView locale="en-US" figures={FIGURES} />);
    const target = container.querySelector<HTMLDetailsElement>('#question-ordering-shipping-cost')!;
    expect(target.open).toBe(false);
    await act(async () => {
      window.location.hash = '#question-ordering-shipping-cost';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(target.open).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(target.querySelector('summary'));
  });

  it('Deep link: q parameter renders that answer open on the server', () => {
    const { container } = renderWithIntl(<FaqView locale="en-US" figures={FIGURES} openId="capsules-descale" />);
    const open = [...container.querySelectorAll('details[open]')];
    expect(open.map((d) => d.id)).toEqual(['question-capsules-descale']);
  });

  it('other topics remain reachable', () => {
    renderWithIntl(<FaqView locale="en-US" figures={FIGURES} openId="capsules-descale" />);
    for (const topic of FAQ_TOPICS) {
      expect(screen.getByRole('heading', { level: 2, name: topic.title['en-US'] })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: topic.title['en-US'] })[0]).toHaveAttribute('href', `#topic-${topic.id}`);
    }
  });

  it('unknown question id is ignored', () => {
    const { container } = renderWithIntl(<FaqView locale="en-US" figures={FIGURES} openId="does-not-exist" />);
    expect(container.querySelectorAll('details[open]')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('Answer not translated: fallback is served with a notice', () => {
    const { container } = renderWithIntl(<FaqView locale="en-CA" figures={FIGURES} />, { locale: 'en-CA' });
    expect(screen.getByRole('note')).toHaveTextContent('This page is shown in English');
    expect(container.querySelector('details [lang="en"]')).not.toBeNull();
  });

  it('json-ld lists every question', () => {
    const { container } = renderWithIntl(<FaqView locale="en-US" figures={FIGURES} />);
    const script = container.querySelector('script[type="application/ld+json"]')!;
    const data = JSON.parse(script.textContent ?? '{}') as { '@type': string; mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(allFaqIds().length);
    expect(data.mainEntity.every((e) => e.acceptedAnswer.text.length > 0 && !e.acceptedAnswer.text.includes('{{'))).toBe(true);
  });

  it('question ids are unique and each topic has questions', () => {
    const ids = allFaqIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(FAQ_TOPICS).toHaveLength(6);
  });
});

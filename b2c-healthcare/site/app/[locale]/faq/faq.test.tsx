import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { getFaqGroups } from '@/lib/content';
import { renderWithProviders, screen, within } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (namespace: string) => createTranslator({ locale: 'en-US', messages, namespace: namespace as 'static.faq' }),
}));

import FaqPage from './page';

const render = async (locale = 'en-US') => renderWithProviders(await FaqPage({ params: Promise.resolve({ locale }) }));

describe('faq › FAQ answers readable and indexable without being expanded', () => {
  it('groups questions under topic headings and keeps the other topics reachable on the same page', async () => {
    await render();
    for (const name of ['Booking', 'Prescriptions and delivery', 'Lab results', 'Account and privacy']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', expect.stringMatching(/^#topic-/));
    }
  });

  it('answer text is in the server-rendered HTML with no script, no collapsed element and no fetch', async () => {
    const page = await FaqPage({ params: Promise.resolve({ locale: 'en-US' }) });
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en-US" messages={messages}>
        {page}
      </NextIntlClientProvider>,
    );
    for (const group of getFaqGroups('en-US')) {
      for (const item of group.items) {
        expect(html).toContain(item.question);
        const first = item.body.split('\n')[0]?.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '') ?? '';
        expect(html, item.id).toContain(first.split(' ').slice(0, 6).join(' '));
      }
    }
    expect(html).not.toMatch(/<script|<details|hidden|aria-expanded|display:\s*none/);
  });

  it('Deep link to one question: each question has an id that /faq#<id> addresses, its answer is open in the DOM', async () => {
    const { container } = await render();
    const id = 'delivery-times';
    const card = container.querySelector(`#${id}`);
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByRole('heading', { level: 3, name: 'How long does delivery take?' })).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText(/Standard delivery takes 1-2 business days/)).toBeVisible();
    // :target styling marks the addressed question.
    expect(card?.className).toContain('target:border-brand-300');
    expect(within(card as HTMLElement).getByRole('link', { name: 'How long does delivery take?' })).toHaveAttribute('href', `#${id}`);
  });

  it('Feedback collector unreachable: v1 has no collector, so there is no vote control and no fetch to fail', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { container } = await render();
    expect(screen.queryByText(/helpful/i)).toBeNull();
    expect(container.querySelector('button, form')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('Answer not translated: the English answer is shown and identified as such (never an empty body)', async () => {
    await render('fr-FR');
    expect(screen.getByText(messages.content.fallbackNotice)).toBeInTheDocument();
    expect(screen.getByText(/Choose a doctor, pick a day/)).toBeInTheDocument();
  });
});

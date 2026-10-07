import { readFileSync } from 'node:fs';
import path from 'node:path';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';

vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));

import FaqPage, { generateMetadata } from './page';

function params(locale: string) {
  return { params: Promise.resolve({ locale }) };
}

describe('faq page', () => {
  it('FAQPage JSON-LD lists every question with its plain-text answer', async () => {
    const { container } = renderWithProviders(await FaqPage(params('en-US')));
    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!) as { '@type': string; mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(9);
    expect(data.mainEntity[0].name).toBe('When am I charged?');
    expect(data.mainEntity[0].acceptedAnswer.text).toMatch(/^Monthly service lines are billed every month/);
    expect(data.mainEntity[0].acceptedAnswer.text).not.toContain('<');
  });

  it('shows the title, the topic navigation and nine open answers in English', async () => {
    const { container } = renderWithProviders(await FaqPage(params('en-US')));
    expect(screen.getByRole('heading', { level: 1, name: 'Frequently asked questions' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Topics' })).toBeInTheDocument();
    expect(container.querySelectorAll('details')).toHaveLength(9);
  });

  it('serves German for de-DE with German metadata', async () => {
    renderWithProviders(await FaqPage(params('de-DE')), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Häufige Fragen' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Themen' })).toBeInTheDocument();
    const metadata = await generateMetadata(params('de-DE'));
    expect(metadata.title).toBe('Häufige Fragen');
    expect(metadata.robots).toBeUndefined();
  });

  it('imports no commerce module and carries no vote control', async () => {
    expect(readFileSync(path.join(__dirname, 'page.tsx'), 'utf8')).not.toMatch(/@\/lib\/ct/);
    renderWithProviders(await FaqPage(params('en-US')));
    expect(screen.queryByText(/helpful/i)).not.toBeInTheDocument();
  });
});

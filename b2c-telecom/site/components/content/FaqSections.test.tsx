import { screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { getFaq } from '@/lib/content/faq';
import enMessages from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/utils';
import { FaqSections } from './FaqSections';

const faq = getFaq('en-US')!;

describe('FaqSections', () => {
  it('Deep link to one question: every details element is open in the server HTML', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en-US" messages={enMessages}>
        <FaqSections topics={faq.topics} />
      </NextIntlClientProvider>,
    );
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(9);
    for (const tag of details) expect(tag).toMatch(/ open(=|\s|>)/);
    expect(html).toContain('Monthly service lines are billed every month');
    expect(html).not.toMatch(/<details[^>]* hidden/);
    expect(html).toContain('id="cancel-order"');
  });

  it('renders a topics navigation with a link to every topic and a section per topic', () => {
    renderWithProviders(<FaqSections topics={faq.topics} />);
    const nav = screen.getByRole('navigation', { name: 'Topics' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['#orders-billing', '#internet-service', '#phones-devices']);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Orders and billing', 'Internet service', 'Phones and devices']);
  });

  it('Replacement behaviour: no vote button and no fetch call from the FAQ', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderWithProviders(<FaqSections topics={faq.topics} />);
    expect(screen.queryByText(/helpful/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /helpful|yes|no|vote/i })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('hides the navigation when showNav is false (support page)', () => {
    renderWithProviders(<FaqSections topics={faq.topics.slice(0, 1)} showNav={false} collapsible={false} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

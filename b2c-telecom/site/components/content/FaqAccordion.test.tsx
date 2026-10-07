import { act, screen } from '@testing-library/react';
import { getFaq } from '@/lib/content/faq';
import { renderWithProviders } from '@/test/utils';
import { FaqSections } from './FaqSections';

const faq = getFaq('en-US')!;
const scrollIntoView = vi.fn();

function openIds(): string[] {
  return Array.from(document.querySelectorAll('details'))
    .filter((d) => d.open)
    .map((d) => d.id);
}

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(() => {
  window.location.hash = '';
});

describe('FaqAccordion', () => {
  it('Deep link to one question: only the hash target stays open and the other topics remain linked', () => {
    window.location.hash = '#cancel-order';
    renderWithProviders(<FaqSections topics={faq.topics} />);
    expect(openIds()).toEqual(['cancel-order']);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('#'))).toHaveLength(3);
  });

  it('without a hash every answer is collapsed after mount', () => {
    renderWithProviders(<FaqSections topics={faq.topics} />);
    expect(openIds()).toEqual([]);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('a hash that names a topic collapses all answers and scrolls to the topic', () => {
    window.location.hash = '#phones-devices';
    renderWithProviders(<FaqSections topics={faq.topics} />);
    expect(openIds()).toEqual([]);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('hashchange re-applies the rule', () => {
    renderWithProviders(<FaqSections topics={faq.topics} />);
    act(() => {
      window.location.hash = '#return-device';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(openIds()).toEqual(['return-device']);
  });

  it('an unknown hash collapses everything and does not throw', () => {
    window.location.hash = '#nope';
    renderWithProviders(<FaqSections topics={faq.topics} />);
    expect(openIds()).toEqual([]);
  });
});

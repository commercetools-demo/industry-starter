import { screen, within } from '@testing-library/react';
import { getPathname } from '@/i18n/routing';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/utils';
import { Footer } from './Footer';

describe('Footer', () => {
  it.each([
    ['en-US', en.footer],
    ['de-DE', de.footer],
  ] as const)('shows the blurb and the three columns in %s', (locale, messages) => {
    renderWithProviders(<Footer />, { locale });
    expect(screen.getByRole('contentinfo')).toHaveTextContent(messages.blurb);
    for (const title of [messages.shop.title, messages.house.title, messages.help.title]) {
      expect(screen.getByRole('navigation', { name: title })).toBeInTheDocument();
    }
  });

  it.each(['en-US', 'de-DE'] as const)('links are locale-aware (%s)', (locale) => {
    renderWithProviders(<Footer />, { locale });
    const messages = locale === 'en-US' ? en.footer : de.footer;
    const href = (path: string) => getPathname({ href: path, locale });
    expect(screen.getByRole('link', { name: messages.house.about })).toHaveAttribute('href', href('/about'));
    expect(screen.getByRole('link', { name: messages.house.journal })).toHaveAttribute('href', href('/journal'));
    expect(screen.getByRole('link', { name: messages.help.faq })).toHaveAttribute('href', href('/faq'));
    expect(screen.getByRole('link', { name: messages.help.delivery })).toHaveAttribute('href', href('/policies/delivery'));
    expect(screen.getByRole('link', { name: messages.help.contact })).toHaveAttribute('href', href('/contact'));
  });

  it('shop links filter the listing by the category slug of the locale', () => {
    renderWithProviders(<Footer />, { locale: 'de-DE' });
    const shop = screen.getByRole('navigation', { name: de.footer.shop.title });
    expect(within(shop).getByRole('link', { name: de.footer.shop.dairyEggs })).toHaveAttribute('href', '/de-DE/shop?category=milch-eier');
    expect(within(shop).getAllByRole('link')).toHaveLength(6);
  });

  it('has the surface background', () => {
    renderWithProviders(<Footer />);
    expect(screen.getByRole('contentinfo')).toHaveClass('bg-surface');
  });
});

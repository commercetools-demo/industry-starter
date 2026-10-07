import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ locale: 'en-US' }));
const loadNavItems = vi.fn();
vi.mock('next-intl/server', () => ({ getLocale: async () => state.locale }));
vi.mock('./_shell/loadNavItems', () => ({ loadNavItems: (locale: string) => loadNavItems(locale) }));

import LocaleNotFound from './not-found';

const ITEMS = [
  { key: 'a', label: 'Phone plans', path: '/shop/phone-plans', matchSlugs: [] },
  { key: 'b', label: 'Cable internet', path: '/shop/cable-internet', matchSlugs: [] },
];

beforeEach(() => {
  state.locale = 'en-US';
  loadNavItems.mockResolvedValue(ITEMS);
});

describe('[locale] not-found', () => {
  it('Address resolves to nothing: renders search form and category links inside the layout', async () => {
    renderWithProviders(await LocaleNotFound());
    expect(screen.getByRole('heading', { level: 1, name: "We couldn't find that page" })).toBeInTheDocument();
    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('action', '/en-US/search');
    expect(form).toHaveAttribute('method', 'get');
    const input = within(form).getByLabelText('Search Malva');
    expect(input).toHaveAttribute('name', 'q');
    expect(within(form).getByRole('button', { name: 'Search' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('link', { name: 'Phone plans' })).toHaveAttribute('href', '/en-US/shop/phone-plans');
    expect(screen.getByRole('link', { name: 'Cable internet' })).toHaveAttribute('href', '/en-US/shop/cable-internet');
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en-US');
  });

  it('de-DE copy and search action', async () => {
    state.locale = 'de-DE';
    renderWithProviders(await LocaleNotFound(), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Diese Seite haben wir nicht gefunden' })).toBeInTheDocument();
    expect(screen.getByRole('search')).toHaveAttribute('action', '/de-DE/search');
    expect(loadNavItems).toHaveBeenCalledWith('de-DE');
  });

  it('without categories (catalog unavailable) the links are omitted but the recovery stays', async () => {
    loadNavItems.mockResolvedValue([]);
    renderWithProviders(await LocaleNotFound());
    expect(screen.queryByRole('link', { name: 'Phone plans' })).not.toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeInTheDocument();
  });
});

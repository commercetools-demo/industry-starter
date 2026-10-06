import { screen } from '@testing-library/react';
import { cartLine } from '@/test/cart';
import { renderWithProviders } from '@/test/utils';
import { RecurrenceBadge } from './RecurrenceBadge';

const NOTICE = 'The price of each repeat order follows the current price and may change.';

describe('RecurrenceBadge', () => {
  it('Subscribe: the cart line shows "Repeats every 2 weeks" and the price notice', () => {
    renderWithProviders(<RecurrenceBadge line={cartLine({ recurrence: { policyKey: 'every-2-weeks', priceSelectionMode: 'Dynamic' } })} />);
    expect(screen.getByText('Repeats every 2 weeks')).toBeInTheDocument();
    expect(screen.getByText(NOTICE)).toBeVisible();
  });

  it.each([
    ['weekly', 'Repeats every week'],
    ['monthly', 'Repeats every month'],
    ['something-else', 'Repeats on a schedule'],
  ])('policy %s reads "%s"', (policyKey, text) => {
    renderWithProviders(<RecurrenceBadge line={cartLine({ recurrence: { policyKey, priceSelectionMode: 'Dynamic' } })} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('German', () => {
    renderWithProviders(<RecurrenceBadge line={cartLine({ recurrence: { policyKey: 'monthly', priceSelectionMode: 'Dynamic' } })} />, { locale: 'de-DE' });
    expect(screen.getByText('Wiederholt sich jeden Monat')).toBeInTheDocument();
  });

  it('a one-time line shows nothing', () => {
    renderWithProviders(<RecurrenceBadge line={cartLine()} />);
    expect(screen.queryByText(/Repeats/)).not.toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });
});

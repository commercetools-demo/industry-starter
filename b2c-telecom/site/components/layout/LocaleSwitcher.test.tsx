import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';

const switchMarket = vi.fn();
const hook = vi.hoisted(() => ({ pending: false }));
vi.mock('@/hooks/useSwitchMarket', () => ({ useSwitchMarket: () => ({ switchMarket, pending: hook.pending }) }));

import { LocaleSwitcher } from './LocaleSwitcher';

beforeEach(() => {
  vi.clearAllMocks();
  hook.pending = false;
});

const KEPT = { action: 'none', droppedLines: [] };

describe('LocaleSwitcher', () => {
  it('marks the current locale with aria-pressed and names both buttons in full', () => {
    renderWithProviders(<LocaleSwitcher current="en-US" />);
    expect(screen.getByRole('group', { name: 'Language and region' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English (US)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Deutsch (Deutschland)' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'English (US)' })).toHaveTextContent('EN');
  });

  it('click calls the hook with the other locale and confirms with a toast', async () => {
    switchMarket.mockResolvedValue({ locale: 'de-DE', currency: 'EUR', country: 'DE', cart: KEPT });
    renderWithProviders(<LocaleSwitcher current="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch (Deutschland)' }));
    expect(switchMarket).toHaveBeenCalledTimes(1);
    expect(switchMarket).toHaveBeenCalledWith('de-DE');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Region changed to Deutschland'));
  });

  it('a discarded cart names the removed lines in the toast', async () => {
    switchMarket.mockResolvedValue({
      locale: 'de-DE',
      currency: 'EUR',
      country: 'DE',
      cart: { action: 'discarded', droppedLines: [{ offerKey: 'a', name: 'Unlimited' }, { offerKey: 'b', name: 'Spotify' }] },
    });
    renderWithProviders(<LocaleSwitcher current="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch (Deutschland)' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Your bundle was emptied because prices differ in Deutschland. Removed: Unlimited, Spotify'),
    );
  });

  it('clicking the current locale does nothing', () => {
    renderWithProviders(<LocaleSwitcher current="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'English (US)' }));
    expect(switchMarket).not.toHaveBeenCalled();
  });

  it('a failed switch shows the error toast', async () => {
    switchMarket.mockRejectedValue(new Error('region.error'));
    renderWithProviders(<LocaleSwitcher current="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch (Deutschland)' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('We could not change the region. Please try again.'));
  });

  it('buttons are disabled while a switch is pending', () => {
    hook.pending = true;
    renderWithProviders(<LocaleSwitcher current="de-DE" />);
    expect(screen.getByRole('button', { name: 'English (US)' })).toBeDisabled();
  });

  it('de-DE labels', () => {
    renderWithProviders(<LocaleSwitcher current="de-DE" />, { locale: 'de-DE' });
    expect(screen.getByRole('group', { name: 'Sprache und Region' })).toBeInTheDocument();
  });
});

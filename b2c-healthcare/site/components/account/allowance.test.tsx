import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import type { AllowanceView } from '@/lib/funding/allowance-types';

vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));

import { AllowancePanel } from './AllowancePanel';

const view = (over: Partial<AllowanceView> = {}): AllowanceView => ({
  cycle: '2026-10', currency: 'USD', granted: 5000, consumed: 1200, balance: 3800, forfeitsOn: '2026-11-01', lapsing: 3800, lastLapsed: null, ...over,
});

describe('benefit-allowance-drawdown: /account/allowance (U-07)', () => {
  it('Forfeiture is announced: the amount that will lapse and the date it lapses are both stated', () => {
    renderWithProviders(<AllowancePanel view={view()} />);
    expect(screen.getByRole('heading', { name: 'Allowance' })).toBeInTheDocument();
    expect(document.querySelector('[data-allowance-balance]')).toHaveTextContent('$38.00');
    expect(document.querySelector('[data-allowance-forfeit]')).toHaveTextContent('$38.00 will be forfeited on November 1, 2026');
    expect(screen.getByText(/not carried over/)).toBeInTheDocument();
  });

  it('shows what was granted and used, and what the last cycle forfeited', () => {
    renderWithProviders(<AllowancePanel view={view({ lastLapsed: { cycle: '2026-09', amount: 2200 } })} />);
    expect(document.querySelector('[data-allowance-granted]')).toHaveTextContent('$50.00');
    expect(document.querySelector('[data-allowance-used]')).toHaveTextContent('$12.00');
    expect(document.querySelector('[data-allowance-last-lapsed]')).toHaveTextContent('$22.00 of your 2026-09 allowance was forfeited');
  });

  it('nothing left to lapse says so', () => {
    renderWithProviders(<AllowancePanel view={view({ balance: 0, lapsing: 0, consumed: 5000 })} />);
    expect(document.querySelector('[data-allowance-nothing-lapsing]')).toHaveTextContent('Nothing is left to lapse');
  });

  it('Allowance is not cash: the page offers no way to withdraw or transfer, and says why', () => {
    renderWithProviders(<AllowancePanel view={view()} />);
    expect(screen.getByText(/not cash\. It cannot be withdrawn or transferred/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('link', { name: /withdraw|transfer|cash out/i })).toBeNull();
  });

  it('a member without an allowance sees that, and a failed read is an error rather than a zero balance', () => {
    const { unmount } = renderWithProviders(<AllowancePanel view={null} />);
    expect(document.querySelector('[data-allowance-none]')).toHaveTextContent('You do not have a benefit allowance.');
    unmount();
    renderWithProviders(<AllowancePanel view={undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load your allowance');
    expect(document.querySelector('[data-allowance-balance]')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { RefillReason } from '@/lib/refill-types';
import { renderWithProviders, screen } from '@/test/utils';
import { RefillLastRun } from './RefillLastRun';

describe('subscriptions-and-recurring-orders: last run on the auto-refill page', () => {
  it('shows "Last run: skipped (date), your prescription has expired."', () => {
    renderWithProviders(<RefillLastRun run={{ runAt: '2026-11-07T05:00:00Z', outcome: 'skipped', reason: 'authorization-expired' }} />);
    expect(screen.getByText('Last run: skipped (November 7, 2026), your prescription has expired.')).toBeInTheDocument();
  });

  it('a stopped series says so with the reason', () => {
    renderWithProviders(<RefillLastRun run={{ runAt: '2026-11-07T05:00:00Z', outcome: 'stopped', reason: 'authorization-exhausted' }} />);
    expect(screen.getByText('Auto-refill stopped (November 7, 2026), your prescription has no refills left.')).toBeInTheDocument();
  });

  it('every reason has words', () => {
    const reasons: RefillReason[] = ['authorization-expired', 'authorization-exhausted', 'ceiling', 'prescription-missing', 'payment-method-missing'];
    for (const reason of reasons) {
      const { unmount } = renderWithProviders(<RefillLastRun run={{ runAt: '2026-11-07T05:00:00Z', outcome: 'skipped', reason }} />);
      expect(document.querySelector('[data-last-run]')?.textContent).not.toMatch(/autoRefill|\.reason\./);
      expect(document.querySelector(`[data-reason="${reason}"]`)).not.toBeNull();
      unmount();
    }
  });

  it('a cleared check is neutral, not a warning', () => {
    renderWithProviders(<RefillLastRun run={{ runAt: '2026-11-07T05:00:00Z', outcome: 'allowed' }} />);
    expect(screen.getByText('Last check November 7, 2026: your refill was cleared to go ahead.')).toBeInTheDocument();
  });
});

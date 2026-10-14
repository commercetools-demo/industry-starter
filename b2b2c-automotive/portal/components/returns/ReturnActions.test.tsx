import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { ReturnStatus } from '@/lib/contracts/return-item';
import type { RefundState } from '@/lib/v-types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { ReturnActions } from './ReturnActions';

function show(status: ReturnStatus, refundState: RefundState = 'none', handlers = { onMove: vi.fn(), onRefund: vi.fn(), onReject: vi.fn() }) {
  renderWithProviders(<ReturnActions status={status} refundState={refundState} {...handlers} />, { locale: 'en-US', messages: en });
  return handlers;
}

describe('return actions disabled reason', () => {
  it('a move the lifecycle refuses is disabled with a text reason linked by aria-describedby', () => {
    show('requested');
    const inspect = screen.getByRole('button', { name: 'Mark inspected' });
    expect(inspect).toBeDisabled();
    const reason = document.getElementById(inspect.getAttribute('aria-describedby') as string);
    expect(reason).toHaveTextContent('Not available while the return is Requested.');
    expect(screen.getByRole('button', { name: 'Mark received' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled();
  });

  it('a closed return disables every move with the closed reason', () => {
    show('refunded');
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      expect(document.getElementById(button.getAttribute('aria-describedby') as string)).toHaveTextContent('This return is closed.');
    }
  });

  it('a pending refund blocks refund and reject; a failed one offers a retry', () => {
    show('inspected', 'pending');
    expect(screen.getByRole('button', { name: 'Refund' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
    expect(screen.getAllByText("A refund is waiting for Stripe's confirmation.").length).toBe(2);
  });

  it('shows Retry refund after a failure and calls the handlers', async () => {
    const handlers = show('inspected', 'failed');
    await userEvent.click(screen.getByRole('button', { name: 'Retry refund' }));
    expect(handlers.onRefund).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(handlers.onReject).toHaveBeenCalled();
  });

  it('calls onMove with the target word and has no accessibility violations', async () => {
    const handlers = show('requested');
    await userEvent.click(screen.getByRole('button', { name: 'Mark in transit' }));
    expect(handlers.onMove).toHaveBeenCalledWith('in-transit');
    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
});

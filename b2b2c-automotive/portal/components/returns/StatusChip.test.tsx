import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { StatusChip } from './StatusChip';

const show = (ui: React.ReactElement) => renderWithProviders(ui, { locale: 'en-US', messages: en });

describe('return status chips', () => {
  it.each([
    ['requested', 'Requested', 'warning'],
    ['in-transit', 'In transit', 'info'],
    ['received', 'Received', 'info'],
    ['inspected', 'Inspected', 'info'],
    ['refunded', 'Refunded', 'success'],
    ['rejected', 'Rejected', 'critical'],
  ] as const)('%s shows its text with the %s tone', (status, text, tone) => {
    const { container } = show(<StatusChip status={status} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(container.querySelector(`[data-tone="${tone}"]`)).not.toBeNull();
  });

  it('adds the Refund pending and Refund failed chips with text', () => {
    const { container, rerender } = show(<StatusChip status="inspected" refundState="pending" />);
    expect(screen.getByText('Refund pending')).toBeInTheDocument();
    expect(container.querySelector('[data-tone="warning"]')).not.toBeNull();
    rerender(<StatusChip status="inspected" refundState="failed" />);
    expect(screen.getByText('Refund failed')).toBeInTheDocument();
    expect(container.querySelector('[data-tone="critical"]')).not.toBeNull();
  });
});

import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithIntl } from '@/test/render';
import DroppedLinesNotice from '@/components/cart/DroppedLinesNotice';
import { DROPPED_LINES_KEY, storeDroppedLines } from '@/lib/cart/dropped';

afterEach(() => sessionStorage.clear());

describe('DroppedLinesNotice', () => {
  it('notice persists until dismissed', async () => {
    storeDroppedLines([
      { sku: 'S3', name: 'Ethiopia Yirgacheffe', reason: 'no-price' },
      { sku: 'S4', name: 'Glass cups', reason: 'unknown' },
    ]);
    const first = renderWithIntl(<DroppedLinesNotice />);
    expect(screen.getByTestId('dropped-lines')).toHaveTextContent('2 items could not be moved to your new region: Ethiopia Yirgacheffe, Glass cups');
    first.unmount();

    // A new page (the navigation after the switch) still shows it.
    renderWithIntl(<DroppedLinesNotice />);
    expect(screen.getByTestId('dropped-lines')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('dropped-lines')).toBeNull();
    expect(sessionStorage.getItem(DROPPED_LINES_KEY)).toBeNull();
  });

  it('shows one item in the singular and appears when the lines arrive after mount', () => {
    renderWithIntl(<DroppedLinesNotice />);
    expect(screen.queryByTestId('dropped-lines')).toBeNull();
    act(() => storeDroppedLines([{ sku: 'S3', name: 'Cups', reason: 'no-price' }]));
    expect(screen.getByTestId('dropped-lines')).toHaveTextContent('1 item could not be moved to your new region: Cups');
  });

  it('nothing to show for an empty or broken list', () => {
    sessionStorage.setItem(DROPPED_LINES_KEY, '{not json');
    renderWithIntl(<DroppedLinesNotice />);
    expect(screen.queryByTestId('dropped-lines')).toBeNull();
  });
});

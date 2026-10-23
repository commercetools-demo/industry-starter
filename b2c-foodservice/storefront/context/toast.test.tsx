import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '@/context/toast';

function Trigger() {
  const { show } = useToast();
  return <button onClick={() => show('Collecting from SoHo')}>go</button>;
}

// E's components/ui/Toast.test.tsx covers the 2.2 s timer and the restart. These are F's shell-level additions.
describe('ToastProvider in the shell', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('toast never takes focus', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    const button = screen.getByRole('button', { name: 'go' });
    button.focus();
    act(() => button.click());
    expect(screen.getByRole('status')).toHaveTextContent('Collecting from SoHo');
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('status').className).toContain('pointer-events-none');
  });

  it('Repeated action updates text and restarts the timer', () => {
    function Twice() {
      const { show } = useToast();
      return (
        <button
          onClick={() => {
            show('first');
            setTimeout(() => show('second'), 1500);
          }}
        >
          twice
        </button>
      );
    }
    render(
      <ToastProvider>
        <Twice />
      </ToastProvider>,
    );
    act(() => screen.getByRole('button').click());
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole('status')).toHaveTextContent('second');
    act(() => vi.advanceTimersByTime(2199)); // 3699 after the first call: still visible
    expect(screen.getByRole('status')).toHaveTextContent('second');
    act(() => vi.advanceTimersByTime(2)); // 3701: hidden, not at 2200
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

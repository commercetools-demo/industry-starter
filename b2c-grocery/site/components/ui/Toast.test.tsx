import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { ToastProvider, useToast, type ToastInput } from './Toast';

function Trigger({ toast, label = 'show' }: { toast: ToastInput; label?: string }) {
  const { show } = useToast();
  return <button onClick={() => show(toast)}>{label}</button>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('appears with the message and the action, inside a polite status region', () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Trigger toast={{ message: 'Added to your bag', actionLabel: 'View bag', onAction }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('show'));
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Added to your bag');
    fireEvent.click(screen.getByRole('button', { name: 'View bag' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByText('Added to your bag')).toBeNull();
  });

  it('action with href renders a locale-aware link', () => {
    renderWithProviders(
      <ToastProvider>
        <Trigger toast={{ message: 'Added', actionLabel: 'View bag', href: '/cart' }} />
      </ToastProvider>,
      { locale: 'de-DE' },
    );
    fireEvent.click(screen.getByText('show'));
    expect(screen.getByRole('link', { name: 'View bag' })).toHaveAttribute('href', '/de-DE/cart');
  });

  it('Add-to-bag toast: auto-dismisses after exactly 2800 ms', () => {
    render(
      <ToastProvider>
        <Trigger toast={{ message: 'Added to your bag' }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('show'));
    act(() => {
      vi.advanceTimersByTime(2799);
    });
    expect(screen.getByText('Added to your bag')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Added to your bag')).toBeNull();
  });

  it('a second toast replaces the first and restarts the timer', () => {
    render(
      <ToastProvider>
        <Trigger toast={{ message: 'First' }} label="one" />
        <Trigger toast={{ message: 'Second' }} label="two" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('one'));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByText('two'));
    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getByText('Second')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2799);
    });
    expect(screen.getByText('Second')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Second')).toBeNull();
  });

  it('useToast outside the provider fails loudly', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger toast={{ message: 'x' }} />)).toThrow('ToastProvider');
    spy.mockRestore();
  });
});

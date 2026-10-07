import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { TOAST_MS, useToast, type ToastInput } from './Toast';

function Trigger({ toast }: { toast: ToastInput }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(toast)}>
      go
    </button>
  );
}

function open(toast: ToastInput) {
  renderWithProviders(<Trigger toast={toast} />);
  fireEvent.click(screen.getByRole('button', { name: 'go' }));
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('the status region is mounted before any toast', () => {
    renderWithProviders(<p>x</p>);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('appears with the message and an action link', () => {
    open({ message: 'Added to your bundle', actionLabel: 'View bundle', href: '/bundle' });
    expect(screen.getByRole('status')).toHaveTextContent('Added to your bundle');
    expect(screen.getByRole('link', { name: 'View bundle' })).toHaveAttribute('href', '/en-US/bundle');
  });

  it('auto-dismisses at exactly 4000 ms', () => {
    expect(TOAST_MS).toBe(4000);
    open({ message: 'Saved' });
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('a second toast replaces the first and restarts the timer', () => {
    function Two() {
      const { show } = useToast();
      return (
        <>
          <button type="button" onClick={() => show({ message: 'First' })}>
            one
          </button>
          <button type="button" onClick={() => show({ message: 'Second', tone: 'error' })}>
            two
          </button>
        </>
      );
    }
    renderWithProviders(<Two />);
    fireEvent.click(screen.getByRole('button', { name: 'one' }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'two' }));
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second').parentElement).toHaveAttribute('data-tone', 'error');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Second')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
  });

  it('hover pauses the timer and leaving resumes it with the time left', () => {
    open({ message: 'Hold me' });
    const toast = screen.getByText('Hold me').parentElement as HTMLElement;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('Hold me')).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByText('Hold me')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Hold me')).not.toBeInTheDocument();
  });

  it('the close button dismisses and has a translated name', () => {
    open({ message: 'Bye' });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Bye')).not.toBeInTheDocument();
  });

  it('the close button name is German in de-DE', () => {
    renderWithProviders(<Trigger toast={{ message: 'Tschüss' }} />, { locale: 'de-DE' });
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
  });

  it('useToast outside the provider fails loudly', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Bare() {
      useToast();
      return null;
    }
    expect(() => render(<Bare />)).toThrow('ToastProvider');
    spy.mockRestore();
  });
});

import { useState } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/test/utils';
import { Modal } from './Modal';
import { TOAST_DURATION_MS, LiveRegion, useToast } from './Toast';

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open booking
      </button>
      <Modal
        open={open}
        title="Confirm booking"
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <label>
          Name
          <input />
        </label>
        <button type="button">Confirm</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('opens as a labelled modal dialog and moves focus to the first field', async () => {
    renderWithProviders(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open booking' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm booking' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(dialog).toHaveClass('max-w-130');
  });

  it('Escape closes it and focus returns to the opener', async () => {
    const onClose = vi.fn();
    renderWithProviders(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open booking' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('overlay click closes it; a click inside the card does not', async () => {
    const onClose = vi.fn();
    const { container } = renderWithProviders(<Harness onClose={onClose} />);
    expect(container).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Open booking' }));
    await userEvent.click(screen.getByRole('dialog'));
    await userEvent.click(screen.getByText('Confirm booking'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(document.querySelector('[data-overlay]') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the close button closes it', async () => {
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open booking' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('traps Tab inside the card in both directions', async () => {
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open booking' }));
    const name = screen.getByLabelText('Name');
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    const close = screen.getByRole('button', { name: 'Close dialog' });
    expect(name).toHaveFocus();
    await userEvent.tab();
    expect(confirm).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(name).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it('the overlay button is not in the tab order and is hidden from assistive technology', async () => {
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open booking' }));
    const overlay = document.querySelector('[data-overlay]');
    expect(overlay).toHaveAttribute('tabindex', '-1');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });

  it('locks page scroll while open and restores it', async () => {
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open booking' }));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });
});

function ToastButton() {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show({ message: 'Added to cart', action: { label: 'View cart', href: '/cart' } })}>
      Add
    </button>
  );
}

describe('Toast and LiveRegion', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the message with its link and announces it politely', async () => {
    renderWithProviders(<ToastButton />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('status')).toHaveTextContent('Added to cart');
    expect(screen.getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/en-US/cart');
  });

  it('disappears after 5 seconds', () => {
    vi.useFakeTimers();
    renderWithProviders(<ToastButton />);
    act(() => screen.getByRole('button', { name: 'Add' }).click());
    expect(screen.getByRole('link', { name: 'View cart' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    });
    expect(screen.getByRole('link', { name: 'View cart' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('link', { name: 'View cart' })).toBeNull();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(TOAST_DURATION_MS).toBe(5000);
  });

  it('a second toast restarts the timer', () => {
    vi.useFakeTimers();
    renderWithProviders(<ToastButton />);
    const add = screen.getByRole('button', { name: 'Add' });
    act(() => add.click());
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    act(() => add.click());
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByRole('link', { name: 'View cart' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('link', { name: 'View cart' })).toBeNull();
  });

  it('the dismiss button removes it', async () => {
    renderWithProviders(<ToastButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByRole('link', { name: 'View cart' })).toBeNull();
  });

  it('LiveRegion on its own renders the message in a polite status region', () => {
    renderWithProviders(<LiveRegion message="Saved" />);
    expect(screen.getAllByRole('status').some((el) => el.textContent === 'Saved')).toBe(true);
  });

  it('useToast outside the provider fails loudly', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useToast();
      return null;
    }
    expect(() => render(<Bare />)).toThrow('useToast must be used inside <ToastProvider>');
    spy.mockRestore();
  });
});

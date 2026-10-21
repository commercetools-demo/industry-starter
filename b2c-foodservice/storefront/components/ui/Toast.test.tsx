import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '@/context/toast';

function Trigger({ message }: { message: string }) {
  const { show } = useToast();
  return <button onClick={() => show(message)}>show {message}</button>;
}

function click(name: string) {
  act(() => {
    screen.getByRole('button', { name }).click();
  });
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('Toast shows the message with a polite live region', () => {
    render(
      <ToastProvider>
        <Trigger message="Added to bag" />
      </ToastProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
    click('show Added to bag');
    expect(region).toHaveTextContent('Added to bag');
  });

  it('Toast disappears after 2.2 seconds', () => {
    render(
      <ToastProvider>
        <Trigger message="Saved" />
      </ToastProvider>,
    );
    click('show Saved');
    act(() => vi.advanceTimersByTime(2199));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    act(() => vi.advanceTimersByTime(2));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('A second message replaces the first and restarts the timer', () => {
    function Two() {
      const { show } = useToast();
      return (
        <>
          <button onClick={() => show('One')}>one</button>
          <button onClick={() => show('Two')}>two</button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Two />
      </ToastProvider>,
    );
    click('one');
    act(() => vi.advanceTimersByTime(1500));
    click('two');
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Two');
    expect(region).not.toHaveTextContent('One');
    act(() => vi.advanceTimersByTime(1500));
    expect(region).toHaveTextContent('Two');
    act(() => vi.advanceTimersByTime(800));
    expect(region).toBeEmptyDOMElement();
  });

  it('The toast pill is transform-only so content is never hidden at rest', () => {
    render(
      <ToastProvider>
        <Trigger message="Saved" />
      </ToastProvider>,
    );
    click('show Saved');
    const pill = screen.getByText('Saved').parentElement as HTMLElement;
    expect(pill.className).toContain('fade-up');
    expect(pill.className).not.toMatch(/opacity-0|invisible/);
    expect(pill.className).toContain('bg-ink');
  });

  it('useToast outside the provider throws a clear error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger message="x" />)).toThrow('useToast must be used inside <ToastProvider>');
    spy.mockRestore();
  });
});

import { describe, expect, it, vi } from 'vitest';
import GlobalError from '@/app/global-error';
import LocaleError from '@/app/[locale]/error';
import BoomPage from '@/app/[locale]/%5Fboom/page';
import { renderWithProviders, screen, fireEvent, render } from '@/test/utils';

function failure(message: string, digest?: string): Error & { digest?: string } {
  const error = new Error(message) as Error & { digest?: string };
  error.digest = digest;
  error.stack = `Error: ${message}\n    at secretFunction (/srv/app/lib/ct/orders.ts:42:7)`;
  return error;
}

describe('error-pages › Upstream fault', () => {
  it('names the fault, offers Try again and Home, and shows only the correlation id', () => {
    const reset = vi.fn();
    const { container } = renderWithProviders(
      <LocaleError error={failure('CTP 500 for jane@example.com reason=asthma', 'abc123')} reset={reset} />,
    );
    expect(screen.getByRole('heading', { name: 'Something went wrong on our side' })).toBeInTheDocument();
    expect(screen.getByText('Reference: abc123')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/en-US');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
    const html = container.innerHTML;
    for (const leak of ['jane@example.com', 'asthma', 'CTP 500', 'secretFunction', 'orders.ts']) {
      expect(html).not.toContain(leak);
    }
  });

  it('renders without a reference when the error has no digest', () => {
    renderWithProviders(<LocaleError error={failure('x')} reset={() => undefined} />);
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });

  it('the global boundary also hides the message and stack and keeps a retry and a way home', () => {
    const reset = vi.fn();
    const { container } = render(<GlobalError error={failure('db password=hunter2', 'g-9')} reset={reset} />);
    expect(container.textContent).toContain('Something went wrong on our side');
    expect(container.textContent).toContain('Reference: g-9');
    expect(container.innerHTML).not.toContain('hunter2');
    expect(container.innerHTML).not.toContain('secretFunction');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });

  it('the dev-only /_boom page throws in development and is a 404 in production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => BoomPage()).toThrow(/boom/);
    vi.stubEnv('NODE_ENV', 'production');
    let thrown: unknown;
    try {
      BoomPage();
    } catch (error) {
      thrown = error;
    }
    expect((thrown as { digest?: string }).digest).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
    vi.unstubAllEnvs();
  });
});

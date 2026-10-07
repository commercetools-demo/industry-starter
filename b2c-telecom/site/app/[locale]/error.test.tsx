import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import LocaleError from './error';

const fetchSpy = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchSpy);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function boundary(digest?: string) {
  const error = Object.assign(new Error('secret upstream detail 42'), digest ? { digest } : {});
  const reset = vi.fn();
  renderWithProviders(<LocaleError error={error} reset={reset} />);
  return { reset, error };
}

describe('[locale] error boundary', () => {
  it('Upstream fault: shows the server-error page with a retry, never the raw message, and touches neither session nor cart', () => {
    const { reset } = boundary('abc123');
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong on our side' })).toBeInTheDocument();
    expect(screen.getByText('Reference: abc123')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('secret upstream detail 42');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en-US');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
  });

  it('without a digest there is no reference line', () => {
    boundary();
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });

  it('logs the error with its digest for the server logs', () => {
    const { error } = boundary('abc123');
    expect(console.error).toHaveBeenCalledWith('[error-boundary]', 'abc123', error);
  });

  it('de-DE copy', () => {
    const error = Object.assign(new Error('x'), { digest: 'd1' });
    renderWithProviders(<LocaleError error={error} reset={() => undefined} />, { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Bei uns ist etwas schiefgelaufen' })).toBeInTheDocument();
    expect(screen.getByText('Referenz: d1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
  });
});

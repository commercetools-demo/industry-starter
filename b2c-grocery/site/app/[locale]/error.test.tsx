import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import LocaleError from './error';

describe('LocaleError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('Unhandled server error: shows generic text, never the raw error message', () => {
    renderWithProviders(<LocaleError error={new Error('secret stack detail ECONNRESET')} reset={() => {}} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.queryByText(/ECONNRESET/)).not.toBeInTheDocument();
  });

  it('Unhandled server error: Try again calls reset', async () => {
    const reset = vi.fn();
    renderWithProviders(<LocaleError error={new Error('x')} reset={reset} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('logs the error to the console', () => {
    const error = new Error('x');
    renderWithProviders(<LocaleError error={error} reset={() => {}} />);
    expect(console.error).toHaveBeenCalledWith(error);
  });

  it('German locale: localized text and shop link', () => {
    renderWithProviders(<LocaleError error={new Error('x')} reset={() => {}} />, { locale: 'de-DE' });
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zurück zum Shop' })).toHaveAttribute('href', '/de-DE/shop');
  });
});

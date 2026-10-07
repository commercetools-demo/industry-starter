import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { SearchForm } from './SearchForm';

describe('SearchForm', () => {
  it('is a GET search form whose action has the locale prefix', () => {
    renderWithProviders(<SearchForm />);
    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('action', '/en-US/search');
    expect(form).toHaveAttribute('method', 'get');
    expect(screen.getByLabelText('Search plans, add-ons and equipment')).toHaveAttribute('name', 'q');
    renderWithProviders(<SearchForm />, { locale: 'de-DE' });
    expect(screen.getAllByRole('search')[1]).toHaveAttribute('action', '/de-DE/search');
  });

  it('is prefilled, editable and limited to 100 characters', () => {
    renderWithProviders(<SearchForm q="cable" />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('cable');
    expect(input).not.toBeDisabled();
    expect(input).not.toHaveAttribute('readonly');
    expect(input).toHaveAttribute('maxlength', '100');
  });

  it('does not send category, sort or page (a new search starts at page 1)', () => {
    renderWithProviders(<SearchForm q="cable" />);
    expect(screen.getByRole('search').querySelectorAll('input[type="hidden"]')).toHaveLength(0);
  });
});

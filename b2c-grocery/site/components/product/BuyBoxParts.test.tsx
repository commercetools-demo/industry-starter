import { screen, within } from '@testing-library/react';
import { makeProduct, makeVariant } from '@/test/product';
import { renderWithProviders } from '@/test/utils';
import { Availability } from './Availability';
import { ContactStrip } from './ContactStrip';
import { SpecsTable } from './SpecsTable';

describe('Availability', () => {
  it('Out of stock variant: says "Out of stock"', () => {
    renderWithProviders(<Availability variant={makeVariant({ availability: { isOnStock: false, availableQuantity: 0 } })} />);
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    expect(screen.queryByText('In stock')).toBeNull();
  });

  it('in stock variant: says "In stock"', () => {
    renderWithProviders(<Availability variant={makeVariant()} />);
    expect(screen.getByText('In stock')).toBeInTheDocument();
  });

  it('German', () => {
    renderWithProviders(<Availability variant={makeVariant()} />, { locale: 'de-DE' });
    expect(screen.getByText('Auf Lager')).toBeInTheDocument();
  });
});

describe('SpecsTable', () => {
  it('shows a row for each field that has data, with readable storage and dietary labels', () => {
    renderWithProviders(
      <SpecsTable product={makeProduct({ brand: 'Orchard Fresh', origin: 'Spain', storage: 'chilled', dietary: ['vegan', 'gluten-free'], allergens: ['milk'] })} />,
    );
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      'BrandOrchard Fresh',
      'OriginSpain',
      'StorageKeep chilled',
      'DietaryVegan, Gluten free',
      'Allergensmilk',
    ]);
  });

  it('rows without data are omitted', () => {
    renderWithProviders(<SpecsTable product={makeProduct({ brand: 'Orchard Fresh', origin: undefined, storage: undefined, dietary: [], allergens: [] })} />);
    expect(screen.getByRole('rowheader', { name: 'Brand' })).toBeInTheDocument();
    for (const name of ['Origin', 'Storage', 'Dietary', 'Allergens']) expect(screen.queryByRole('rowheader', { name })).toBeNull();
  });

  it('no data at all: renders nothing', () => {
    const { container } = renderWithProviders(<SpecsTable product={makeProduct({ brand: undefined })} />);
    expect(container.querySelector('table')).toBeNull();
  });
});

describe('ContactStrip', () => {
  it('links to /contact', () => {
    renderWithProviders(<ContactStrip />);
    expect(screen.getByText('Questions about this product?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact us/i }).getAttribute('href')).toMatch(/\/contact$/);
  });
});

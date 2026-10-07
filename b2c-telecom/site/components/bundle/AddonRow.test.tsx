import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addonLine, usd } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';
import { AddonRow } from './AddonRow';

describe('AddonRow', () => {
  it('shows the name, "For {plan}", the monthly price and removes by line id', async () => {
    const onRemove = vi.fn();
    renderWithProviders(<AddonRow line={addonLine()} planName="Cable 500" onRemove={onRemove} />);
    expect(screen.getByText('Apple TV+')).toBeInTheDocument();
    expect(screen.getByText('For Cable 500')).toBeInTheDocument();
    expect(screen.getByText('$9.99/mo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Apple TV+' }));
    expect(onRemove).toHaveBeenCalledWith('A1');
  });

  it('shows "Included at no charge" for an included extra', () => {
    renderWithProviders(<AddonRow line={addonLine({ includedAtNoCharge: true, total: usd(0) })} planName="Cable 500" onRemove={vi.fn()} />);
    expect(screen.getByText('Included at no charge')).toBeInTheDocument();
  });

  it('a one-time purchase shows the amount without /mo and a one-time tag', () => {
    renderWithProviders(<AddonRow line={addonLine({ chargeType: 'one-time', recurrence: null, total: usd(12999) })} onRemove={vi.fn()} />);
    expect(screen.getByText('$129.99')).toBeInTheDocument();
    expect(screen.getByText('one-time')).toBeInTheDocument();
    expect(screen.queryByText(/\/mo/)).not.toBeInTheDocument();
  });

  it('required equipment offers "Change" towards the add-ons page for its plan', () => {
    renderWithProviders(<AddonRow line={addonLine({ kind: 'equipment', requiredEquipment: true })} planName="Cable 500" onRemove={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Change' })).toHaveAttribute('href', '/en-US/shop/add-ons?for=L1');
  });

  it('equipment without stock carries a tag: out of stock, or only N left', () => {
    const { unmount } = renderWithProviders(<AddonRow line={addonLine({ kind: 'equipment', stock: { available: 0, inStock: false } })} onRemove={vi.fn()} />);
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    unmount();
    renderWithProviders(<AddonRow line={addonLine({ kind: 'equipment', stock: { available: 1, inStock: false } })} onRemove={vi.fn()} />);
    expect(screen.getByText('Only 1 left')).toBeInTheDocument();
  });
});

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NOVA_5G, NOVA_PRO } from '@/lib/devices/__fixtures__/devices';
import { CartError } from '@/hooks/useCart';
import { renderWithProviders } from '@/test/utils';
import { DeviceCard } from './DeviceCard';

const TODAY = '2026-10-07';
const radio = (name: RegExp | string) => screen.getByRole('radio', { name });
const choose = (name: RegExp | string) => fireEvent.click(radio(name));
const onAdd = () => vi.fn(async () => undefined);

describe('DeviceCard', () => {
  it('shows the name and the lowest prices of the device', () => {
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today={TODAY} onAdd={onAdd()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Nova Pro' })).toBeInTheDocument();
    expect(screen.getByText('From $28.00/mo')).toBeInTheDocument();
    expect(screen.getByText('or $1,008.00 outright')).toBeInTheDocument();
    renderWithProviders(<DeviceCard offer={NOVA_5G} today={TODAY} onAdd={onAdd()} />);
    expect(screen.getByText('From $20.00/mo')).toBeInTheDocument();
    expect(screen.getByText('or $720.00 outright')).toBeInTheDocument();
  });

  it('Same device three modes: switching mode updates due today, monthly and total', () => {
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today={TODAY} onAdd={onAdd()} />);
    // installments over 24 months is the first choice
    expect(radio(/Installments/)).toBeChecked();
    expect(radio('24 months')).toBeChecked();
    expect(screen.getByText('$42.00')).toBeInTheDocument();
    expect(screen.getByText('Then $42.00/mo for 23 more months')).toBeInTheDocument();
    expect(screen.getByText('Total payable: $1,008.00')).toBeInTheDocument();
    expect(screen.getByText(/You own the device after your final payment on September 7, 2028\. Estimated, if you order today\./)).toBeInTheDocument();

    choose('36 months');
    expect(screen.getByText('$28.00', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Then $28.00/mo for 35 more months')).toBeInTheDocument();

    choose(/Pay in full/);
    expect(screen.getByText('$1,008.00', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText(/Then \$/)).toBeNull();
    expect(screen.getByText('You own the device from day one.')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Installment term' })).toBeNull();

    choose(/Lease/);
    expect(screen.getByText('$33.00', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Then $33.00/mo for 23 more months')).toBeInTheDocument();
    expect(screen.getByText('Total payable: $792.00')).toBeInTheDocument();
    // final payment 2028-09-07, 30 days later: 2028-10-07
    expect(screen.getByText(/At the end of the lease you must return the device by October 7, 2028 \(within 30 days of your final payment\)\./)).toBeInTheDocument();
  });

  it('changing the memory changes the prices: 512 GB is $1,188.00 outright, back to 256 GB is $1,008.00', () => {
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today={TODAY} onAdd={onAdd()} />);
    choose(/Pay in full/);
    choose('512 GB');
    expect(radio('512 GB')).toBeChecked();
    expect(screen.getByText('$1,188.00', { selector: 'span' })).toBeInTheDocument();
    choose('Violet');
    expect(radio('Violet')).toBeChecked();
    choose('256 GB');
    expect(screen.getByText('$1,008.00', { selector: 'span' })).toBeInTheDocument();
  });

  it('Mode unavailable for this device: lease is disabled with a visible reason', () => {
    renderWithProviders(<DeviceCard offer={NOVA_5G} today={TODAY} onAdd={onAdd()} />);
    expect(radio(/Lease/)).toBeDisabled();
    expect(screen.getByText('Not available for Nova 5G')).toBeInTheDocument();
    expect(radio(/Pay in full/)).toBeEnabled();
    expect(radio(/Installments/)).toBeEnabled();
  });

  it('a term without a price stays visible, disabled, with the reason (Nova 5G 256 GB Silver has no 36 months)', () => {
    renderWithProviders(<DeviceCard offer={NOVA_5G} today={TODAY} onAdd={onAdd()} />);
    expect(radio('36 months')).toBeEnabled();
    choose('Silver');
    choose('256 GB');
    expect(radio('36 months')).toBeDisabled();
    expect(radio('12 months')).toBeEnabled();
    expect(screen.getByText('The 36-month term is not available for this color and memory.')).toBeInTheDocument();
    // a chosen 36-month term moves to a term that exists
    choose('Black');
    choose('36 months');
    choose('Silver');
    expect(radio('24 months')).toBeChecked();
  });

  it('a lease chosen on Nova Pro moves to installments when the buyer looks at a device without lease', () => {
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today={TODAY} onAdd={onAdd()} />);
    choose(/Lease/);
    expect(radio(/Lease/)).toBeChecked();
  });

  it('color and memory are radio groups with names and move with the arrow keys', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today={TODAY} onAdd={onAdd()} />);
    const colors = screen.getByRole('radiogroup', { name: 'Color' });
    expect(within(colors).getAllByRole('radio').map((entry) => entry.getAttribute('value'))).toEqual(['black', 'silver', 'violet']);
    expect(screen.getByRole('radiogroup', { name: 'Memory' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'How do you want to pay?' })).toBeInTheDocument();
    radio('Black').focus();
    await user.keyboard('{ArrowRight}');
    expect(radio('Silver')).toBeChecked();
  });

  it('adds the variant in the chosen mode, term and quantity', async () => {
    const add = onAdd();
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today={TODAY} onAdd={add} />);
    choose('Silver');
    choose('512 GB');
    choose('36 months');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to bundle' }));
    await waitFor(() => expect(add).toHaveBeenCalledWith({ offerKey: 'malva-offer-phone-nova-pro', sku: 'MLV-DEV-NOVAPRO-SLV-512', quantity: 2, mode: 'installments', termMonths: 36 }));
    expect(screen.getByText('$66.00', { selector: 'span' })).toBeInTheDocument();
  });

  it('says in words why an add was refused', async () => {
    const add = vi.fn(async () => {
      throw new CartError('MODE_UNAVAILABLE', 'CONFLICT', 'x', { mode: 'lease', available: ['outright', 'installments'] }, 409);
    });
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today={TODAY} onAdd={add} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bundle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Lease is not available for Nova Pro. Available: Pay in full, Installments.');
  });

  it('a variant that is out of stock cannot be added', () => {
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today={TODAY} onAdd={onAdd()} />);
    choose('Violet');
    choose('512 GB');
    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
  });

  it('speaks German in de-DE', () => {
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today={TODAY} onAdd={onAdd()} />, { locale: 'de-DE' });
    expect(screen.getByRole('radio', { name: /Ratenzahlung/ })).toBeChecked();
    expect(screen.getByText('Heute fällig')).toBeInTheDocument();
    expect(screen.getByText(/Das Gerät gehört Ihnen nach der letzten Rate am 7\. September 2028\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In mein Paket' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Farbe' })).toBeInTheDocument();
  });
});

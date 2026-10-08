import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildReview } from '@/lib/checkout/review';
import { fakeCheckout, readyState, usd } from '@/test/fixtures/checkoutApi';
import { renderWithProviders } from '@/test/utils';
import { CheckoutSummary } from './CheckoutSummary';
import { DeliveryStep } from './DeliveryStep';

const standard = { id: 'sm-standard', key: 'malva-shipping-standard', name: 'Standard shipping', price: usd(0) };
const express = { id: 'sm-express', key: 'malva-shipping-express', name: 'Express shipping', price: usd(1250) };

describe('DeliveryStep', () => {
  it('lists the returned methods with the returned prices and preselects the first', async () => {
    const state = readyState({ needsDelivery: true });
    const checkout = fakeCheckout(state, { loadDelivery: vi.fn(async () => ({ options: [standard, express], needsDelivery: true, state })) });
    const done = vi.fn();
    renderWithProviders(<DeliveryStep checkout={checkout} onDone={done} />);
    expect(await screen.findByLabelText('Standard shipping · $0.00')).toBeChecked();
    expect(screen.getByLabelText('Express shipping · $12.50')).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(checkout.selectDelivery).toHaveBeenCalledWith('sm-standard'));
    expect(done).toHaveBeenCalled();
  });

  it('Address change moves tax: summary shows the recalculated tax and shipping and withdraws a no-longer-valid method', async () => {
    // The buyer changed the address: the platform recalculated tax and dropped the old method; the options are read again.
    const after = readyState({ needsDelivery: true, delivery: { id: 'sm-old', name: 'Old method', price: usd(500) }, tax: usd(125), shipping: usd(500) });
    const checkout = fakeCheckout(after, { loadDelivery: vi.fn(async () => ({ options: [standard, express], needsDelivery: true, state: after })) });
    renderWithProviders(
      <>
        <CheckoutSummary review={buildReview(after, '2026-10-07')} />
        <DeliveryStep checkout={checkout} onDone={vi.fn()} />
      </>,
    );
    expect(checkout.loadDelivery).toHaveBeenCalledTimes(1);
    // the summary rows are the cart's: shipping $5.00 and tax $1.25 (the desktop summary and the mobile one both render them)
    expect(screen.getAllByText('$5.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$1.25').length).toBeGreaterThan(0);
    // the old method is not offered any more: the first returned one is selected instead
    expect(await screen.findByLabelText('Standard shipping · $0.00')).toBeChecked();
    expect(screen.queryByText(/Old method/)).not.toBeInTheDocument();
  });

  it('keeps the method already on the cart when it is still offered', async () => {
    const state = readyState({ needsDelivery: true, delivery: { id: 'sm-express', name: 'Express shipping', price: usd(1250) } });
    const checkout = fakeCheckout(state, { loadDelivery: vi.fn(async () => ({ options: [standard, express], needsDelivery: true, state })) });
    const done = vi.fn();
    renderWithProviders(<DeliveryStep checkout={checkout} onDone={done} />);
    expect(await screen.findByLabelText('Express shipping · $12.50')).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(checkout.selectDelivery).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalled();
  });

  it('No delivery method for address: states the absence, what to change, and Continue is disabled', async () => {
    const state = readyState({ needsDelivery: true });
    const checkout = fakeCheckout(state, { loadDelivery: vi.fn(async () => ({ options: [], needsDelivery: true, state })) });
    renderWithProviders(<DeliveryStep checkout={checkout} onDone={vi.fn()} />);
    expect(await screen.findByText("We can't deliver equipment to this address with any delivery method.")).toBeInTheDocument();
    expect(screen.getByText('Use a different service address, or remove the equipment and devices from My bundle.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Use a different service address' })).toHaveAttribute('href', '/en-US/bundle/checkout?step=address');
    expect(screen.getByRole('link', { name: 'Edit My bundle' })).toHaveAttribute('href', '/en-US/bundle');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('de-DE: German empty state', async () => {
    const state = readyState({ needsDelivery: true });
    const checkout = fakeCheckout(state, { loadDelivery: vi.fn(async () => ({ options: [], needsDelivery: true, state })) });
    renderWithProviders(<DeliveryStep checkout={checkout} onDone={vi.fn()} />, { locale: 'de-DE' });
    expect(await screen.findByText('Für diese Adresse gibt es keine Liefermethode für Ihre Geräte.')).toBeInTheDocument();
  });
});

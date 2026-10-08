import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutError } from '@/hooks/useCheckout';
import type { SavedAddress } from '@/lib/types';
import { fakeCheckout, makeState, readyState } from '@/test/fixtures/checkoutApi';
import { renderWithProviders } from '@/test/utils';

const book = vi.hoisted(() => ({ addresses: [] as unknown[] }));
vi.mock('@/hooks/useAddresses', () => ({ useAddresses: () => ({ addresses: book.addresses, defaultService: null, defaultBilling: null, isLoading: false, error: undefined }) }));

import { ServiceAddressStep } from './ServiceAddressStep';

const saved = (patch: Partial<SavedAddress>): SavedAddress => ({
  id: 'a1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  streetName: '1 Main St',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'US',
  isService: true,
  isBilling: true,
  isDefaultService: false,
  isDefaultBilling: false,
  ...patch,
});

beforeEach(() => {
  book.addresses = [];
});

async function fillForm() {
  await userEvent.type(screen.getByLabelText('First name'), 'Ada');
  await userEvent.type(screen.getByLabelText('Last name'), 'Lovelace');
  await userEvent.type(screen.getByLabelText('Street address'), '1 Main St');
  await userEvent.type(screen.getByLabelText('City'), 'New York');
  await userEvent.selectOptions(screen.getByLabelText('State'), 'NY');
  await userEvent.type(screen.getByLabelText('ZIP / Postal code'), '10001');
}

describe('ServiceAddressStep', () => {
  it('a typed address is validated in the browser (no request on an invalid ZIP) and then saved with billing the same', async () => {
    const checkout = fakeCheckout(readyState({ serviceAddress: null, billingAddress: null }));
    const done = vi.fn();
    renderWithProviders(<ServiceAddressStep checkout={checkout} phone="" onDone={done} />);
    await fillForm();
    await userEvent.clear(screen.getByLabelText('ZIP / Postal code'));
    await userEvent.type(screen.getByLabelText('ZIP / Postal code'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter a 5-digit ZIP code.')).toBeInTheDocument();
    expect(checkout.saveDetails).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('ZIP / Postal code'));
    await userEvent.type(screen.getByLabelText('ZIP / Postal code'), '10001');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(checkout.saveDetails).toHaveBeenCalledTimes(1));
    expect(checkout.saveDetails).toHaveBeenCalledWith({ serviceAddress: expect.objectContaining({ streetName: '1 Main St', postalCode: '10001', country: 'US', state: 'NY' }) });
    expect(done).toHaveBeenCalled();
  });

  it('billing different: a second form is validated and sent', async () => {
    const checkout = fakeCheckout(readyState({ serviceAddress: null, billingAddress: null }));
    renderWithProviders(<ServiceAddressStep checkout={checkout} phone="" onDone={vi.fn()} />);
    await fillForm();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Billing address is the same' }));
    expect(screen.getByRole('heading', { name: 'Billing address' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(checkout.saveDetails).not.toHaveBeenCalled(); // the billing form is empty
    const billing = within(screen.getByRole('heading', { name: 'Billing address' }).closest('section') as HTMLElement);
    await userEvent.type(billing.getByLabelText('First name'), 'Bill');
    await userEvent.type(billing.getByLabelText('Last name'), 'Payer');
    await userEvent.type(billing.getByLabelText('Street address'), '9 Other Rd');
    await userEvent.type(billing.getByLabelText('City'), 'Albany');
    await userEvent.selectOptions(billing.getByLabelText('State'), 'NY');
    await userEvent.type(billing.getByLabelText('ZIP / Postal code'), '12207');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(checkout.saveDetails).toHaveBeenCalled());
    expect(checkout.saveDetails).toHaveBeenCalledWith({ serviceAddress: expect.anything(), billingAddress: expect.objectContaining({ streetName: '9 Other Rd' }) });
  });

  it('saved addresses: only the default is preselected, non-service and other-country addresses are not listed', async () => {
    book.addresses = [
      saved({ id: 'a1', isDefaultService: true, streetName: '1 Main St' }),
      saved({ id: 'a2', streetName: '2 Side St' }),
      saved({ id: 'a3', streetName: 'Billing only', isService: false }),
      saved({ id: 'a4', streetName: 'Berlin Str', country: 'DE', postalCode: '10115', state: undefined }),
    ];
    const checkout = fakeCheckout(readyState({ serviceAddress: null }));
    renderWithProviders(<ServiceAddressStep checkout={checkout} phone="" onDone={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /1 Main St/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /2 Side St/ })).not.toBeChecked();
    expect(screen.queryByText(/Billing only/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Berlin Str/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(checkout.saveDetails).toHaveBeenCalledWith({ serviceAddress: expect.objectContaining({ streetName: '1 Main St' }) }));
  });

  it('saved addresses without a default: none is preselected and Continue is disabled until one is picked', async () => {
    book.addresses = [saved({ id: 'a1' }), saved({ id: 'a2', streetName: '2 Side St' })];
    renderWithProviders(<ServiceAddressStep checkout={fakeCheckout(readyState({ serviceAddress: null }))} phone="" onDone={vi.fn()} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: /2 Side St/ }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('"Use a different address" shows the form', async () => {
    book.addresses = [saved({ id: 'a1', isDefaultService: true })];
    renderWithProviders(<ServiceAddressStep checkout={fakeCheckout(readyState({ serviceAddress: null }))} phone="" onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Use a different address' }));
    expect(screen.getByLabelText('Street address')).toBeInTheDocument();
  });

  it('not serviceable: names the items, offers both exits and blocks Continue', async () => {
    const saveDetails = vi.fn(async () => {
      throw new CheckoutError('NOT_SERVICEABLE', 'x', 422, { lineIds: ['L1'], postalCode: '10001' });
    });
    renderWithProviders(<ServiceAddressStep checkout={fakeCheckout(makeState({ signedIn: true, email: 'a@b.co' }), { saveDetails })} phone="" onDone={vi.fn()} />);
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText("We can't serve this address with Cable 500.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change address' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit My bundle' })).toHaveAttribute('href', '/en-US/bundle');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Change address' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('de-DE: no state field, the market country is stated', () => {
    renderWithProviders(<ServiceAddressStep checkout={fakeCheckout(makeState())} phone="" onDone={vi.fn()} />, { locale: 'de-DE' });
    expect(screen.queryByLabelText('State')).not.toBeInTheDocument();
    expect(screen.getByText('Land: Deutschland')).toBeInTheDocument();
  });
});

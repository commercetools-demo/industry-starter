import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, AddressInput, DeliveryOption } from '@/lib/types';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { AddressCard } from './AddressCard';
import { DeliverySpeedCard } from './DeliverySpeedCard';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sam = (over: Partial<Address> = {}): Address => ({
  id: 'a1', firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'Austin', state: 'TX', zip: '78701', phone: '+15125550100', country: 'US', isDefault: true, ...over,
});

let book: Address[];
beforeEach(() => {
  book = [sam(), sam({ id: 'a2', isDefault: false, street: '9 Oak Ave', city: 'Dallas', zip: '75201' })];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/auth/me') return json({ id: 'c1', firstName: 'Alex', lastName: 'Chen' });
      if (path === '/api/account/addresses') return json({ addresses: book });
      return json({ error: 'x' }, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const save = (result: Awaited<ReturnType<Parameters<typeof AddressCard>[0]['onSave']>> = { ok: true }) => vi.fn(async (): Promise<typeof result> => result);

describe('design-checkout: Delivery address', () => {
  it('Prefill: the default address fills the fields and they stay editable', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressCard cartAddress={null} onSave={save()} undeliverable={false} />);
    expect(await screen.findByDisplayValue('12 Elm St')).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue('Sam');
    expect(screen.getByLabelText(/Last name/)).toHaveValue('Rivera');
    expect(screen.getByLabelText(/ZIP code/)).toHaveValue('78701');
    expect(screen.getByLabelText(/Phone/)).toHaveValue('+15125550100');
    await user.clear(screen.getByLabelText(/Street address/));
    await user.type(screen.getByLabelText(/Street address/), '1 New Rd');
    expect(screen.getByLabelText(/Street address/)).toHaveValue('1 New Rd');
  });

  it('Prefill: with no saved address the name defaults to the account name', async () => {
    book = [];
    renderWithProviders(<AddressCard cartAddress={null} onSave={save()} undeliverable={false} />);
    await waitFor(() => expect(screen.getByLabelText(/First name/)).toHaveValue('Alex'));
    expect(screen.getByLabelText(/Last name/)).toHaveValue('Chen');
    expect(screen.getByLabelText(/Street address/)).toHaveValue('');
  });

  it('Prefill: no default address says so and asks to choose (the address on the cart wins over the default when there is one)', async () => {
    book = [sam({ isDefault: false })];
    renderWithProviders(<AddressCard cartAddress={null} onSave={save()} undeliverable={false} />);
    expect(await screen.findByText(/You have no default address/)).toBeInTheDocument();
  });

  it('Prefill: an address already on the cart is shown instead of the default', async () => {
    const onCart: AddressInput = { firstName: 'Pat', lastName: 'Lee', street: '5 Pine', street2: '', city: 'Chicago', state: 'IL', zip: '60601', phone: '+13125550100' };
    renderWithProviders(<AddressCard cartAddress={onCart} onSave={save()} undeliverable={false} />);
    expect(await screen.findByDisplayValue('5 Pine')).toBeInTheDocument();
    expect(document.querySelector('[data-address-status]')).toHaveTextContent('Delivering to Pat Lee, Chicago, IL 60601.');
  });

  it('Invalid input: a malformed ZIP and phone show inline errors, focus moves to the first one and nothing is sent', async () => {
    const user = userEvent.setup();
    const onSave = save();
    renderWithProviders(<AddressCard cartAddress={null} onSave={onSave} undeliverable={false} />);
    await screen.findByDisplayValue('12 Elm St');
    await user.clear(screen.getByLabelText(/ZIP code/));
    await user.type(screen.getByLabelText(/ZIP code/), '123');
    await user.clear(screen.getByLabelText(/Phone/));
    await user.type(screen.getByLabelText(/Phone/), 'abc');
    await user.click(screen.getByRole('button', { name: 'Use this address' }));
    expect(screen.getByText('Enter a 5-digit ZIP code, or 9 digits with a dash.')).toBeInTheDocument();
    expect(screen.getByText('Enter a 10-digit US phone number.')).toBeInTheDocument();
    expect(screen.getByLabelText(/ZIP code/)).toHaveFocus();
    expect(screen.getByLabelText(/ZIP code/)).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Invalid input: a required field left empty gets the focus', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressCard cartAddress={null} onSave={save()} undeliverable={false} />);
    await screen.findByDisplayValue('12 Elm St');
    await user.clear(screen.getByLabelText(/City/));
    await user.click(screen.getByRole('button', { name: 'Use this address' }));
    expect(screen.getByLabelText(/City/)).toHaveFocus();
    expect(screen.getByText('Enter a city.')).toBeInTheDocument();
  });

  it('a valid submit sends the validated address once; the button is busy meanwhile', async () => {
    const user = userEvent.setup();
    let release: (value: { ok: true }) => void = () => undefined;
    const onSave = vi.fn(() => new Promise<{ ok: true }>((resolve) => { release = resolve; }));
    renderWithProviders(<AddressCard cartAddress={null} onSave={onSave} undeliverable={false} />);
    await screen.findByDisplayValue('12 Elm St');
    const button = screen.getByRole('button', { name: 'Use this address' });
    await user.click(button);
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'Austin', state: 'TX', zip: '78701', phone: '+15125550100' });
    release({ ok: true });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('server field problems are shown and a failure message appears for a failed save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: false as const, reason: 'invalid' as const, fields: { zip: 'invalid' as const } }));
    renderWithProviders(<AddressCard cartAddress={null} onSave={onSave} undeliverable={false} />);
    await screen.findByDisplayValue('12 Elm St');
    await user.click(screen.getByRole('button', { name: 'Use this address' }));
    expect(await screen.findByText('Enter a 5-digit ZIP code, or 9 digits with a dash.')).toBeInTheDocument();
    onSave.mockResolvedValue({ ok: false as const, reason: 'failed' as never, fields: undefined as never });
    await user.click(screen.getByRole('button', { name: 'Use this address' }));
    expect(await screen.findByText('We could not save this address. Please try again.')).toBeInTheDocument();
  });

  it('No delivery method for address: the card says so and what to change', async () => {
    renderWithProviders(<AddressCard cartAddress={null} onSave={save()} undeliverable />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We cannot deliver to this address with any delivery option. Check the state and ZIP code, or use a different address.');
  });

  it('choosing a saved address fills the form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressCard cartAddress={null} onSave={save()} undeliverable={false} />);
    await screen.findByDisplayValue('12 Elm St');
    await user.selectOptions(screen.getByLabelText('Saved addresses'), 'a2');
    expect(screen.getByLabelText(/Street address/)).toHaveValue('9 Oak Ave');
    expect(screen.getByLabelText(/City/)).toHaveValue('Dallas');
  });
});

const standard: DeliveryOption = { key: 'mlv-standard', name: 'Standard delivery', price: { centAmount: 0, currencyCode: 'USD', fractionDigits: 2 } };
const sameDay: DeliveryOption = { key: 'mlv-same-day', name: 'Same-day delivery', price: { centAmount: 500, currencyCode: 'USD', fractionDigits: 2 } };

describe('design-checkout: Delivery speed re-pricing', () => {
  it('Options: Standard · 1–2 days FREE is selected and Same-day · by 8 pm $5.00 is offered', () => {
    renderWithProviders(<DeliverySpeedCard options={[standard, sameDay]} selectedKey="mlv-standard" hasAddress onChoose={vi.fn()} />);
    const std = screen.getByRole('radio', { name: /Standard · 1–2 days/ });
    expect(std).toBeChecked();
    expect(std.closest('label')).toHaveTextContent('FREE');
    const fast = screen.getByRole('radio', { name: /Same-day · by 8 pm/ });
    expect(fast).not.toBeChecked();
    expect(fast.closest('label')).toHaveTextContent('$5.00');
    // The selected card carries the azure border through the shared RadioCard (has-checked); the unselected one does not.
    expect(std.closest('label')?.className).toContain('has-checked:border-brand-500');
  });

  it('Same-day not available: when the platform options lack it, it is not offered and a note says why', () => {
    renderWithProviders(<DeliverySpeedCard options={[standard]} selectedKey="mlv-standard" hasAddress onChoose={vi.fn()} />);
    expect(screen.queryByRole('radio', { name: /Same-day/ })).toBeNull();
    expect(screen.getByText(/Same-day delivery is not available for this order/)).toBeInTheDocument();
  });

  it('Change: selecting Same-day asks the server, once', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn(async () => ({ ok: true as const }));
    renderWithProviders(<DeliverySpeedCard options={[standard, sameDay]} selectedKey="mlv-standard" hasAddress onChoose={onChoose} />);
    await user.click(screen.getByRole('radio', { name: /Same-day/ }));
    expect(onChoose).toHaveBeenCalledWith('mlv-same-day');
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('Change: a refused choice (the cut-off passed meanwhile) shows a message', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn(async () => ({ ok: false as const, reason: 'unavailable' as const }));
    renderWithProviders(<DeliverySpeedCard options={[standard, sameDay]} selectedKey="mlv-standard" hasAddress onChoose={onChoose} />);
    await user.click(screen.getByRole('radio', { name: /Same-day/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That delivery option is no longer available');
  });

  it('No delivery method for address: the absence is stated and no radio is shown', () => {
    renderWithProviders(<DeliverySpeedCard options={[]} selectedKey={null} hasAddress onChoose={vi.fn()} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent('No delivery option is available for this address.');
  });

  it('without an address on the cart it asks for one', () => {
    renderWithProviders(<DeliverySpeedCard options={[]} selectedKey={null} hasAddress={false} onChoose={vi.fn()} />);
    expect(screen.getByText('Save your delivery address to see the delivery options.')).toBeInTheDocument();
  });
});

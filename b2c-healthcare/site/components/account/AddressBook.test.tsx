import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addressWarning, validateAddress } from '@/lib/address';
import type { Address } from '@/lib/types';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';
import { AddressBook } from './AddressBook';
import { AddressForm } from './AddressForm';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// A tiny in-memory stand-in for /api/account/addresses (the real routes are tested on their own).
let book: Address[];
let nextId: number;
let calls: Array<{ method: string; path: string; body?: Record<string, unknown> }>;
let signedOut = false;

function server(path: string, init: RequestInit = {}): Response {
  const method = init.method ?? 'GET';
  const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
  calls.push({ method, path, body });
  if (signedOut) return json({ error: 'Please sign in to continue.' }, 401);
  const reply = () => json({ status: 'saved', addresses: [...book.filter((a) => a.isDefault), ...book.filter((a) => !a.isDefault)] });
  if (method === 'GET') return json({ addresses: book });
  const id = path.split('/')[4];
  if (path.endsWith('/default')) {
    book = book.map((a) => ({ ...a, isDefault: a.id === id }));
    return reply();
  }
  if (method === 'DELETE') {
    book = book.filter((a) => a.id !== id);
    return reply();
  }
  const checked = validateAddress(body);
  if (!checked.ok) return json({ error: 'Check the highlighted fields.', fields: checked.problems }, 400);
  const warning = addressWarning(checked.value);
  if (warning && body?.confirmed !== true) return json({ status: 'needs-confirmation', warning });
  const makeDefault = body?.makeDefault === true || (method === 'POST' && book.length === 0);
  if (makeDefault) book = book.map((a) => ({ ...a, isDefault: false }));
  if (method === 'POST') book.push({ ...checked.value, id: `a${(nextId += 1)}`, country: 'US', isDefault: makeDefault });
  else book = book.map((a) => (a.id === id ? { ...a, ...checked.value, isDefault: makeDefault || a.isDefault } : a));
  return reply();
}

const sam = (over: Partial<Address> = {}): Address => ({
  id: 'a1', firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'Austin', state: 'TX', zip: '78701', phone: '+15125550100', country: 'US', isDefault: false, ...over,
});

beforeEach(() => {
  book = [sam({ isDefault: true }), sam({ id: 'a2', street: '9 Oak Ave', city: 'Dallas', zip: '75201' })];
  nextId = 10;
  calls = [];
  signedOut = false;
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => server(path, init)));
});
afterEach(() => vi.unstubAllGlobals());

const fillValid = async (user: ReturnType<typeof userEvent.setup>, over: { state?: string; zip?: string } = {}) => {
  await user.type(screen.getByLabelText(/First name/), 'Alex');
  await user.type(screen.getByLabelText(/Last name/), 'Chen');
  await user.type(screen.getByLabelText(/Street address/), '5 Pine Rd');
  await user.type(screen.getByLabelText(/^City/), 'Denver');
  await user.selectOptions(screen.getByLabelText(/^State/), over.state ?? 'CO');
  await user.type(screen.getByLabelText(/ZIP code/), over.zip ?? '80202');
  await user.type(screen.getByLabelText(/^Phone/), '303 555 0111');
};

describe('address-book: the page', () => {
  it('lists the saved addresses with a Default badge on one card and Make default only on the others', async () => {
    renderWithProviders(<AddressBook />);
    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Default')).toBeInTheDocument();
    expect(within(cards[0]).queryByRole('button', { name: /Make default/ })).not.toBeInTheDocument();
    expect(within(cards[1]).queryByText('Default')).not.toBeInTheDocument();
    expect(within(cards[1]).getByRole('button', { name: /Make default/ })).toBeInTheDocument();
    expect(within(cards[1]).getByRole('button', { name: /^Edit/ })).toBeInTheDocument();
    expect(within(cards[1]).getByRole('button', { name: /^Remove/ })).toBeInTheDocument();
  });

  it('Address added and defaulted: the new address is stored and shown as the default', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressBook />);
    await screen.findAllByRole('article');
    await user.click(screen.getAllByRole('button', { name: 'Add address' })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Add an address' });
    await fillValid(user);
    await user.click(within(dialog).getByLabelText('Use as my default address'));
    await user.click(within(dialog).getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body).toMatchObject({ firstName: 'Alex', state: 'CO', zip: '80202', phone: '+13035550111', makeDefault: true });
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText('Alex Chen')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Default')).toBeInTheDocument();
    expect(screen.getAllByText('Default')).toHaveLength(1);
  });

  it('Make default moves the badge', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressBook />);
    const cards = await screen.findAllByRole('article');
    await user.click(within(cards[1]).getByRole('button', { name: /Make default/ }));
    await waitFor(() => expect(within(screen.getAllByRole('article')[0]).getByText(/Sam Rivera/)).toBeInTheDocument());
    expect(calls.some((c) => c.path.endsWith('/a2/default') && c.method === 'POST')).toBe(true);
    expect(screen.getAllByText('Default')).toHaveLength(1);
    expect(within(screen.getAllByRole('article')[0]).getByText('9 Oak Ave')).toBeInTheDocument();
  });

  it('Default address removed: after a confirmation no other address is promoted and the patient is told to choose later', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressBook />);
    const cards = await screen.findAllByRole('article');
    await user.click(within(cards[0]).getByRole('button', { name: /^Remove/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this address?' });
    expect(within(dialog).getByText(/is your default address/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Remove address' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(screen.queryByText('Default', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.getByText(/no default address/)).toBeInTheDocument();
  });

  it('cancelling the confirmation keeps the address', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressBook />);
    const cards = await screen.findAllByRole('article');
    await user.click(within(cards[1]).getByRole('button', { name: /^Remove/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('Last address removed: the empty state "No addresses yet" with an Add address action', async () => {
    book = [sam({ isDefault: true })];
    const user = userEvent.setup();
    renderWithProviders(<AddressBook />);
    const [card] = await screen.findAllByRole('article');
    await user.click(within(card).getByRole('button', { name: /^Remove/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove address' }));
    expect(await screen.findByText('No addresses yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add address' }).length).toBeGreaterThan(0);
  });

  it('Edit opens the form filled in and saves the change', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressBook />);
    const cards = await screen.findAllByRole('article');
    await user.click(within(cards[1]).getByRole('button', { name: /^Edit/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit address' });
    expect(within(dialog).getByLabelText(/Street address/)).toHaveValue('9 Oak Ave');
    await user.clear(within(dialog).getByLabelText(/^City/));
    await user.type(within(dialog).getByLabelText(/^City/), 'Plano');
    await user.click(within(dialog).getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === 'PATCH')?.path).toBe('/api/account/addresses/a2');
    expect(screen.getByText(/Plano, TX/)).toBeInTheDocument();
  });

  it('an expired session shows the sign-in prompt instead of the list', async () => {
    signedOut = true;
    renderWithProviders(<AddressBook />);
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

describe('address-book: the form', () => {
  const setup = (onSave = vi.fn()) => {
    const onSaved = vi.fn();
    renderWithProviders(<AddressForm onSave={onSave} onCancel={vi.fn()} onSaved={onSaved} />);
    return { onSave, onSaved };
  };

  it('an invalid ZIP "1234" shows an inline error and moves focus to the field; nothing is sent', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();
    await fillValid(user, { zip: '1234' });
    await user.click(screen.getByRole('button', { name: 'Save address' }));
    const zip = screen.getByLabelText(/ZIP code/);
    expect(screen.getByText('Enter a 5-digit ZIP code, or 9 digits with a dash.')).toBeInTheDocument();
    expect(zip).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(zip).toHaveFocus());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('an empty submit shows every required error and focuses the first field', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Save address' }));
    expect(screen.getByText('Enter a first name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a phone number.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/First name/)).toHaveFocus());
  });

  it('is busy while saving (no double submit)', async () => {
    const user = userEvent.setup();
    let finish: (value: { ok: true }) => void = () => undefined;
    const onSave = vi.fn(() => new Promise<{ ok: true }>((resolve) => (finish = resolve)));
    const { onSaved } = setup(onSave);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Save address' }));
    const button = screen.getByRole('button', { name: 'Save address' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    finish({ ok: true });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('Validation cannot resolve the address: the fields and the nearest match are named, nothing is stored until "Save anyway"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressBook />);
    await screen.findAllByRole('article');
    await user.click(screen.getAllByRole('button', { name: 'Add address' })[0]);
    const dialog = await screen.findByRole('dialog');
    await fillValid(user, { state: 'NY', zip: '90210' });
    await user.click(within(dialog).getByRole('button', { name: 'Save address' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('state and ZIP code');
    expect(alert).toHaveTextContent('90210');
    expect(alert).toHaveTextContent('CA');
    expect(book).toHaveLength(2);
    await waitFor(() => expect(alert).toHaveFocus());
    await user.click(within(dialog).getByRole('button', { name: 'Save anyway' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(book).toHaveLength(3);
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.body?.confirmed)).toEqual([false, true]);
  });

  it('a failed save shows a message and keeps the dialog open', async () => {
    const user = userEvent.setup();
    const { onSaved } = setup(vi.fn().mockResolvedValue({ ok: false, reason: 'failed', status: 500 }));
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('We could not save this address. Please try again.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

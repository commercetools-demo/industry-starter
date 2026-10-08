import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountApiError } from '@/hooks/accountRequest';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ requestReturn: vi.fn(), refresh: vi.fn() }));

vi.mock('@/hooks/useOrderActions', () => ({ useOrderActions: () => ({ cancel: vi.fn(), requestReturn: state.requestReturn }) }));
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: state.refresh }) }));

import { ReturnRequestDialog } from './ReturnRequestDialog';

const LINES = [
  { lineItemId: 'd2', name: 'Nova Pro', quantityOrdered: 2, quantityAlreadyRequested: 0, quantityAvailable: 2 },
  { lineItemId: 'd3', name: 'Nova Mini', quantityOrdered: 1, quantityAlreadyRequested: 0, quantityAvailable: 1 },
];
const open = async () => {
  const user = userEvent.setup();
  renderWithProviders(<ReturnRequestDialog orderNumber="MLV-ABC12345" lines={LINES} />);
  await user.click(screen.getByRole('button', { name: 'Return a device' }));
  return { user, dialog: screen.getByRole('dialog', { name: 'Return a device' }) };
};
const submit = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Request return' });

beforeEach(() => {
  vi.clearAllMocks();
  state.requestReturn.mockResolvedValue({});
});

describe('ReturnRequestDialog', () => {
  it('steppers are limited to the available quantity', async () => {
    const { user, dialog } = await open();
    const more = within(dialog).getByRole('button', { name: 'Return one more Nova Pro' });
    await user.click(more);
    await user.click(more);
    expect(more).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Return one more Nova Mini' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Return one fewer Nova Mini' })).toBeDisabled();
    expect(within(dialog).getByText('2 of 2')).toBeInTheDocument();
  });

  it('submit is disabled with all quantities at zero and without a reason', async () => {
    const { user, dialog } = await open();
    expect(submit(dialog)).toBeDisabled();
    await user.selectOptions(within(dialog).getByRole('combobox'), 'Wrong item');
    expect(submit(dialog)).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Return one more Nova Pro' }));
    expect(submit(dialog)).toBeEnabled();
  });

  it('Other needs a note', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Return one more Nova Pro' }));
    await user.selectOptions(within(dialog).getByRole('combobox'), 'Other');
    expect(submit(dialog)).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Tell us more (required)' }), 'arrived late');
    expect(submit(dialog)).toBeEnabled();
  });

  it('sends only the lines with a quantity, then closes, confirms and refreshes the page', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Return one more Nova Pro' }));
    await user.selectOptions(within(dialog).getByRole('combobox'), "It's faulty");
    await user.type(within(dialog).getByRole('textbox'), ' cracked ');
    await user.click(submit(dialog));
    await waitFor(() => expect(screen.getByText('Return requested.')).toBeInTheDocument());
    expect(state.requestReturn).toHaveBeenCalledTimes(1);
    expect(state.requestReturn).toHaveBeenCalledWith('MLV-ABC12345', { items: [{ lineItemId: 'd2', quantity: 1 }], reason: 'defective', note: 'cracked' });
    expect(state.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a request that already exists says so and keeps the dialog open', async () => {
    state.requestReturn.mockRejectedValue(new AccountApiError('QUANTITY_TOO_HIGH', 'x', 400));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Return one more Nova Pro' }));
    await user.selectOptions(within(dialog).getByRole('combobox'), 'Wrong item');
    await user.click(submit(dialog));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A return request already exists for these units. Reload the page to see it.');
    expect(state.refresh).not.toHaveBeenCalled();
  });

  it('an unexpected failure offers another try', async () => {
    state.requestReturn.mockRejectedValue(new AccountApiError('NETWORK', 'down', 0));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Return one more Nova Pro' }));
    await user.selectOptions(within(dialog).getByRole('combobox'), 'Wrong item');
    await user.click(submit(dialog));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("We couldn't record your return request. Try again.");
    expect(submit(dialog)).toBeEnabled();
  });
});

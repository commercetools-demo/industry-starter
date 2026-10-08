import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountApiError } from '@/hooks/accountRequest';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ cancel: vi.fn(), refresh: vi.fn() }));

vi.mock('@/hooks/useOrderActions', () => ({ useOrderActions: () => ({ cancel: state.cancel, requestReturn: vi.fn() }) }));
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: state.refresh }) }));

import { CancelOrderDialog } from './CancelOrderDialog';

const ROWS = [{ lineId: 'a1', name: 'Cable 500', fee: '$10 x months remaining' }];
const open = async (rows = ROWS) => {
  const user = userEvent.setup();
  renderWithProviders(<CancelOrderDialog orderNumber="MLV-ABC12345" etfRows={rows} />);
  await user.click(screen.getByRole('button', { name: 'Cancel order' }));
  return { user, dialog: screen.getByRole('dialog', { name: 'Cancel order MLV-ABC12345?' }) };
};
const confirm = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Cancel order' });

beforeEach(() => {
  vi.clearAllMocks();
  state.cancel.mockResolvedValue({ orderState: 'Cancelled' });
});

describe('CancelOrderDialog', () => {
  it('the confirm button is disabled until a reason is chosen', async () => {
    const { user, dialog } = await open();
    expect(confirm(dialog)).toBeDisabled();
    expect(within(dialog).getAllByRole('radio')).toHaveLength(5);
    await user.click(within(dialog).getByRole('radio', { name: "I'm moving" }));
    expect(confirm(dialog)).toBeEnabled();
  });

  it('Other needs a note and the note is limited to 280 characters', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('radio', { name: 'Other' }));
    expect(confirm(dialog)).toBeDisabled();
    const note = within(dialog).getByRole('textbox', { name: 'Tell us more (required)' });
    await user.click(note);
    await user.paste('x'.repeat(281));
    expect(within(dialog).getByText('281 of 280 characters')).toHaveClass('text-danger');
    expect(confirm(dialog)).toBeDisabled();
    await user.clear(note);
    await user.type(note, 'moving abroad');
    expect(confirm(dialog)).toBeEnabled();
  });

  it('shows the early-termination fee text from the label snapshot', async () => {
    const { dialog } = await open();
    expect(within(dialog).getByRole('heading', { name: 'Early-termination fee' })).toBeInTheDocument();
    expect(within(dialog).getByText('Cable 500: $10 x months remaining')).toBeInTheDocument();
    expect(within(dialog).getByText('You are cancelling before your service starts, so no early-termination fee is charged.')).toBeInTheDocument();
  });

  it('submits once with the reason and trimmed note, then closes, confirms and refreshes the page', async () => {
    let finish: (value: unknown) => void = () => undefined;
    state.cancel.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('radio', { name: 'Other' }));
    await user.type(within(dialog).getByRole('textbox'), '  moving abroad ');
    await user.click(confirm(dialog));
    expect(confirm(dialog)).toBeDisabled();
    expect(confirm(dialog)).toHaveAttribute('aria-busy', 'true');
    await user.click(confirm(dialog));
    finish({});
    await waitFor(() => expect(screen.getByText('Order cancelled.')).toBeInTheDocument());
    expect(state.cancel).toHaveBeenCalledTimes(1);
    expect(state.cancel).toHaveBeenCalledWith('MLV-ABC12345', { reason: 'other', note: 'moving abroad' });
    expect(state.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a failed request keeps the dialog open, says so and re-enables the button', async () => {
    state.cancel.mockRejectedValue(new AccountApiError('NETWORK', 'down', 0));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('radio', { name: 'I changed my mind' }));
    await user.click(confirm(dialog));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("We couldn't cancel your order. Try again.");
    expect(confirm(dialog)).toBeEnabled();
    expect(state.refresh).not.toHaveBeenCalled();
  });

  it('a refusal shows the reason it gives and offers Close only', async () => {
    state.cancel.mockRejectedValue(new AccountApiError('NOT_CANCELLABLE', 'no', 409, { block: 'SERVICE_STARTED' }));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('radio', { name: "I'm moving" }));
    await user.click(confirm(dialog));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Your service has started, so this order can't be cancelled online.");
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Keep my order' })).not.toBeInTheDocument();
  });

  it('Keep my order closes the dialog without a request', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Keep my order' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state.cancel).not.toHaveBeenCalled();
  });
});

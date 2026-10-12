import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { ViewerProvider } from '@/context/ViewerContext';
import type { CampaignView } from '@/hooks/marketingApi';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { CampaignCard } from './CampaignCard';
import { MarketingPage } from './MarketingPage';

const api = vi.hoisted(() => ({ createDiscount: vi.fn(), claim: vi.fn(), campaigns: { current: [] as unknown[] } }));
vi.mock('@/hooks/marketingApi', () => ({
  useCampaigns: () => ({ data: { campaigns: api.campaigns.current }, error: undefined, mutate: vi.fn() }),
  campaignApi: { createDiscount: (...a: unknown[]) => api.createDiscount(...a), claim: (...a: unknown[]) => api.claim(...a) },
}));

const viewer = (role: 'admin' | 'buyer' = 'admin'): Viewer => ({
  customerId: 'c1', name: 'N T', email: 'n@example.com', roles: [role], ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Garage Nord', storeKey: 'store-a', storeName: 'DACH Online',
});

const campaign = (over: Partial<CampaignView> = {}): CampaignView => ({
  key: 'brake-week',
  name: { 'de-DE': 'Bremsenwoche', 'en-US': 'Brake week' },
  fundingShare: 0.5,
  caption: { 'de-DE': 'Jetzt sparen mit BRAKE8.', 'en-US': 'Save now with BRAKE8.' },
  code: 'BRAKE8',
  channels: ['E-mail', 'Social'],
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-12-31T23:59:59.000Z',
  eligibleSkus: [],
  permyriad: 800,
  ended: false,
  eligible: [1, 2, 3, 4, 5].map((n) => ({ sku: `SKU-${n}`, name: { 'en-US': `Part ${n}` } })),
  eligibleMore: 3,
  claim: { status: 'none' },
  discount: null,
  ...over,
});

function screenOf(ui: ReactNode, role: 'admin' | 'buyer' = 'admin') {
  return renderWithProviders(
    <ViewerProvider viewer={viewer(role)}>
      <ToastProvider>{ui}</ToastProvider>
    </ViewerProvider>,
    { locale: 'en-US', messages: en },
  );
}

beforeEach(() => {
  api.createDiscount.mockReset();
  api.claim.mockReset();
  api.campaigns.current = [];
});

describe('CampaignCard', () => {
  it('shows funding, the store suffixed code, channels and the first five products with "+n more"', () => {
    screenOf(<CampaignCard campaign={campaign()} storeKey="store-a" onChanged={vi.fn()} />);
    expect(screen.getByText('Malva funds 50% of ad spend')).toBeInTheDocument();
    expect(screen.getByTestId('code')).toHaveTextContent('BRAKE8-STORE-A');
    expect(screen.getByText('E-mail, Social')).toBeInTheDocument();
    expect(screen.getByText(/Part 5 \(SKU-5\)/)).toBeInTheDocument();
    expect(screen.getByText(/\+3 more/)).toBeInTheDocument();
  });

  it('the caption row reads "Brand-funded, can\'t be edited" and has no edit control', () => {
    screenOf(<CampaignCard campaign={campaign()} storeKey="store-a" onChanged={vi.fn()} />);
    expect(screen.getByTestId('caption')).toHaveTextContent('Save now with BRAKE8.');
    expect(screen.getByText("Brand-funded, can't be edited")).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.getByTestId('caption').closest('section')?.querySelector('input, textarea, [contenteditable]')).toBeNull();
  });

  it('an ended campaign shows the Ended chip and Create discount is disabled', () => {
    screenOf(<CampaignCard campaign={campaign({ ended: true })} storeKey="store-a" onChanged={vi.fn()} />);
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create discount' })).toBeDisabled();
  });

  it('Copy caption writes the localized caption to the clipboard and shows a text status', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    screenOf(<CampaignCard campaign={campaign()} storeKey="store-a" onChanged={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Copy caption' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Save now with BRAKE8.'));
    expect(await screen.findByText('Caption copied')).toBeInTheDocument();
  });

  it('Create discount calls the api with the session store key, then offers a link to the discount', async () => {
    api.createDiscount.mockResolvedValue({ ok: true, status: 201, data: { id: 'd1', key: 'coop', code: 'BRAKE8-STORE-A', isActive: false } });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    screenOf(<CampaignCard campaign={campaign()} storeKey="store-a" onChanged={onChanged} />);
    await user.click(screen.getByRole('button', { name: 'Create discount' }));
    expect(api.createDiscount).toHaveBeenCalledWith('store-a', 'brake-week');
    expect(await screen.findByText(/Draft discount BRAKE8-STORE-A created/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open discount' })).toHaveAttribute('href', expect.stringContaining('/catalog/cart-discounts'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('an existing discount shows Open discount instead of Create discount', () => {
    screenOf(<CampaignCard campaign={campaign({ discount: { id: 'd1', key: 'k', isActive: false, code: 'BRAKE8-STORE-A' } })} storeKey="store-a" onChanged={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Create discount' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open discount' })).toBeInTheDocument();
    expect(screen.getByText('Discount BRAKE8-STORE-A: inactive')).toBeInTheDocument();
  });

  it('maps server codes to messages', async () => {
    api.createDiscount.mockResolvedValue({ ok: false, status: 409, code: 'CODE_TAKEN' });
    const user = userEvent.setup();
    screenOf(<CampaignCard campaign={campaign()} storeKey="store-a" onChanged={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Create discount' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This code is already in use.');
  });

  it('a buyer cannot create a discount or a claim', () => {
    screenOf(<CampaignCard campaign={campaign()} storeKey="store-a" canEdit={false} onChanged={vi.fn()} />, 'buyer');
    expect(screen.getByRole('button', { name: 'Create discount' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit claim' })).toBeDisabled();
  });

  describe('claim form', () => {
    async function open() {
      const user = userEvent.setup();
      screenOf(<CampaignCard campaign={campaign()} storeKey="store-a" onChanged={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Submit claim' }));
      return { user, dialog: await screen.findByRole('dialog') };
    }

    it('refuses a bad amount, a missing or long reference and a long note without calling the api', async () => {
      const { user, dialog } = await open();
      const send = within(dialog).getByRole('button', { name: 'Send claim' });
      await user.click(send);
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter an amount above zero');
      await user.type(within(dialog).getByLabelText('Amount spent (EUR)'), '120,50');
      await user.click(send);
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter an amount above zero');
      await user.clear(within(dialog).getByLabelText('Amount spent (EUR)'));
      await user.type(within(dialog).getByLabelText('Amount spent (EUR)'), '120.50');
      await user.click(send);
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter the invoice reference.');
      await user.type(within(dialog).getByLabelText('Invoice reference'), 'x'.repeat(81));
      await user.click(send);
      expect(within(dialog).getByRole('alert')).toHaveTextContent('at most 80');
      expect(api.claim).not.toHaveBeenCalled();
    });

    it('sends cents, reference and note with the session store key and confirms', async () => {
      api.claim.mockResolvedValue({ ok: true, status: 201, data: { status: 'submitted' } });
      const { user, dialog } = await open();
      await user.type(within(dialog).getByLabelText('Amount spent (EUR)'), '120.50');
      await user.type(within(dialog).getByLabelText('Invoice reference'), 'INV-1');
      await user.type(within(dialog).getByLabelText('Note'), 'Flyers');
      await user.click(within(dialog).getByRole('button', { name: 'Send claim' }));
      await waitFor(() => expect(api.claim).toHaveBeenCalledWith('store-a', 'brake-week', { amountCents: 12050, invoiceReference: 'INV-1', note: 'Flyers' }));
      expect(await screen.findByText('Claim submitted. Malva reviews it.')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Submit claim' })).toBeDisabled();
    });
  });
});

describe('MarketingPage', () => {
  it('renders the cards and has no accessibility violations', async () => {
    api.campaigns.current = [campaign(), campaign({ key: 'summer', ended: true, name: { 'de-DE': 'Sommer', 'en-US': 'Summer' } })];
    const { container } = screenOf(<MarketingPage />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(await axe(container)).toHaveNoViolations();
  });
});

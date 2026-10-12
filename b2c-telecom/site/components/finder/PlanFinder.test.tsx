import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OfferDetail, OfferItem } from '@/lib/offers-api/views';
import { makeCart } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';
import { PlanFinder } from './PlanFinder';

const push = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ push }),
}));

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const item = (key: string, patch: Partial<OfferItem> = {}): OfferItem => ({
  key,
  sku: `MLV-${key.slice(12).toUpperCase()}`,
  name: key.slice(12),
  kind: 'base-package',
  family: 'cable',
  equipmentKind: null,
  description: '',
  price: { recurring: usd(5999) },
  chargeKind: 'recurring',
  firstMonthFree: false,
  termMonths: 24,
  includedOffers: [],
  needsLocation: false,
  ...patch,
});

const plans = [item('malva-offer-cable-100', { name: 'Cable 100', price: { recurring: usd(3999) } }), item('malva-offer-cable-500', { name: 'Cable 500', firstMonthFree: true }), item('malva-offer-phone-basic', { name: 'Phone Basic', family: 'phone' })];
const addon = item('malva-offer-netflix', { name: 'Netflix', kind: 'addon', family: null, price: { recurring: usd(999) } });
const router1 = item('malva-offer-ax3000', { name: 'AX3000', kind: 'equipment', family: null, equipmentKind: 'router', price: { recurring: usd(1000) } });
const router2 = item('malva-offer-ac1200', { name: 'AC1200', kind: 'equipment', family: null, equipmentKind: 'router', price: { recurring: usd(500) } });
const modem = item('malva-offer-modem', { name: 'Modem', kind: 'equipment', family: null, equipmentKind: 'modem' });

const detailOf = (plan: OfferItem, patch: Partial<OfferDetail> = {}): OfferDetail => ({
  offer: plan,
  included: [{ offer: modem, verdict: { status: 'included', reasons: [] } }],
  compatibleAddons: [{ offer: addon, verdict: { status: 'allowed', reasons: [] } }],
  compatibleEquipment: [
    { offer: router1, verdict: { status: 'allowed', reasons: [] } },
    { offer: router2, verdict: { status: 'allowed', reasons: [] } },
  ],
  ...patch,
});

const context = { customerType: 'consumer', existingCustomer: 'unspecified', fromAccount: false, location: null };
const preview = (dueToday: number, thenMonthly: number) => ({ dueToday: usd(dueToday), thenMonthly: usd(thenMonthly), summary: {}, lines: [], promotions: [], issues: [], replaced: [] });
const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

interface World {
  detail?: (key: string) => Promise<Response>;
  preview?: (body: { planKey: string; extras: { offerKey: string }[] }) => Promise<Response>;
  cart?: Parameters<typeof makeCart>[0];
}

function stub(world: World = {}) {
  const writes: { url: string; body: Record<string, unknown> }[] = [];
  const previews: { planKey: string; extras: { offerKey: string }[] }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (url === '/api/buyer-context') return reply(200, { context });
      if (url.startsWith('/api/offers?')) return reply(200, { offers: plans, total: plans.length });
      if (url.startsWith('/api/offers/')) {
        const key = decodeURIComponent(url.slice('/api/offers/'.length));
        return world.detail ? world.detail(key) : reply(200, detailOf(plans.find((plan) => plan.key === key) ?? plans[0]!));
      }
      if (url === '/api/pricing/preview') {
        previews.push(body as { planKey: string; extras: { offerKey: string }[] });
        return world.preview ? world.preview(body as { planKey: string; extras: { offerKey: string }[] }) : reply(200, preview(1000 + 100 * ((body.extras as unknown[]).length), 5999 + 100 * ((body.extras as unknown[]).length)));
      }
      if (url === '/api/cart' && !init?.method) return reply(200, { cart: world.cart ? makeCart(world.cart) : null });
      writes.push({ url, body });
      return reply(200, { cart: makeCart({ lines: [] }) });
    }),
  );
  return { writes, previews };
}

beforeEach(() => push.mockReset());
afterEach(() => vi.unstubAllGlobals());

const renderCable = () => renderWithProviders(<PlanFinder initialPlanKey="malva-offer-cable-100" />);

describe('PlanFinder', () => {
  it('opens on the first family with plans, selects the first plan, shows the three sections and creates no cart line', async () => {
    const { writes } = stub();
    renderWithProviders(<PlanFinder />);
    expect(await screen.findByRole('heading', { name: 'Phone Basic' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Phone Basic/ })).toBeChecked();
    expect(await screen.findByRole('heading', { name: 'Included' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Compatible add-ons' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Compatible equipment' })).toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it('?plan= restores the plan and its family', async () => {
    stub();
    renderWithProviders(<PlanFinder initialPlanKey="malva-offer-phone-basic" />);
    expect(await screen.findByRole('heading', { name: 'Phone Basic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phone plans/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('plan card shows the first-month message; each empty section keeps its own text', async () => {
    stub({ detail: (key) => reply(200, detailOf(plans.find((plan) => plan.key === key)!, { included: [], compatibleEquipment: [] })) });
    renderCable();
    expect(await screen.findByText('First month free, then $59.99/mo')).toBeInTheDocument();
    expect(await screen.findByText('Nothing extra is included with this plan.')).toBeInTheDocument();
    expect(screen.getByText('No compatible equipment is available for this plan.')).toBeInTheDocument();
  });

  it('a refused item is shown disabled with its reason', async () => {
    const reason = { code: 'SPEED_TOO_LOW' as const, message: 'Supports up to 300 Mbps; Cable 100 delivers 500 Mbps.' };
    stub({ detail: (key) => reply(200, detailOf(plans.find((plan) => plan.key === key)!, { compatibleEquipment: [{ offer: router2, verdict: { status: 'unavailable', reasons: [reason] } }] })) });
    renderCable();
    expect(await screen.findByText(reason.message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AC1200 is unavailable for this plan' })).toBeDisabled();
  });

  it('adding to the draft sends no cart request, counts it, and re-requests the preview with the extra', async () => {
    const user = userEvent.setup();
    const { writes, previews } = stub();
    renderCable();
    await user.click(await screen.findByRole('button', { name: 'Add Netflix to your plan' }));
    expect(screen.getByText('1 extra added')).toBeInTheDocument();
    await waitFor(() => expect(previews.some((body) => body.extras.some((extra) => extra.offerKey === 'malva-offer-netflix'))).toBe(true));
    expect(writes).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Remove Netflix from your plan' }));
    expect(screen.getByText('No extras added')).toBeInTheDocument();
  });

  it('a second router replaces the first', async () => {
    const user = userEvent.setup();
    stub();
    renderCable();
    await user.click(await screen.findByRole('button', { name: 'Add AX3000 to your plan' }));
    await user.click(screen.getByRole('button', { name: 'Add AC1200 to your plan' }));
    expect(screen.getByText('1 extra added')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add AX3000 to your plan' })).toBeInTheDocument();
  });

  it('choosing another plan clears the draft and says so once', async () => {
    const user = userEvent.setup();
    stub();
    renderCable();
    await user.click(await screen.findByRole('button', { name: 'Add Netflix to your plan' }));
    await user.click(screen.getByRole('radio', { name: /Cable 500/ }));
    expect(await screen.findByText('Your extras were cleared because they were chosen for another plan.')).toBeInTheDocument();
    expect(screen.getByText('No extras added')).toBeInTheDocument();
  });

  it('price strip: loading, then the engine figures; a failed preview says "Price unavailable" and Continue stays', async () => {
    stub({ preview: () => reply(502, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'x' } }) });
    renderCable();
    expect(await screen.findByText('Price unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Cable 100' })).toBeEnabled();
  });

  it('price strip shows Due today and Then monthly', async () => {
    stub();
    renderCable();
    const strip = await screen.findByRole('region', { name: 'Your price' });
    await waitFor(() => expect(within(strip).getByText('$10')).toBeInTheDocument());
    expect(within(strip).getByText('$59.99')).toBeInTheDocument();
  });

  it('a detail failure shows a retry in place of the sections and keeps the list usable', async () => {
    const user = userEvent.setup();
    stub({ detail: (key) => (key === 'malva-offer-cable-100' ? reply(502, {}) : reply(200, detailOf(plans.find((plan) => plan.key === key)!))) });
    renderCable();
    expect(await screen.findByText("We couldn't load this plan's details.")).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Included' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Cable 500/ }));
    expect(await screen.findByRole('heading', { name: 'Included' })).toBeInTheDocument();
  });

  it('Continue adds the plan then each extra to the plan line and opens /bundle', async () => {
    const user = userEvent.setup();
    const { writes } = stub();
    vi.mocked(fetch).mockImplementation(((url: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (url === '/api/buyer-context') return reply(200, { context });
      if (url.startsWith('/api/offers?')) return reply(200, { offers: plans, total: 3 });
      if (url.startsWith('/api/offers/')) return reply(200, detailOf(plans[0]!));
      if (url === '/api/pricing/preview') return reply(200, preview(1000, 3999));
      if (url === '/api/cart' && !init?.method) return reply(200, { cart: null });
      writes.push({ url, body });
      const lines = writes.map((write, index) => ({ id: `l${index}`, offerKey: write.body.offerKey, kind: write.body.parentLineId ? 'addon' : 'plan', parentLineId: write.body.parentLineId }));
      return reply(200, { cart: { ...makeCart({ lines: [] }), lines } });
    }) as typeof fetch);
    renderCable();
    await user.click(await screen.findByRole('button', { name: 'Add Netflix to your plan' }));
    await user.click(screen.getByRole('button', { name: 'Continue with Cable 100' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/bundle'));
    expect(writes.map((write) => [write.body.offerKey, write.body.parentLineId ?? null])).toEqual([
      ['malva-offer-cable-100', null],
      ['malva-offer-netflix', 'l0'],
    ]);
  });

  it('no eligible plan: the message replaces the details', async () => {
    stub();
    vi.mocked(fetch).mockImplementation(((url: string) => (url === '/api/buyer-context' ? reply(200, { context }) : url.startsWith('/api/offers?') ? reply(200, { offers: [], total: 0 }) : reply(200, { cart: null }))) as typeof fetch);
    renderCable();
    expect(await screen.findByText('No plans are available for the current selection.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Continue/ })).not.toBeInTheDocument();
  });

  it('plans are a radio group: arrow keys move the selection and the detail follows', async () => {
    const user = userEvent.setup();
    stub();
    renderCable();
    await user.click(await screen.findByRole('radio', { name: /Cable 100/ }));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: /Cable 500/ })).toBeChecked();
    expect(await screen.findByRole('heading', { name: 'Cable 500' })).toBeInTheDocument();
  });

  it('signed-in buyer: type and existing status are read-only and labelled "From your account"', async () => {
    stub();
    vi.mocked(fetch).mockImplementation(((url: string) =>
      url === '/api/buyer-context'
        ? reply(200, { context: { ...context, customerType: 'small-business', existingCustomer: 'yes', fromAccount: true } })
        : url.startsWith('/api/offers?')
          ? reply(200, { offers: plans, total: 3 })
          : url.startsWith('/api/offers/')
            ? reply(200, detailOf(plans[0]!))
            : url === '/api/pricing/preview'
              ? reply(200, preview(0, 0))
              : reply(200, { cart: null })) as typeof fetch);
    renderCable();
    expect(await screen.findByLabelText('Customer type')).toBeDisabled();
    expect(screen.getByLabelText('Existing customer')).toBeDisabled();
    expect(screen.getAllByText('From your account')).toHaveLength(2);
    expect(screen.getByLabelText('ZIP code')).toBeEnabled();
  });

  it('an invalid ZIP shows the message and keeps the stored location', async () => {
    const user = userEvent.setup();
    stub();
    const base = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(((url: string, init?: RequestInit) => (url === '/api/serviceability' ? reply(400, { error: { code: 'INVALID_POSTAL_CODE', message: 'Enter a valid ZIP code' } }) : base(url, init))) as typeof fetch);
    renderCable();
    await user.type(await screen.findByLabelText('ZIP code'), '12');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('Enter a valid ZIP code.')).toBeInTheDocument();
  });

  it('a ZIP that no technology serves says so', async () => {
    stub();
    const base = vi.mocked(fetch).getMockImplementation()!;
    const location = { postalCode: '99999', country: 'US', served: { cable: false, 'fixed-wireless': false, mobile: false }, anyServed: false, checkedAt: '' };
    vi.mocked(fetch).mockImplementation(((url: string, init?: RequestInit) => (url === '/api/buyer-context' ? reply(200, { context: { ...context, location } }) : base(url, init))) as typeof fetch);
    renderCable();
    expect(await screen.findByText("We don't serve 99999 yet.")).toBeInTheDocument();
  });
});

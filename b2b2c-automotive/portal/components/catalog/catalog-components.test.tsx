import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssortmentTable } from '@/components/catalog/AssortmentTable';
import { PriorityLists } from '@/components/discounts/PriorityLists';
import { PricesTable } from '@/components/pricing/PricesTable';
import { ImagePanel } from '@/components/tailoring/ImagePanel';
import { ProductInfoPanel } from '@/components/tailoring/ProductInfoPanel';
import { ToastProvider } from '@/context/ToastContext';
import { ViewerProvider } from '@/context/ViewerContext';
import type { ImageRef, DiscountView, TailoringDetail } from '@/lib/catalog/types';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

// The screens only talk to the network through these hooks, so the tests replace them with a small in-memory state.
const state = vi.hoisted(() => ({
  assortment: { rows: [], total: 0, assigned: 0, totalMaster: 0 } as Record<string, unknown>,
  prices: { rows: [], total: 0, currency: 'EUR', currencies: ['EUR'] } as Record<string, unknown>,
  discounts: { product: [] as unknown[], cart: [] as unknown[] },
  tailoringList: { rows: [] as unknown[], total: 0 },
  tailoringDetail: null as unknown,
  withdraw: vi.fn(),
  publish: vi.fn(),
  reorder: vi.fn(),
  save: vi.fn(),
  checkUrl: vi.fn(),
  refresh: vi.fn(async () => undefined),
}));

vi.mock('@/hooks/catalogApi', () => ({
  useAssortment: () => ({ data: state.assortment, isLoading: false, error: undefined }),
  useCategories: () => ({ data: [] }),
  useRefreshCatalog: () => state.refresh,
  usePrices: () => ({ data: state.prices, isLoading: false, error: undefined }),
  useDiscounts: (_s: string, kind: 'product' | 'cart') => ({ data: state.discounts[kind] }),
  useTailoringList: () => ({ data: state.tailoringList, error: undefined }),
  useTailoringDetail: (_s: string, id: string | null) => ({ data: id ? state.tailoringDetail : undefined }),
  assortmentApi: { assign: vi.fn(), withdraw: (...a: unknown[]) => state.withdraw(...a) },
  pricesApi: { publish: (...a: unknown[]) => state.publish(...a) },
  discountApi: { reorder: (...a: unknown[]) => state.reorder(...a) },
  tailoringApi: { save: (...a: unknown[]) => state.save(...a), reset: vi.fn(), checkUrl: (...a: unknown[]) => state.checkUrl(...a), upload: vi.fn() },
}));

const viewer = (role: 'admin' | 'buyer'): Viewer => ({
  customerId: 'c1', name: 'N T', email: 'n@example.com', roles: [role], ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Garage Nord', storeKey: 'store-a', storeName: 'DACH Online',
});

function screenOf(ui: ReactNode, role: 'admin' | 'buyer' = 'admin') {
  return renderWithProviders(
    <ViewerProvider viewer={viewer(role)}>
      <ToastProvider>{ui}</ToastProvider>
    </ViewerProvider>,
    { locale: 'en-US', messages: en },
  );
}

const INSUFFICIENT = 'Insufficient permissions to perform this task';

beforeEach(() => {
  state.withdraw.mockReset();
  state.publish.mockReset();
  state.reorder.mockReset();
  state.save.mockReset();
  state.checkUrl.mockReset();
  state.refresh.mockClear();
  state.discounts = { product: [], cart: [] };
  state.tailoringList = { rows: [], total: 0 };
  state.tailoringDetail = null;
});

const row = (over: Record<string, unknown> = {}) => ({
  productId: 'p1', sku: 'SKU-1', name: { 'en-US': 'Brake pad' }, state: 'inherited', listPrice: { centAmount: 5000, currencyCode: 'EUR' }, reason: '', ...over,
});

describe('AssortmentTable', () => {
  beforeEach(() => {
    state.assortment = { rows: [row()], total: 1, assigned: 1, totalMaster: 4 };
  });

  it('a buyer sees disabled actions and the insufficient permissions message', () => {
    screenOf(<AssortmentTable />, 'buyer');
    expect(screen.getByRole('note')).toHaveTextContent(INSUFFICIENT);
    expect(screen.getByRole('button', { name: 'Withdraw here' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Brake pad/ })).toBeDisabled();
  });

  it('the withdraw dialog names the count and the open carts, and confirming sends the count back', async () => {
    state.withdraw
      .mockResolvedValueOnce({ ok: false, status: 409, code: 'CONFIRMATION_REQUIRED', details: { count: 1, openCartCount: 3, branches: 2 } })
      .mockResolvedValueOnce({ ok: true, status: 200, data: { removed: 1 } });
    const user = userEvent.setup();
    screenOf(<AssortmentTable />);
    await user.click(screen.getByRole('button', { name: 'Withdraw here' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Withdraw 1 product')).toBeInTheDocument();
    expect(within(dialog).getByTestId('open-carts')).toHaveTextContent('3 open carts are affected.');
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(state.withdraw).toHaveBeenCalledTimes(2));
    expect(state.withdraw.mock.calls[1][2]).toEqual({ confirm: true, expectedCount: 1 });
  });
});

describe('PricesTable', () => {
  beforeEach(() => {
    state.prices = { rows: [{ sku: 'SKU-1', productId: 'p1', name: { 'en-US': 'Brake pad' }, listCent: 5000, overrideCent: null, belowListPercent: null, own: false }], total: 1, currency: 'EUR', currencies: ['EUR'] };
  });

  it('a zero price shows the message and nothing can be published', async () => {
    const user = userEvent.setup();
    screenOf(<PricesTable />);
    await user.type(screen.getByRole('textbox', { name: 'Your price for Brake pad' }), '0');
    expect(screen.getAllByText('Enter a price above zero with at most two decimals').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Publish/ })).toBeDisabled();
  });

  it('a buyer cannot type a price', () => {
    screenOf(<PricesTable />, 'buyer');
    expect(screen.getByRole('textbox', { name: 'Your price for Brake pad' })).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent(INSUFFICIENT);
  });
});

describe('PriorityLists', () => {
  const view = (id: string, funded: 'malva' | 'store', over: Partial<DiscountView> = {}): DiscountView => ({
    id, version: 1, key: id, kind: 'product', name: { 'en-US': id }, scope: { kind: 'all' }, effect: { kind: 'relative', percent: 10 }, isActive: true, sortOrder: '0.5', funded, rank: funded === 'store' ? 1 : null, draft: false, ...over,
  });

  beforeEach(() => {
    state.discounts = { product: [view('Malva spring', 'malva'), view('Mine A', 'store'), view('Mine B', 'store', { rank: 2 })], cart: [] };
  });

  it('Malva rows are locked and have no move buttons; the layers sentence is shown', () => {
    screenOf(<PriorityLists />);
    expect(screen.getByTestId('layers')).toHaveTextContent('Malva price → your override → product discounts → cart discounts');
    const locked = screen.getByTestId('locked-row');
    expect(within(locked).queryByRole('button')).toBeNull();
    expect(within(locked).getByText('Locked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move Mine A up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Mine B down' })).toBeDisabled();
  });

  it('moving a row and saving sends the new order of the own discounts only', async () => {
    state.reorder.mockResolvedValue({ ok: true, status: 200 });
    const user = userEvent.setup();
    screenOf(<PriorityLists />);
    await user.click(screen.getByRole('button', { name: 'Move Mine B up' }));
    await user.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(state.reorder).toHaveBeenCalledWith('store-a', 'product', ['Mine B', 'Mine A']));
  });

  it('a buyer cannot move or save', () => {
    screenOf(<PriorityLists />, 'buyer');
    expect(screen.getByRole('button', { name: 'Move Mine B up' })).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent(INSUFFICIENT);
  });
});

const img = (n: number): ImageRef => ({ url: `https://img.example.test/${n}.png`, width: 800, height: 800 });

function ImageHarness({ initial, canEdit = true, onValue }: { initial: ImageRef[]; canEdit?: boolean; onValue: (v: ImageRef[]) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <ImagePanel
      storeKey="store-a"
      productId="p1"
      master={[]}
      value={value}
      canEdit={canEdit}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

describe('ImagePanel', () => {
  it('adds by address, reorders and removes, changing the saved array each time', async () => {
    state.checkUrl.mockResolvedValue({ ok: true, status: 200, data: { url: 'https://img.example.test/3.png', width: 900, height: 900 } });
    const seen: ImageRef[][] = [];
    const user = userEvent.setup();
    screenOf(<ImageHarness initial={[img(1), img(2)]} onValue={(v) => seen.push(v)} />);
    await user.type(screen.getByLabelText('Add by address'), 'https://img.example.test/3.png');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(seen.at(-1)?.map((i) => i.url)).toEqual([img(1).url, img(2).url, 'https://img.example.test/3.png']));
    await user.click(screen.getByRole('button', { name: 'Move image 2 up' }));
    expect(seen.at(-1)?.map((i) => i.url)[0]).toBe(img(2).url);
    await user.click(screen.getByRole('button', { name: 'Remove image 1' }));
    expect(seen.at(-1)).toHaveLength(2);
    expect(state.checkUrl).toHaveBeenCalledWith('store-a', 'p1', 'https://img.example.test/3.png');
  });

  it('a buyer gets read-only images and the insufficient permissions note', () => {
    screenOf(<ImageHarness initial={[img(1)]} canEdit={false} onValue={() => undefined} />, 'buyer');
    expect(screen.getByRole('button', { name: 'Remove image 1' })).toBeDisabled();
    expect(screen.queryByLabelText('Add by address')).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent(INSUFFICIENT);
  });
});

describe('ProductInfoPanel', () => {
  const detail = (): TailoringDetail => ({
    productId: 'p1', sku: 'SKU-1', languages: ['de-DE', 'en-US'],
    master: { name: { 'de-DE': 'Bremsbelag', 'en-US': 'Brake pad' }, description: { 'de-DE': 'Master', 'en-US': 'Master' }, images: [] },
    tailored: { name: { 'de-DE': 'Bremsbelag', 'en-US': 'Brake pad' }, description: { 'de-DE': 'Master', 'en-US': 'Master' }, images: [] },
    tailoredLocales: [],
  });

  beforeEach(() => {
    state.tailoringList = { rows: [{ productId: 'p1', sku: 'SKU-1', name: { 'en-US': 'Brake pad' }, tailored: false, hasTailoredImages: false }], total: 1 };
    state.tailoringDetail = detail();
  });

  it('shows the master-record note before and after a part is picked', async () => {
    const user = userEvent.setup();
    screenOf(<ProductInfoPanel />);
    expect(screen.getByText(en.catalog.productInfo.masterNote)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Brake pad/ }));
    expect(await screen.findByTestId('master-note')).toHaveTextContent(en.catalog.productInfo.masterNote);
  });

  it('saving publishes at once and says shoppers see it within a minute', async () => {
    state.save.mockResolvedValue({ ok: true, status: 200 });
    const user = userEvent.setup();
    screenOf(<ProductInfoPanel />);
    await user.click(screen.getByRole('button', { name: /Brake pad/ }));
    await user.click(await screen.findByRole('button', { name: 'Save and publish' }));
    expect(await screen.findByTestId('tailoring-message')).toHaveTextContent('Published. Shoppers see it within a minute.');
    expect(state.save).toHaveBeenCalledWith('store-a', 'p1', { name: {}, description: {}, images: [] });
    await act(async () => undefined);
  });

  it('a buyer sees disabled fields and Save', async () => {
    const user = userEvent.setup();
    screenOf(<ProductInfoPanel />, 'buyer');
    await user.click(screen.getByRole('button', { name: /Brake pad/ }));
    expect(await screen.findByRole('button', { name: 'Save and publish' })).toBeDisabled();
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
    expect(screen.getAllByText(INSUFFICIENT).length).toBeGreaterThan(0);
  });
});

describe('tailoring image alt required', () => {
  const withImage = (label?: string): TailoringDetail => ({
    productId: 'p1', sku: 'SKU-1', languages: ['de-DE', 'en-US'],
    master: { name: { 'de-DE': 'Bremsbelag', 'en-US': 'Brake pad' }, description: { 'de-DE': 'M', 'en-US': 'M' }, images: [] },
    tailored: { name: { 'de-DE': 'Bremsbelag', 'en-US': 'Brake pad' }, description: { 'de-DE': 'M', 'en-US': 'M' }, images: [{ url: 'https://img.example.test/1.png', width: 800, height: 800, ...(label ? { label } : {}) }] },
    tailoredLocales: [],
  });
  beforeEach(() => {
    state.tailoringList = { rows: [{ productId: 'p1', sku: 'SKU-1', name: { 'en-US': 'Brake pad' }, tailored: true, hasTailoredImages: true }], total: 1 };
  });

  it('saving an image without alt text is refused with an error tied to the field, and nothing is sent', async () => {
    state.tailoringDetail = withImage();
    const user = userEvent.setup();
    const { container } = screenOf(<ProductInfoPanel />);
    await user.click(screen.getByRole('button', { name: /Brake pad/ }));
    await user.click(await screen.findByRole('button', { name: 'Save and publish' }));
    const field = screen.getByLabelText('Alt text for image 1 (required)');
    expect(state.save).not.toHaveBeenCalled();
    expect(field).toBeRequired();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription(/Enter alt text for image 1/);
    expect(screen.getByRole('alert')).toHaveTextContent('Add alt text to every image before you save.');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('with alt text the image is saved with its label and the thumbnail uses it as alt', async () => {
    state.tailoringDetail = withImage();
    state.save.mockResolvedValue({ ok: true, status: 200 });
    const user = userEvent.setup();
    screenOf(<ProductInfoPanel />);
    await user.click(screen.getByRole('button', { name: /Brake pad/ }));
    await user.type(await screen.findByLabelText('Alt text for image 1 (required)'), 'Front view of the brake pad');
    expect(screen.getByRole('img', { name: 'Front view of the brake pad' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][2].images).toEqual([{ url: 'https://img.example.test/1.png', label: 'Front view of the brake pad' }]);
  });

  it('an image added by address starts without alt text, so the field is offered at once', async () => {
    state.checkUrl.mockResolvedValue({ ok: true, status: 200, data: { url: 'https://img.example.test/3.png', width: 900, height: 900 } });
    const user = userEvent.setup();
    screenOf(<ImageHarness initial={[]} onValue={() => undefined} />);
    await user.type(screen.getByLabelText('Add by address'), 'https://img.example.test/3.png');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByLabelText('Alt text for image 1 (required)')).toHaveValue('');
  });

  it('a buyer sees the alt text read-only', () => {
    screenOf(<ImageHarness initial={[{ url: 'https://img.example.test/1.png', label: 'Front' }]} canEdit={false} onValue={() => undefined} />, 'buyer');
    expect(screen.getByLabelText('Alt text for image 1 (required)')).toBeDisabled();
  });
});

describe('a11y: catalog screens', () => {
  it('AssortmentTable, PricesTable and PriorityLists have no axe violations (admin and buyer)', async () => {
    state.assortment = { rows: [row()], total: 1, assigned: 1, totalMaster: 4 };
    state.prices = { rows: [{ sku: 'SKU-1', productId: 'p1', name: { 'en-US': 'Brake pad' }, listCent: 5000, overrideCent: null, belowListPercent: null, own: false }], total: 1, currency: 'EUR', currencies: ['EUR'] };
    state.discounts = { product: [], cart: [] };
    for (const role of ['admin', 'buyer'] as const) {
      for (const ui of [<AssortmentTable key="a" />, <PricesTable key="p" />, <PriorityLists key="l" />]) {
        const { container, unmount } = screenOf(ui, role);
        expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
        unmount();
      }
    }
  });
});

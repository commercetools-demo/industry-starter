import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen, within } from '@/test/utils';
import type { MedicineDetail } from '@/lib/types';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { namespace: string }) =>
    createTranslator({ locale: 'en-US', messages, namespace: (typeof arg === 'string' ? arg : arg.namespace) as 'medicine' }),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<object>()), notFound: () => notFound() }));
const getMedicine = vi.fn();
vi.mock('@/lib/ct/medicines', () => ({ getMedicineByKeyCached: (...a: unknown[]) => getMedicine(...a) }));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));

import MedicinePage, { generateMetadata } from './page';
import MedicineNotFound from './not-found';

const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
function medicine(o: Partial<MedicineDetail> = {}): MedicineDetail {
  return {
    id: 'p1',
    key: 'mlv-med-ibuprofen-400-mg',
    slug: 'ibuprofen-400-mg',
    name: 'Ibuprofen 400 mg tablets',
    description: 'Relieves mild to moderate pain.',
    sku: 'MED-ibuprofen-400-mg',
    strength: '400 mg',
    dosageForm: 'Tablet',
    rxOnly: false,
    dispenseUnit: 'pack',
    minRemainingShelfLifeDays: 90,
    maxQtyPerOrder: 5,
    hsaEligible: true,
    controlClass: null,
    price: money(620),
    sellableInRegion: true,
    imageUrl: null,
    categoryIds: [],
    imageUrls: [],
    availability: { status: 'in-stock' },
    ...o,
  };
}

const render = async (key = 'mlv-med-ibuprofen-400-mg') => renderWithProviders(await MedicinePage({ params: Promise.resolve({ locale: 'en-US', key }) }));

beforeEach(() => {
  getMedicine.mockReset().mockResolvedValue(medicine());
  getSession.mockReset().mockResolvedValue({});
  notFound.mockClear();
});

describe('product-detail-page: rendering', () => {
  it('shows name, strength, form, pack, description, price and the badges', async () => {
    await render();
    expect(screen.getByRole('heading', { level: 1, name: 'Ibuprofen 400 mg tablets' })).toBeInTheDocument();
    expect(screen.getByText('Relieves mild to moderate pain.')).toBeInTheDocument();
    expect(screen.getByText('Strength').nextElementSibling).toHaveTextContent('400 mg');
    expect(screen.getByText('Dosage form').nextElementSibling).toHaveTextContent('Tablet');
    expect(screen.getByText('Pack').nextElementSibling).toHaveTextContent('pack');
    expect(screen.getByTestId('medicine-price')).toHaveTextContent('$6.20');
    expect(screen.getByText('Over the counter')).toBeInTheDocument();
    expect(screen.getByText('HSA/FSA eligible')).toBeInTheDocument();
  });

  it('the price comes from the platform read and the session currency is passed to it', async () => {
    getSession.mockResolvedValue({ currency: 'USD', country: 'US' });
    await render();
    expect(getMedicine).toHaveBeenCalledWith('mlv-med-ibuprofen-400-mg', 'en-US', 'USD', 'US');
  });

  it('no HSA badge when the product is not eligible', async () => {
    getMedicine.mockResolvedValue(medicine({ hsaEligible: false }));
    await render();
    expect(screen.queryByText('HSA/FSA eligible')).not.toBeInTheDocument();
  });

  it('gallery: shows every image, with a placeholder when there is none', async () => {
    getMedicine.mockResolvedValue(medicine({ imageUrls: ['https://images.pexels.com/a.jpg', 'https://images.pexels.com/b.jpg'] }));
    const { unmount } = await render();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    unmount();
    getMedicine.mockResolvedValue(medicine());
    await render();
    expect(screen.getByRole('img', { name: 'No image available' })).toHaveAttribute('data-image', 'placeholder');
  });

  it('the per-order limit and the shelf-life promise are stated', async () => {
    await render();
    expect(screen.getByTestId('medicine-limit')).toHaveTextContent('Limit 5 packs per order.');
    expect(screen.getByTestId('medicine-shelf-life')).toHaveTextContent('Minimum 3 months of shelf life on delivery.');
  });

  it('metadata: canonical and hreflang through pageMetadata, empty for an unknown medicine', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en-US', key: 'mlv-med-ibuprofen-400-mg' }) });
    expect(meta.title).toBe('Ibuprofen 400 mg tablets');
    expect(meta.alternates?.canonical).toMatch(/^https?:\/\/.+\/en-US\/medicine\/mlv-med-ibuprofen-400-mg$/);
    expect(meta.alternates?.languages).toHaveProperty('x-default');
    getMedicine.mockResolvedValue(null);
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US', key: 'x' }) })).toEqual({});
  });
});

describe('expiry-dated-supply: availability on the page', () => {
  it('in stock shows the label and no notice', async () => {
    await render();
    const a = screen.getByText('Availability').closest('[data-availability]') as HTMLElement;
    expect(a).toHaveAttribute('data-availability', 'in-stock');
    expect(within(a).getByText('In stock')).toBeInTheDocument();
  });

  it('short-dated stock states its actual expiry and its own price', async () => {
    getMedicine.mockResolvedValue(medicine({ availability: { status: 'short-dated', expiryDate: '2026-11-15', shortDatedPrice: money(700) } }));
    await render();
    const a = screen.getByText('Availability').closest('[data-availability]') as HTMLElement;
    expect(within(a).getByText('Short-dated')).toBeInTheDocument();
    expect(a).toHaveTextContent('$7.00');
    expect(a).toHaveTextContent(/2026|Nov/);
  });

  it('stock that cannot meet the promise is stated as unavailable for now', async () => {
    getMedicine.mockResolvedValue(medicine({ availability: { status: 'shelf-life', expiryDate: '2026-10-20' } }));
    await render();
    expect(screen.getByText('Unavailable for now')).toBeInTheDocument();
  });

  it('unknown stock states nothing about stock', async () => {
    getMedicine.mockResolvedValue(medicine({ availability: null }));
    await render();
    expect(screen.queryByText('Availability')).not.toBeInTheDocument();
  });
});

describe('credentialed-purchase-scope: controlled medicine notice', () => {
  it('shows the credential notice and keeps the page', async () => {
    getMedicine.mockResolvedValue(medicine({ rxOnly: true, controlClass: 'schedule-iv' }));
    await render();
    expect(screen.getByRole('note')).toHaveTextContent('requires a valid Schedule IV credential');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('medicine-price')).toBeInTheDocument();
  });

  it('no notice for an uncontrolled medicine', async () => {
    await render();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('prescription-bound-supply: primary action', () => {
  it('Rx-only: "Find it on your prescription" goes to the prescriptions page and there is no add-to-cart', async () => {
    getMedicine.mockResolvedValue(medicine({ rxOnly: true }));
    await render();
    expect(screen.getByText('Prescription only')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find it on your prescription' })).toHaveAttribute('href', '/en-US/prescriptions');
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument();
  });

  it('OTC: the cart carries prescription lines only, so the action is "Order from your prescription" (gap AB-missed)', async () => {
    await render();
    expect(screen.getByRole('link', { name: 'Order from your prescription' })).toHaveAttribute('href', '/en-US/prescriptions');
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument();
  });

  it('the link carries no medicine, RX number or health data in the URL', async () => {
    getMedicine.mockResolvedValue(medicine({ rxOnly: true }));
    await render();
    for (const a of screen.getAllByRole('link')) expect(a.getAttribute('href') ?? '').not.toMatch(/[?#]|ibuprofen|RX-/i);
  });
});

describe('switching-region-or-language: not sellable in this region', () => {
  it('shows the "not available in this region" card instead of a price and any action', async () => {
    getMedicine.mockResolvedValue(medicine({ price: null, sellableInRegion: false }));
    await render();
    expect(screen.getByRole('heading', { name: 'Not available in this region' })).toBeInTheDocument();
    expect(screen.queryByTestId('medicine-price')).not.toBeInTheDocument();
    expect(screen.queryByTestId('medicine-cta')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('error-pages: unknown medicine', () => {
  it('the page calls notFound (HTTP 404) and the shared view says so with a way back', async () => {
    getMedicine.mockResolvedValue(null);
    await expect(render('mlv-med-nope')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
    renderWithProviders(<MedicineNotFound />);
    expect(screen.getByRole('heading', { name: 'Medicine not found.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to search' })).toHaveAttribute('href', '/en-US/search');
  });
});

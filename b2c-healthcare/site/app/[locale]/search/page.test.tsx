import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen, within } from '@/test/utils';
import type { DoctorCard, Medication } from '@/lib/types';
import type { SearchAllResult } from '@/lib/ct/search-all';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { namespace: string }) =>
    createTranslator({ locale: 'en-US', messages, namespace: (typeof arg === 'string' ? arg : arg.namespace) as 'search' }),
}));
const searchAll = vi.fn();
vi.mock('@/lib/ct/search-all', () => ({ searchAll: (...a: unknown[]) => searchAll(...a) }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({}) }));

import SearchPage, { generateMetadata } from './page';

const doctor: DoctorCard = {
  id: 'd',
  key: 'mlv-doc-amara-okafor',
  slug: 'amara-okafor',
  name: 'Dr. Amara Okafor',
  specialty: 'General Practice',
  specialtyKey: 'general-practice',
  yearsExperience: 12,
  clinicName: 'Malva Clinic',
  city: 'new-york',
  modes: ['office'],
  fees: { office: { centAmount: 5500, currencyCode: 'USD', fractionDigits: 2 } },
  rating: 4.8,
  reviewCount: 5,
  initials: 'AO',
  portraitUrl: null,
};
const medicine = (slug: string, name: string): Medication => ({
  id: slug, key: slug, slug, name, description: '', sku: `MED-${slug}`, strength: '', dosageForm: '', rxOnly: slug.startsWith('amox'),
  dispenseUnit: '', minRemainingShelfLifeDays: null, maxQtyPerOrder: null, hsaEligible: true, controlClass: null,
  price: { centAmount: 1450, currencyCode: 'USD', fractionDigits: 2 }, imageUrl: null, categoryIds: [],
});

const ok = (o: Partial<Extract<SearchAllResult, { status: 'ok' }>> = {}): SearchAllResult => ({
  status: 'ok', query: 'q', doctors: [], doctorTotal: 0, medicines: [], medicineTotal: 0, exact: null, ...o,
});
const render = async (q?: string) =>
  renderWithProviders(await SearchPage({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve(q === undefined ? {} : { q }) }));

beforeEach(() => {
  searchAll.mockReset();
});

describe('search-results-page: Search results with exact part-number resolution (page)', () => {
  it('groups Doctors and Medicines; the doctor card links to the profile', async () => {
    searchAll.mockResolvedValue(ok({ query: 'o', doctors: [doctor], doctorTotal: 1, medicines: [medicine('ibuprofen', 'Ibuprofen 400 mg')], medicineTotal: 1 }));
    await render('o');
    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Doctors/ })).getByRole('link', { name: 'Dr. Amara Okafor' })).toHaveAttribute('href', '/en-US/doctor/mlv-doc-amara-okafor?m=office');
    expect(within(screen.getByRole('region', { name: /Medicines/ })).getByText('Ibuprofen 400 mg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all matching doctors' })).toHaveAttribute('href', '/en-US/doctors/remote?q=o');
  });

  it('Part number pasted: the matching medicine is first and shows the part number that matched', async () => {
    const amox = medicine('amoxicillin', 'Amoxicillin 500 mg');
    searchAll.mockResolvedValue(ok({ query: 'MED-amoxicillin', medicines: [amox, medicine('ibuprofen', 'Ibuprofen')], medicineTotal: 2, exact: amox }));
    await render('MED-amoxicillin');
    const cards = screen.getAllByTestId('medicine-result');
    expect(cards[0]).toHaveTextContent('Amoxicillin 500 mg');
    expect(cards[0]).toHaveTextContent('Matched part number MED-amoxicillin');
    expect(cards[1]).not.toHaveTextContent('Matched part number');
  });

  it('Query matches nothing: says so, keeps the query editable and offers specialties instead of an empty grid', async () => {
    searchAll.mockResolvedValue(ok({ query: 'zzzz' }));
    await render('zzzz');
    expect(screen.getByRole('heading', { name: 'Nothing matches “zzzz”' })).toBeInTheDocument();
    const box = screen.getByRole('searchbox', { name: 'Search doctors and medicines' });
    expect(box).toHaveValue('zzzz');
    expect(box).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Dermatology' })).toHaveAttribute('href', '/en-US/doctors/remote?specialty=dermatology');
  });

  it('Misspelt query: shows what the fuzzy search found and claims no correction', async () => {
    searchAll.mockResolvedValue(ok({ query: 'amoxicilin', medicines: [medicine('amoxicillin', 'Amoxicillin 500 mg')], medicineTotal: 1 }));
    await render('amoxicilin');
    expect(screen.getByText('Amoxicillin 500 mg')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/did you mean|showing results for/i);
  });

  it('Unsupported language: reports that the language is not supported, not an empty result', async () => {
    searchAll.mockResolvedValue({ status: 'unsupported-language', query: 'аспирин' });
    await render('аспирин');
    expect(screen.getByRole('heading', { name: 'That language is not supported yet' })).toBeInTheDocument();
    expect(screen.queryByText(/Nothing matches/)).toBeNull();
  });

  it('no query: a prompt with browse chips; the form posts to /en-US/search', async () => {
    searchAll.mockResolvedValue({ status: 'empty-query' });
    await render();
    expect(screen.getByRole('heading', { name: 'What are you looking for?' })).toBeInTheDocument();
    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('action', '/en-US/search');
    expect(form).toHaveAttribute('method', 'get');
    expect(screen.getByRole('searchbox')).toHaveAttribute('name', 'q');
  });

  it('search service error: a stated error with retry, not a blank page', async () => {
    searchAll.mockRejectedValue(new Error('down'));
    await render('okafor');
    expect(screen.getByRole('heading', { name: 'Search is not available right now' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en-US/search?q=okafor');
  });

  it('the page is not indexable and the query text is not logged', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }) })).toMatchObject({ robots: { index: false } });
    searchAll.mockRejectedValue(new Error('down'));
    await render('secretword');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    spies.forEach((s) => s.mockRestore());
  });
});

describe('discovery-and-browse: Discovery and browse', () => {
  it('Nothing matches: the empty state offers a way back into the catalog', async () => {
    searchAll.mockResolvedValue(ok({ query: 'zzzz' }));
    await render('zzzz');
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.includes('/doctors/remote?specialty='))).toHaveLength(7);
  });
});

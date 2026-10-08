import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen, within } from '@/test/utils';
import type { DoctorListItem } from '@/lib/types';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { namespace: string }) =>
    createTranslator({ locale: 'en-US', messages, namespace: (typeof arg === 'string' ? arg : arg.namespace) as 'doctors' }),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<object>()), notFound: () => notFound() }));
const redirect = vi.fn((target: unknown) => {
  throw new Error(`NEXT_REDIRECT ${JSON.stringify(target)}`);
});
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  redirect: (target: unknown) => redirect(target),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/doctors/remote',
}));
const searchDoctors = vi.fn();
vi.mock('@/lib/ct/doctors', () => ({ searchDoctors: (...a: unknown[]) => searchDoctors(...a) }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({}) }));

import DoctorsPage, { generateMetadata } from './page';

function doctor(n: number): DoctorListItem {
  return {
    id: `d${n}`,
    key: `mlv-doc-${n}`,
    slug: `d${n}`,
    name: `Dr. Number ${n}`,
    specialty: 'Cardiology',
    specialtyKey: 'cardiology',
    yearsExperience: 5,
    clinicName: 'Clinic',
    city: 'austin',
    modes: ['remote', 'office'],
    fees: { remote: { centAmount: 3500, currencyCode: 'USD', fractionDigits: 2 }, office: { centAmount: 5500, currencyCode: 'USD', fractionDigits: 2 } },
    rating: 4.5,
    reviewCount: 2,
    initials: 'DN',
    portraitUrl: null,
    next: null,
  };
}

const result = (items: DoctorListItem[], o: { total?: number; page?: number; pageCount?: number } = {}) => ({
  items,
  total: o.total ?? items.length,
  page: o.page ?? 1,
  pageCount: o.pageCount ?? 1,
  pageSize: 9,
  facets: [],
});

const render = async (mode: string, query: Record<string, string> = {}) =>
  renderWithProviders(await DoctorsPage({ params: Promise.resolve({ locale: 'en-US', mode }), searchParams: Promise.resolve(query) }));

beforeEach(() => {
  searchDoctors.mockReset();
  notFound.mockClear();
  redirect.mockClear();
});

describe('design-plp: Doctor list by consultation mode (page)', () => {
  it('only remote and office exist; anything else is a 404', async () => {
    await expect(render('video')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(searchDoctors).not.toHaveBeenCalled();
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US', mode: 'video' }) })).toEqual({});
  });

  it('shows the H1, the count line and one card per doctor; no <main> of its own', async () => {
    searchDoctors.mockResolvedValue(result([doctor(1), doctor(2)]));
    const { container } = await render('remote');
    expect(screen.getByRole('heading', { level: 1, name: 'Remote sessions' })).toBeInTheDocument();
    expect(screen.getByTestId('doctor-count')).toHaveTextContent('2 doctors');
    expect(screen.getAllByTestId('doctor-card')).toHaveLength(2);
    expect(container.querySelector('main')).toBeNull();
    expect(searchDoctors).toHaveBeenCalledWith(expect.objectContaining({ mode: 'remote', currency: 'USD', country: 'US', locale: 'en-US' }));
  });

  it('count line is singular for one doctor', async () => {
    searchDoctors.mockResolvedValue(result([doctor(1)]));
    await render('office');
    expect(screen.getByTestId('doctor-count')).toHaveTextContent(/^1 doctor$/);
    expect(screen.getByRole('heading', { level: 1, name: 'Office visits' })).toBeInTheDocument();
  });

  it('Switching mode: segmented control links to the other route and keeps the filters', async () => {
    searchDoctors.mockResolvedValue(result([doctor(1)], { total: 12, page: 2, pageCount: 2 }));
    await render('remote', { specialty: 'cardiology', q: 'lee', page: '2' });
    const group = screen.getByRole('group', { name: 'Consultation type' });
    expect(within(group).getByRole('link', { name: 'Remote session' })).toHaveAttribute('aria-current', 'page');
    expect(within(group).getByRole('link', { name: 'Office visit' })).toHaveAttribute('href', '/en-US/doctors/office?q=lee&specialty=cardiology');
  });

  it('Switching mode: the city filter appears in office mode only', async () => {
    searchDoctors.mockResolvedValue(result([doctor(1)]));
    const remote = await render('remote');
    expect(screen.queryByRole('combobox', { name: 'City' })).toBeNull();
    remote.unmount();
    await render('office');
    expect(screen.getByRole('combobox', { name: 'City' })).toBeInTheDocument();
  });

  it('Filters: the URL state reaches the search (city is passed through, the search ignores it in remote mode)', async () => {
    searchDoctors.mockResolvedValue(result([]));
    await render('office', { q: 'okafor', specialty: 'cardiology', city: 'austin', today: '1' });
    expect(searchDoctors).toHaveBeenCalledWith(expect.objectContaining({ q: 'okafor', specialty: 'cardiology', city: 'austin', today: true, page: 1 }));
  });

  it('No match: the card and the active filters, each removable', async () => {
    searchDoctors.mockResolvedValue(result([]));
    await render('remote', { specialty: 'dermatology', today: '1' });
    expect(screen.getByText('No doctors match. Try clearing a filter.')).toBeInTheDocument();
    expect(screen.getByTestId('doctor-count')).toHaveTextContent('0 doctors');
    expect(screen.getByRole('link', { name: 'Remove filter: Dermatology' })).toHaveAttribute('href', '/en-US/doctors/remote?today=1');
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  });

  it('More doctors than a page: the pager links keep the filter state, the count shows the total', async () => {
    searchDoctors.mockResolvedValue(result(Array.from({ length: 9 }, (_, i) => doctor(i)), { total: 20, pageCount: 3 }));
    await render('remote', { specialty: 'cardiology' });
    expect(screen.getByTestId('doctor-count')).toHaveTextContent('20 doctors');
    expect(screen.getAllByTestId('doctor-card')).toHaveLength(9);
    const pager = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(pager).getByRole('link', { name: 'Page 2' })).toHaveAttribute('href', '/en-US/doctors/remote?specialty=cardiology&page=2');
    expect(within(pager).getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  });

  it('Page past the last result: redirects to the last page that has results', async () => {
    searchDoctors.mockResolvedValue(result([doctor(1)], { total: 10, page: 2, pageCount: 2 }));
    await expect(render('remote', { page: '99', specialty: 'cardiology' })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith({ href: '/doctors/remote?specialty=cardiology&page=2', locale: 'en-US' });
  });

  it('Search service error: a stated error with a way to retry, not a blank page', async () => {
    searchDoctors.mockRejectedValue(new Error('boom'));
    await render('remote', { q: 'okafor' });
    expect(screen.getByRole('heading', { name: 'We could not load the doctors' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en-US/doctors/remote?q=okafor');
    // The filter bar stays so the visitor can change the request.
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('Narrow screens: the filter bar overlaps the page head by 24 px (-mt-6)', async () => {
    searchDoctors.mockResolvedValue(result([doctor(1)]));
    await render('remote');
    expect(screen.getByRole('search')).toHaveClass('-mt-6', 'relative');
  });

  it('Browse a category: /doctors/remote?specialty=dermatology lists that specialty and marks its chip', async () => {
    searchDoctors.mockResolvedValue(result([doctor(1)]));
    await render('remote', { specialty: 'dermatology' });
    expect(searchDoctors).toHaveBeenCalledWith(expect.objectContaining({ specialty: 'dermatology' }));
    const nav = screen.getByRole('navigation', { name: 'Browse by specialty' });
    expect(within(nav).getByRole('link', { name: 'Dermatology' })).toHaveAttribute('aria-current', 'true');
    expect(within(nav).getByRole('link', { name: 'Cardiology' })).toHaveAttribute('href', '/en-US/doctors/remote?specialty=cardiology');
  });

  it('metadata: titled per mode', async () => {
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US', mode: 'office' }) })).toMatchObject({ title: 'Office visits with a doctor' });
  });
});

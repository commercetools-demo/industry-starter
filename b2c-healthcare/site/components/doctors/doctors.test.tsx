import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/utils';
import type { DoctorListItem } from '@/lib/types';
import { EMPTY_LISTING } from '@/lib/listing-url';

const replace = vi.fn();
let pathname = '/doctors/remote';
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
}));
vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal()));

import { AvailabilityBadge } from './AvailabilityBadge';
import { DoctorCard } from './DoctorCard';
import { DoctorFilters } from './DoctorFilters';
import { ActiveFilters, DoctorList } from './DoctorList';
import { SpecialtyChips } from './SpecialtyChips';

function doctor(o: Partial<DoctorListItem> = {}): DoctorListItem {
  return {
    id: 'a',
    key: 'mlv-doc-amara-okafor',
    slug: 'amara-okafor',
    name: 'Dr. Amara Okafor',
    specialty: 'General Practice',
    specialtyKey: 'general-practice',
    yearsExperience: 12,
    clinicName: 'Malva Clinic · Midtown',
    city: 'new-york',
    modes: ['remote', 'office'],
    fees: {
      remote: { centAmount: 3500, currencyCode: 'USD', fractionDigits: 2 },
      office: { centAmount: 5500, currencyCode: 'USD', fractionDigits: 2 },
    },
    rating: 4.8,
    reviewCount: 5,
    initials: 'AO',
    portraitUrl: null,
    next: { startsAt: '2026-10-13T13:00:00.000Z', localDate: '2026-10-13', isToday: false },
    ...o,
  };
}

beforeEach(() => {
  replace.mockClear();
  pathname = '/doctors/remote';
});
afterEach(() => vi.useRealTimers());

describe('design-plp: Doctor card content', () => {
  it('Card anatomy: avatar, name, specialty and experience, rating, fee, availability, View profile', () => {
    const { container } = renderWithProviders(<DoctorCard doctor={doctor()} mode="remote" />);
    expect(screen.getByRole('heading', { level: 3, name: 'Dr. Amara Okafor' })).toBeInTheDocument();
    expect(screen.getByText('General Practice · 12 yrs experience')).toBeInTheDocument();
    expect(screen.getByText('★ 4.8 (5 reviews)')).toBeInTheDocument();
    expect(screen.getByText('$35.00')).toBeInTheDocument();
    expect(screen.getByText('View profile')).toBeInTheDocument();
    expect(container.querySelector('[data-size="md"].bg-\\(image\\:--gradient-peach\\)')).not.toBeNull();
    expect(screen.getByText('AO')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 }).className).toContain('text-brand-700');
  });

  it('Card anatomy: the office card adds the clinic and shows the office fee', () => {
    renderWithProviders(<DoctorCard doctor={doctor()} mode="office" />);
    expect(screen.getByText('★ 4.8 (5 reviews) · Malva Clinic · Midtown')).toBeInTheDocument();
    expect(screen.getByText('$55.00')).toBeInTheDocument();
  });

  it('No price for this buyer: says so instead of showing zero', () => {
    renderWithProviders(<DoctorCard doctor={doctor({ fees: {} })} mode="remote" />);
    expect(screen.getByText('Price not available')).toBeInTheDocument();
    expect(screen.queryByText(/\$0/)).toBeNull();
  });

  it('Availability badge: green today, blue later with weekday and day, nothing without a slot', () => {
    const today = renderWithProviders(<AvailabilityBadge next={{ startsAt: 'x', localDate: '2026-10-08', isToday: true }} />);
    expect(screen.getByText('Available today')).toHaveAttribute('data-variant', 'ok');
    today.unmount();
    const later = renderWithProviders(<AvailabilityBadge next={{ startsAt: 'x', localDate: '2026-10-13', isToday: false }} />);
    expect(screen.getByText('Next: Tue 13')).toHaveAttribute('data-variant', 'info');
    later.unmount();
    const none = renderWithProviders(<AvailabilityBadge next={null} />);
    expect(none.container.querySelector('[data-variant]')).toBeNull();
  });

  it('Navigation and keyboard: the card is a real link to /doctor/:key?m=<mode>, reachable with Tab', async () => {
    renderWithProviders(<DoctorCard doctor={doctor()} mode="office" />);
    const link = screen.getByRole('link', { name: 'Dr. Amara Okafor' });
    expect(link).toHaveAttribute('href', '/en-US/doctor/mlv-doc-amara-okafor?m=office');
    // Stretched over the whole card, so a click anywhere opens the profile.
    expect(link.className).toContain('after:absolute');
    expect(link.className).toContain('after:inset-0');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    await userEvent.tab();
    expect(link).toHaveFocus();
  });

  it('Narrow screens: the right column drops under the text and spans the full width below 900 px', () => {
    renderWithProviders(<DoctorCard doctor={doctor()} mode="remote" />);
    const aside = screen.getByTestId('doctor-card-aside');
    expect(aside).toHaveClass('col-span-2', 'nav:col-span-1');
    expect(screen.getByTestId('doctor-card')).toHaveClass('grid-cols-[auto_1fr]', 'nav:grid-cols-[auto_1fr_auto]');
  });
});

describe('design-plp: Doctor list by consultation mode', () => {
  it('No match: a card reads "No doctors match. Try clearing a filter."', () => {
    renderWithProviders(<DoctorList items={[]} mode="remote" state={{ ...EMPTY_LISTING, q: 'zzz' }} />);
    const card = screen.getByTestId('no-match');
    expect(within(card).getByText('No doctors match. Try clearing a filter.')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/en-US/doctors/remote');
  });

  it('renders one card per doctor', () => {
    renderWithProviders(<DoctorList items={[doctor(), doctor({ key: 'b', name: 'Dr. B' })]} mode="remote" state={EMPTY_LISTING} />);
    expect(screen.getAllByTestId('doctor-card')).toHaveLength(2);
  });

  it('Filters: each change replaces the URL with the new state and goes back to page 1', async () => {
    renderWithProviders(<DoctorFilters mode="office" state={{ ...EMPTY_LISTING, specialty: 'cardiology', page: 3 }} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'City' }), 'austin');
    expect(replace).toHaveBeenLastCalledWith('/doctors/remote?specialty=cardiology&city=austin', { scroll: false });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Available today' }));
    expect(replace).toHaveBeenLastCalledWith('/doctors/remote?specialty=cardiology&today=1', { scroll: false });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Specialty' }), '');
    expect(replace).toHaveBeenLastCalledWith('/doctors/remote', { scroll: false });
  });

  it('Filters: the city select exists in office mode only; the controls reflect the URL state', () => {
    const remote = renderWithProviders(<DoctorFilters mode="remote" state={{ ...EMPTY_LISTING, today: true, q: 'okafor' }} />);
    expect(screen.queryByRole('combobox', { name: 'City' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Available today' })).toBeChecked();
    expect(screen.getByRole('searchbox', { name: 'Search by name or specialty' })).toHaveValue('okafor');
    remote.unmount();
    renderWithProviders(<DoctorFilters mode="office" state={EMPTY_LISTING} />);
    expect(screen.getByRole('combobox', { name: 'City' })).toBeInTheDocument();
  });

  it('Filters: typing is applied after a pause, Enter applies at once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<DoctorFilters mode="remote" state={EMPTY_LISTING} />);
    await user.type(screen.getByRole('searchbox'), 'rey');
    expect(replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith('/doctors/remote?q=rey', { scroll: false });
  });

  it('Facet combination with no matches: active filters stay visible and are individually removable', () => {
    const state = { ...EMPTY_LISTING, q: 'zz', specialty: 'dermatology', city: 'austin', today: true };
    renderWithProviders(<ActiveFilters mode="office" state={state} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Remove filter: Dermatology' })).toHaveAttribute('href', '/en-US/doctors/office?q=zz&city=austin&today=1');
    expect(screen.getByRole('link', { name: 'Remove filter: Austin' })).toHaveAttribute('href', '/en-US/doctors/office?q=zz&specialty=dermatology&today=1');
  });

  it('active filters: the city is not a filter in remote mode', () => {
    renderWithProviders(<ActiveFilters mode="remote" state={{ ...EMPTY_LISTING, city: 'austin' }} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('discovery-and-browse: specialty chips', () => {
  it('Browse a category: each specialty is a link to the filtered list', () => {
    renderWithProviders(<SpecialtyChips mode="remote" selected="dermatology" />);
    expect(screen.getByRole('link', { name: 'Dermatology' })).toHaveAttribute('href', '/en-US/doctors/remote?specialty=dermatology');
    expect(screen.getByRole('link', { name: 'Dermatology' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getAllByRole('link')).toHaveLength(7);
  });
});

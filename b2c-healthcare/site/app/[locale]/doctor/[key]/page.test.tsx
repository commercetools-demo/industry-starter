import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen, within } from '@/test/utils';
import type { DoctorProfile } from '@/lib/types';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { namespace: string }) =>
    createTranslator({ locale: 'en-US', messages, namespace: (typeof arg === 'string' ? arg : arg.namespace) as 'doctor' }),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<object>()), notFound: () => notFound() }));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/doctor/mlv-doc-amara-okafor',
}));
const getDoctor = vi.fn();
vi.mock('@/lib/ct/doctors', () => ({ getDoctorByKeyCached: (...a: unknown[]) => getDoctor(...a) }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({}) }));

import DoctorPage, { generateMetadata } from './page';
import DoctorNotFound from './not-found';

const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
function doctor(o: Partial<DoctorProfile> = {}): DoctorProfile {
  return {
    id: 'p1',
    key: 'mlv-doc-amara-okafor',
    slug: 'amara-okafor',
    name: 'Dr. Amara Okafor',
    specialty: 'General Practice',
    specialtyKey: 'general-practice',
    yearsExperience: 12,
    clinicName: 'Malva Clinic · Midtown',
    city: 'new-york',
    modes: ['remote', 'office'],
    fees: { remote: money(3500), office: money(5500) },
    rating: 4.8,
    reviewCount: 5,
    initials: 'AO',
    portraitUrl: null,
    bio: 'Family doctor focused on preventive care.',
    languages: ['English', 'Igbo'],
    education: 'MD, Example University',
    timezone: 'America/New_York',
    reviews: [
      { id: 'r1', rating: 5, text: 'Listened carefully.', createdAt: '2026-09-12T10:00:00.000Z' },
      { id: 'r2', rating: 4, text: 'On time and thorough.', createdAt: '2026-08-02T10:00:00.000Z' },
    ],
    ...o,
  };
}

const render = async (query: Record<string, string> = {}, key = 'mlv-doc-amara-okafor') =>
  renderWithProviders(await DoctorPage({ params: Promise.resolve({ locale: 'en-US', key }), searchParams: Promise.resolve(query) }));

beforeEach(() => {
  getDoctor.mockReset().mockResolvedValue(doctor());
  notFound.mockClear();
});

describe('design-pdp: Doctor profile layout', () => {
  it('Profile content: header card, About card with Education, Languages and Clinic', async () => {
    await render({ m: 'remote' });
    expect(screen.getByRole('heading', { level: 1, name: 'Dr. Amara Okafor' })).toBeInTheDocument();
    expect(screen.getByText('General Practice')).toBeInTheDocument();
    expect(screen.getByText('★ 4.8 · 5 reviews')).toBeInTheDocument();
    expect(screen.getByText('12 yrs experience')).toBeInTheDocument();
    const about = screen.getByRole('heading', { name: 'About' }).closest('section') as HTMLElement;
    expect(within(about).getByText('Family doctor focused on preventive care.')).toBeInTheDocument();
    expect(within(about).getByText('Education').nextElementSibling).toHaveTextContent('MD, Example University');
    expect(within(about).getByText('Languages').nextElementSibling).toHaveTextContent('English, Igbo');
    expect(within(about).getByText('Clinic').nextElementSibling).toHaveTextContent('Malva Clinic · Midtown');
  });

  it('Profile content: no rating badge when the doctor has no reviews yet', async () => {
    getDoctor.mockResolvedValue(doctor({ rating: null, reviewCount: 0, reviews: [] }));
    await render();
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
    expect(screen.getByText('12 yrs experience')).toBeInTheDocument();
  });

  it('Reviews: quote text and "Verified patient · Mon YYYY" for each', async () => {
    await render();
    const card = screen.getByTestId('doctor-reviews');
    expect(within(card).getByRole('heading', { name: 'Patient reviews' })).toBeInTheDocument();
    expect(within(card).getByText('“Listened carefully.”')).toBeInTheDocument();
    expect(within(card).getByText('Verified patient · Sep 2026')).toBeInTheDocument();
    expect(within(card).getByText('Verified patient · Aug 2026')).toBeInTheDocument();
  });

  it('Reviews: the card is omitted when there are none', async () => {
    getDoctor.mockResolvedValue(doctor({ reviews: [] }));
    await render();
    expect(screen.queryByTestId('doctor-reviews')).not.toBeInTheDocument();
    expect(screen.queryByText('Patient reviews')).not.toBeInTheDocument();
  });

  it('Back link keeps context: returns to the list in the same mode with the same filters', async () => {
    await render({ m: 'office', back: '/doctors/office?specialty=dermatology&city=austin&page=2' });
    expect(screen.getByRole('link', { name: '← All doctors' })).toHaveAttribute('href', '/en-US/doctors/office?specialty=dermatology&city=austin&page=2');
  });

  it('Back link keeps context: without `back` it is the plain list of the mode', async () => {
    await render({ m: 'office' });
    expect(screen.getByRole('link', { name: '← All doctors' })).toHaveAttribute('href', '/en-US/doctors/office');
  });

  it('Back link keeps context: a foreign or malformed `back` is ignored and unknown filters are dropped', async () => {
    for (const back of ['https://evil.example/doctors/remote', '//evil.example', '/account', '/doctors/remote/../../x', '/en-US/doctors/remote']) {
      const { unmount } = await render({ m: 'remote', back });
      expect(screen.getByRole('link', { name: '← All doctors' })).toHaveAttribute('href', '/en-US/doctors/remote');
      unmount();
    }
    await render({ m: 'remote', back: '/doctors/remote?q=cough&evil=1&specialty=Bad Value' });
    expect(screen.getByRole('link', { name: '← All doctors' })).toHaveAttribute('href', '/en-US/doctors/remote?q=cough');
  });

  it('Back link keeps context: a mode the doctor does not offer falls back to the first offered mode', async () => {
    getDoctor.mockResolvedValue(doctor({ modes: ['remote'], fees: { remote: money(3000) } }));
    await render({ m: 'office' });
    expect(screen.getByRole('link', { name: '← All doctors' })).toHaveAttribute('href', '/en-US/doctors/remote');
  });

  it('Unknown doctor: the page calls notFound (HTTP 404) and the not-found view says so with a way back', async () => {
    getDoctor.mockResolvedValue(null);
    await expect(render({}, 'mlv-doc-nope')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
    renderWithProviders(<DoctorNotFound />);
    expect(screen.getByRole('heading', { name: 'Doctor not found.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to search' })).toHaveAttribute('href', '/en-US/doctors/remote');
  });

  it('metadata: title and description from the doctor, empty for an unknown one', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en-US', key: 'mlv-doc-amara-okafor' }) });
    expect(meta.title).toBe('Dr. Amara Okafor, General Practice');
    getDoctor.mockResolvedValue(null);
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US', key: 'nope' }) })).toEqual({});
  });
});

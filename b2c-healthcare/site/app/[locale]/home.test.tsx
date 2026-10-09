import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen, within } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { namespace: string }) =>
    createTranslator({ locale: 'en-US', messages, namespace: (typeof arg === 'string' ? arg : arg.namespace) as 'home' }),
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<object>()), usePathname: () => '/' }));

const getHomeSnapshot = vi.fn();
const hasSameDayMethod = vi.fn();
vi.mock('@/lib/ct/home', () => ({
  getHomeSnapshot: (...a: unknown[]) => getHomeSnapshot(...a),
  hasSameDayMethod: () => hasSameDayMethod(),
}));
const showJournal = vi.fn();
const getPublishedArticles = vi.fn();
vi.mock('@/lib/routes', () => ({ showJournal: (...a: unknown[]) => showJournal(...a) }));
vi.mock('@/lib/content', () => ({ getPublishedArticles: (...a: unknown[]) => getPublishedArticles(...a) }));

import { Footer } from '@/components/layout/Footer';
import type { Article } from '@/lib/content';
import type { HomeDoctor, HomeSnapshot } from '@/lib/ct/home';
import type { DoctorListItem } from '@/lib/types';
import LocaleHome, { generateMetadata } from './page';

const params = Promise.resolve({ locale: 'en-US' });
const h = messages.home;

async function renderHome() {
  return renderWithProviders(await LocaleHome({ params }));
}

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });

function entry(n: number, o: { mode?: 'remote' | 'office'; today?: boolean; date?: string; rating?: number | null } = {}): HomeDoctor {
  const doctor: DoctorListItem = {
    id: `d${n}`, key: `mlv-doc-${n}`, slug: `d${n}`, name: `Dr. Number ${n}`, specialty: 'Cardiology', specialtyKey: 'cardiology',
    yearsExperience: 7, clinicName: '', city: 'austin', modes: ['remote', 'office'], fees: { remote: usd(3500), office: usd(6000) },
    rating: o.rating === undefined ? 4.8 : o.rating, reviewCount: 12, initials: 'DN', portraitUrl: null,
    next: { startsAt: '2026-10-08T17:00:00.000Z', localDate: o.date ?? '2026-10-08', isToday: o.today ?? true },
  };
  return { doctor, mode: o.mode ?? 'remote' };
}

function snapshot(partial: Partial<HomeSnapshot> = {}): HomeSnapshot {
  return {
    available: { state: 'none', items: [] },
    stats: { doctorCount: null, averageRating: null, availableToday: null },
    ...partial,
  };
}

function article(n: number): Article {
  return {
    slug: `article-${n}`, title: `Article title ${n}`, description: '', category: n % 2 ? 'Sleep' : 'Medication', minutes: n + 3,
    published: '2026-09-01', tags: [], cover: `journal-${n}`, withdrawn: false, body: 'x', draft: false, fellBack: false,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  getHomeSnapshot.mockReset();
  getHomeSnapshot.mockResolvedValue(null);
  hasSameDayMethod.mockReset();
  hasSameDayMethod.mockResolvedValue(false);
  showJournal.mockReset();
  showJournal.mockReturnValue(false);
  getPublishedArticles.mockReset();
  getPublishedArticles.mockReturnValue([]);
});

describe('design-home-page › Home page sections in design order', () => {
  it('Hero: sky gradient, H1, lead, search, specialty chips (Mental health hidden) and a 460 px image area', async () => {
    const { container } = await renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Care that comes to you, or the other way round.' })).toBeInTheDocument();
    expect(screen.getByText(h.hero.lead)).toBeInTheDocument();
    const hero = container.querySelector('section[aria-labelledby="home-hero-title"]');
    expect(hero?.className).toContain('--gradient-sky');
    const search = screen.getByRole('search');
    expect(within(search).getByPlaceholderText('Doctor, specialty or medicine')).toBeInTheDocument();
    expect(within(search).getByRole('button', { name: 'Search' })).toBeInTheDocument();
    const chips = within(screen.getByRole('navigation', { name: h.hero.chipsLabel })).getAllByRole('link');
    expect(chips.map((c) => c.textContent)).toEqual(['General practice', 'Dermatology', 'Pediatrics']);
    expect(screen.queryByText(/mental health/i)).toBeNull();
    const image = container.querySelector('[data-image]');
    expect(image).toHaveClass('nav:h-115', 'rounded-t-xl');
    // The committed site-images.json gives the hero a photo with a clean URL, never an invented one.
    expect(image).toHaveAttribute('data-image', 'photo');
    expect(container.querySelector('[data-image] img')?.getAttribute('src')).toMatch(/^https:\/\/[^?#]+$/);
  });

  it('Search submit: a plain GET form to the search results; empty or blank text cannot be submitted', async () => {
    await renderHome();
    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/en-US/search');
    const input = within(form).getByRole('searchbox');
    expect(input).toHaveAttribute('name', 'q');
    expect(input).toBeRequired();
    // A whitespace-only value fails the pattern, so the visitor stays on the home page.
    expect(input).toHaveAttribute('pattern', '.*\\S.*');
  });

  it('Search submit: a chip leads to the doctor list filtered to that specialty', async () => {
    await renderHome();
    const nav = screen.getByRole('navigation', { name: h.hero.chipsLabel });
    expect(within(nav).getByRole('link', { name: 'Dermatology' })).toHaveAttribute('href', '/en-US/doctors/remote?specialty=dermatology');
    expect(within(nav).getByRole('link', { name: 'General practice' })).toHaveAttribute('href', '/en-US/doctors/remote?specialty=general-practice');
    expect(within(nav).getByRole('link', { name: 'Pediatrics' })).toHaveAttribute('href', '/en-US/doctors/remote?specialty=pediatrics');
  });

  it('Services grid: only services that exist, each with an icon tile, title, one line and one link', async () => {
    const { container } = await renderHome();
    const region = screen.getByRole('region', { name: h.services.title });
    const cards = within(region).getAllByRole('listitem');
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Remote sessions',
      'Office visits',
      'Prescriptions',
      'Medicine delivery',
      'Lab tests',
      'Health records',
    ]);
    const hrefs = cards.map((c) => within(c).getByRole('link').getAttribute('href'));
    expect(hrefs).toEqual(['/en-US/doctors/remote', '/en-US/doctors/office', '/en-US/prescriptions', '/en-US/prescriptions', '/en-US/account/labs', '/en-US/account']);
    expect(screen.queryByText(/mental health|second opinion/i)).toBeNull();
    expect(container.querySelector('.size-13')).not.toBeNull();
    expect(region.querySelector('ul')?.className).toContain('minmax(min(100%,15.625rem),1fr)');
  });

  it('How it works: four numbered steps with navy circles', async () => {
    const { container } = await renderHome();
    const region = screen.getByRole('region', { name: h.steps.title });
    const steps = within(region).getAllByRole('listitem');
    expect(steps.map((s) => within(s).getByRole('heading', { level: 3 }).textContent)).toEqual([
      "Tell us what's wrong",
      'Choose your doctor',
      'Meet by video or in person',
      'Get your care plan',
    ]);
    const circles = [...region.querySelectorAll('li > span')];
    expect(circles.map((c) => c.textContent)).toEqual(['1', '2', '3', '4']);
    expect(circles.every((c) => c.classList.contains('bg-navy-700') && c.classList.contains('size-11'))).toBe(true);
    expect(container.querySelector('ol')).not.toBeNull();
  });
});

describe('design-home-page › Doctors available today from live availability', () => {
  it('Doctors available: cards with avatar, name, specialty and years, rating, badge, lead fee with mode and a Book link', async () => {
    getHomeSnapshot.mockResolvedValue(
      snapshot({ available: { state: 'today', items: [entry(1), entry(2, { mode: 'office' }), entry(3)] } }),
    );
    await renderHome();
    const section = screen.getByRole('region', { name: 'Doctors available today' });
    const cards = within(section).getAllByTestId('home-doctor-card');
    expect(cards).toHaveLength(3);
    const first = within(cards[0] as HTMLElement);
    expect(first.getByRole('heading', { name: 'Dr. Number 1' })).toBeInTheDocument();
    expect(first.getByText('Cardiology · 7 yrs experience')).toBeInTheDocument();
    expect(first.getByText('★ 4.8 (12 reviews)')).toBeInTheDocument();
    expect(first.getByText('Available today')).toBeInTheDocument();
    expect(first.getByText(/Video/)).toHaveTextContent('Video · $35.00');
    expect(first.getByRole('link', { name: 'Book with Dr. Number 1' })).toHaveAttribute('href', '/en-US/doctor/mlv-doc-1?m=remote');
    expect(within(cards[1] as HTMLElement).getByText(/In office/)).toHaveTextContent('In office · $60.00');
    expect(within(section).getByRole('link', { name: 'View all doctors' })).toHaveAttribute('href', '/en-US/doctors/remote');
    expect(section).toHaveTextContent(h.available.sub);
  });

  it('No availability today: the next available day replaces the badge and the lead line says so', async () => {
    getHomeSnapshot.mockResolvedValue(
      snapshot({ available: { state: 'next', items: [entry(1, { today: false, date: '2026-10-13' })] } }),
    );
    await renderHome();
    const section = screen.getByRole('region', { name: 'Doctors available today' });
    expect(within(section).getByText('Next: Tue 13')).toBeInTheDocument();
    expect(within(section).queryByText('Available today')).toBeNull();
    expect(section).toHaveTextContent(h.available.subNext);
  });

  it('No availability today: with nobody free in the next days, or when the source is down, the section is hidden', async () => {
    getHomeSnapshot.mockResolvedValue(snapshot());
    const first = await renderHome();
    expect(screen.queryByRole('region', { name: 'Doctors available today' })).toBeNull();
    expect(screen.queryByTestId('home-doctor-card')).toBeNull();
    first.unmount();
    getHomeSnapshot.mockResolvedValue(null);
    await renderHome();
    expect(screen.queryByRole('region', { name: 'Doctors available today' })).toBeNull();
    // The static sections still render.
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('a doctor without reviews shows "No reviews yet" instead of a rating', async () => {
    getHomeSnapshot.mockResolvedValue(snapshot({ available: { state: 'today', items: [entry(1, { rating: null })] } }));
    await renderHome();
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
  });
});

describe('design-home-page › Statistics and live claims are sourced', () => {
  const FULL = { doctorCount: 8, averageRating: 4.8, availableToday: 5 };
  const withStats = (stats: Partial<HomeSnapshot['stats']>) =>
    getHomeSnapshot.mockResolvedValue(snapshot({ stats: { doctorCount: null, averageRating: null, availableToday: null, ...stats } }));

  it('Statistics band: shows the measured doctor count, rating and doctors available today, and no literal from the prototype', async () => {
    withStats(FULL);
    const { container } = await renderHome();
    const band = screen.getByRole('region', { name: h.stats.label });
    expect(within(band).getByText('Doctors on Malva').nextElementSibling).toHaveTextContent('8');
    expect(within(band).getByText('Average patient rating').nextElementSibling).toHaveTextContent('4.8 / 5');
    expect(within(band).getByText('Doctors available today').nextElementSibling).toHaveTextContent('5');
    expect(container.textContent).not.toMatch(/2M\+|8,000|15 min|Median wait|Consultations completed/);
  });

  it.each([
    ['doctorCount', 'Doctors on Malva'],
    ['averageRating', 'Average patient rating'],
    ['availableToday', 'Doctors available today'],
  ] as const)('Statistics band: a figure without a source (%s) is removed, the others stay', async (field, label) => {
    withStats({ ...FULL, [field]: null });
    await renderHome();
    const band = screen.getByRole('region', { name: h.stats.label });
    expect(within(band).queryByText(label)).toBeNull();
    expect(band.querySelectorAll('[data-stat]')).toHaveLength(2);
  });

  it('Statistics band: with no source at all the band is omitted', async () => {
    withStats({});
    await renderHome();
    expect(screen.queryByRole('region', { name: h.stats.label })).toBeNull();
  });

  it('Floating chips: the hero chip carries the live count and no delivery chip exists', async () => {
    withStats(FULL);
    const { container } = await renderHome();
    expect(screen.getByTestId('hero-available-chip')).toHaveTextContent('5 doctors available today');
    expect(container.textContent).not.toMatch(/Rx #|out for delivery/);
  });

  it('Floating chips: one doctor is singular, and no live count hides the chip', async () => {
    withStats({ ...FULL, availableToday: 1 });
    const first = await renderHome();
    expect(screen.getByTestId('hero-available-chip')).toHaveTextContent('1 doctor available today');
    first.unmount();
    withStats({ ...FULL, availableToday: null });
    await renderHome();
    expect(screen.queryByTestId('hero-available-chip')).toBeNull();
  });
});

describe('design-home-page › Prescription delivery and journal blocks', () => {
  const rxBlock = () => screen.getByRole('region', { name: 'Your prescription, delivered' });

  it('Prescription block: heading, truthful checklist and both calls to action to /prescriptions', async () => {
    await renderHome();
    const block = rxBlock();
    expect(within(block).getByRole('link', { name: 'Order medicine' })).toHaveAttribute('href', '/en-US/prescriptions');
    expect(within(block).getByRole('link', { name: 'Find by RX number' })).toHaveAttribute('href', '/en-US/prescriptions');
    const items = within(within(block).getByRole('list')).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([expect.stringContaining(h.rx.lookup), expect.stringContaining(h.rx.standard)]);
    // The prototype's pharmacist chat does not exist as a feature: never claimed.
    expect(block.textContent).not.toMatch(/pharmacist|chat/i);
  });

  it('Prescription block: same-day delivery is claimed only while a same-day shipping method exists', async () => {
    hasSameDayMethod.mockResolvedValue(true);
    const on = await renderHome();
    expect(rxBlock()).toHaveTextContent(h.rx.sameDay);
    on.unmount();
    hasSameDayMethod.mockResolvedValue(false);
    await renderHome();
    expect(rxBlock()).not.toHaveTextContent(/same-day/i);
  });

  it('Prescription block: the auto-refill claim defaults to off and shows only when the flag is set', async () => {
    const off = await renderHome();
    expect(rxBlock()).not.toHaveTextContent(/auto-refill/i);
    off.unmount();
    vi.stubEnv('AUTO_REFILL_ENABLED', 'true');
    await renderHome();
    expect(rxBlock()).toHaveTextContent(h.rx.autoRefill);
  });

  it('Journal: three cards with category, reading time and a link to the article', async () => {
    showJournal.mockReturnValue(true);
    getPublishedArticles.mockReturnValue([article(1), article(2), article(3), article(4)]);
    const { container } = await renderHome();
    const row = screen.getByRole('region', { name: h.journal.title });
    const cards = within(row).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(within(cards[0] as HTMLElement).getByText('Sleep · 4 min read')).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByRole('link', { name: 'Article title 2' })).toHaveAttribute('href', '/en-US/journal/article-2');
    expect(within(row).getByRole('link', { name: /All articles/ })).toHaveAttribute('href', '/en-US/journal');
    expect(row.querySelectorAll('.h-45')).toHaveLength(3);
    // journal-1..3 are in the committed site-images.json: each cover is a photo, no placeholder gradient is shown.
    expect(container.querySelectorAll('#journal [data-image="photo"]')).toHaveLength(3);
    expect(container.querySelector('#journal [data-image="placeholder"]')).toBeNull();
  });

  it('Closing band: the home-cta photo sits under the brand gradient overlay; without a photo the band is the plain gradient', async () => {
    const { container } = await renderHome();
    const band = container.querySelector('section[aria-labelledby="home-cta-title"] [data-image]');
    expect(band).toHaveAttribute('data-image', 'photo');
    expect(band?.querySelector('img')?.getAttribute('src')).toMatch(/^https:\/\/[^?#]+$/);
    expect(band?.querySelector('[aria-hidden="true"]')?.className).toContain('--gradient-brand');
    expect(within(band as HTMLElement).getByRole('link', { name: h.cta.button })).toHaveAttribute('href', '/en-US/doctors/remote');
  });

  it('Journal: the block is omitted while there are no articles to show', async () => {
    showJournal.mockReturnValue(false);
    getPublishedArticles.mockReturnValue([article(1)]);
    await renderHome();
    expect(screen.queryByRole('region', { name: h.journal.title })).toBeNull();
    expect(getPublishedArticles).not.toHaveBeenCalled();
  });
});

describe('design-home-page › Home page sections in order', () => {
  it('renders hero, services, steps, doctors, prescription, statistics, journal and closing CTA in design order', async () => {
    getHomeSnapshot.mockResolvedValue(
      snapshot({ available: { state: 'today', items: [entry(1)] }, stats: { doctorCount: 8, averageRating: 4.8, availableToday: 5 } }),
    );
    showJournal.mockReturnValue(true);
    getPublishedArticles.mockReturnValue([article(1), article(2), article(3)]);
    const { container } = await renderHome();
    const titles = [...container.querySelectorAll('section')].map((s) => s.getAttribute('aria-labelledby') ?? s.getAttribute('aria-label'));
    expect(titles).toEqual([
      'home-hero-title',
      'home-services-title',
      'home-steps-title',
      'home-available-title',
      'home-rx-title',
      h.stats.label,
      'home-journal-title',
      'home-cta-title',
    ]);
  });
});

describe('design-home-page › Closing call to action', () => {
  it('the band says "Feeling unwell? See a doctor today." with a Book a visit button and no emergency claim', async () => {
    await renderHome();
    const band = screen.getByRole('region', { name: 'Feeling unwell? See a doctor today.' });
    expect(within(band).getByRole('link', { name: 'Book a visit' })).toHaveAttribute('href', '/en-US/doctors/remote');
    expect(band.textContent).not.toMatch(/emergenc|urgent|911/i);
  });

  it('Emergency disclaimer: the footer shows the line and it can wrap (no horizontal scroll at any width)', () => {
    const { container } = renderWithProviders(<Footer variant="home" />);
    const line = screen.getByText('Not for emergencies — call your local emergency number.');
    expect(line).toBeVisible();
    const row = line.parentElement as HTMLElement;
    expect(row.className).toContain('flex-wrap');
    expect(container.innerHTML).not.toContain('whitespace-nowrap');
    expect(container.innerHTML).not.toContain('overflow-x');
  });
});

describe('home-landing-page › Metadata', () => {
  it('title, description, absolute canonical and hreflang alternates (with x-default) for the home page', async () => {
    vi.stubEnv('SITE_URL', 'https://malva.example/');
    const metadata = await generateMetadata({ params });
    expect(metadata.title).toBe(h.metaTitle);
    expect(metadata.description).toBe(h.metaDescription);
    expect(metadata.alternates?.canonical).toBe('https://malva.example/en-US');
    expect(metadata.alternates?.languages).toEqual({ 'en-US': 'https://malva.example/en-US', 'x-default': 'https://malva.example/en-US' });
    expect(metadata.robots).toBeUndefined();
  });

  it('the description makes no claim the service cannot back (no numbers, no emergency care)', () => {
    expect(h.metaDescription).not.toMatch(/\d|emergenc|24\/7|minutes/i);
  });
});

// Routes of other workstreams that may not be merged yet (see lib/routes.test.ts for the same exemption).
const OTHER_WORKSTREAMS = ['/prescriptions', '/account', '/account/labs', '/doctor/'];
const appDir = join(import.meta.dirname);

function pageSegments(): string[][] {
  const out: string[][] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else if (entry.name === 'page.tsx') out.push(relative(appDir, dir).split(sep).filter(Boolean));
    }
  };
  walk(appDir);
  return out;
}

function routeExists(path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  return pageSegments().some((p) => p.length === parts.length && p.every((s, i) => /^\[[^\]]+\]$/.test(s) || s === parts[i]));
}

describe('design-home-page › links go to routes that exist', () => {
  it('every href on the page resolves to a page (routes of other workstreams are exempt until merged)', async () => {
    const { container } = await renderHome();
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => (a.getAttribute('href') ?? '').replace(/^\/en-US/, '').split('?')[0] || '/');
    expect(hrefs.length).toBeGreaterThan(8);
    for (const href of hrefs) {
      if (OTHER_WORKSTREAMS.some((p) => href === p || (p.endsWith('/') && href.startsWith(p)))) continue;
      expect(routeExists(href) || href === '/search', href).toBe(true);
    }
  });

  it('the home page route itself exists and no placeholder literal ("2M+", "15 min", "8,000") is rendered', async () => {
    const { container } = await renderHome();
    expect(container.textContent).not.toMatch(/2M\+|8,000|15 min|Rx #/);
  });
});

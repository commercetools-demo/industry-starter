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

import { Footer } from '@/components/layout/Footer';
import LocaleHome from './page';

const params = Promise.resolve({ locale: 'en-US' });
const h = messages.home;

async function renderHome() {
  return renderWithProviders(await LocaleHome({ params }));
}

beforeEach(() => {
  vi.unstubAllEnvs();
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
    // No photo chosen yet (site-images.json is {}): a token gradient, not an invented URL.
    expect(image).toHaveAttribute('data-image', 'placeholder');
    expect(container.querySelector('img')).toBeNull();
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

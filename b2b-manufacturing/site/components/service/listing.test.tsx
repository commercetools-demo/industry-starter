import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en-US.json';
import deMessages from '@/messages/de-DE.json';
import { fakeGetTranslations, plumbingServices, wasteServices } from './test-fixtures';

const getServicesByCategory = vi.fn();
vi.mock('next-intl/server', () => ({ getTranslations: (a: never) => fakeGetTranslations(a), setRequestLocale: vi.fn() }));
vi.mock('@/lib/ct/services', () => ({ getServicesByCategory: (...a: unknown[]) => getServicesByCategory(...a), getAllServices: vi.fn(), getServiceBySlug: vi.fn(), getRelatedServices: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), usePathname: () => '/en-US/plumbing', useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }) }));

const { ListingPage, listingMetadata } = await import('./ListingPage');
const { sectorFilterUseful } = await import('./SectorFilter');
const plumbingRoute = await import('@/app/[locale]/plumbing/page');
const wasteSectorRoute = await import('@/app/[locale]/waste-management/sector/[sector]/page');

const Wrap = ({ children, locale = 'en-US' }: { children: ReactNode; locale?: string }) => (
  <NextIntlClientProvider locale={locale} messages={locale === 'de-DE' ? deMessages : enMessages}>{children}</NextIntlClientProvider>
);
const show = async (props: Omit<Parameters<typeof ListingPage>[0], 'services'>, locale = 'en-US') => {
  const ui = await ListingPage({ ...props, services: (await getServicesByCategory(props.category, props.locale)) as never });
  return render(<Wrap locale={locale}>{ui}</Wrap>);
};
const cards = () => within(screen.getByTestId('service-grid')).getAllByRole('article');

beforeEach(() => { getServicesByCategory.mockReset(); });

describe('malva-service-listing › Plumbing listing', () => {
  it('Listing content: five cards in order, each with number, name, description and Learn more', async () => {
    getServicesByCategory.mockResolvedValue(plumbingServices);
    const { container } = await show({ category: 'plumbing', locale: 'en-US' });
    expect(getServicesByCategory).toHaveBeenCalledWith('plumbing', 'en-US');
    expect(cards().map((c) => within(c).getByRole('heading').textContent)).toEqual(plumbingServices.map((s) => s.name));
    const first = cards()[0]!;
    expect(first).toHaveTextContent('01');
    expect(first).toHaveTextContent('one sentence description');
    expect(first).toHaveTextContent('Learn more');
    expect(screen.getByRole('heading', { level: 1, name: 'Plumbing services' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How planned maintenance works' })).toBeInTheDocument();
    expect(container.querySelectorAll('ul.chk li')).toHaveLength(4);
    expect(screen.getByText('Need a survey or planned maintenance contract?')).toBeInTheDocument();
  });
  it('Unpublished service: the service is absent and the numbering stays continuous', async () => {
    getServicesByCategory.mockResolvedValue(plumbingServices.filter((s) => s.name !== 'Backflow & water testing'));
    await show({ category: 'plumbing', locale: 'en-US' });
    expect(cards()).toHaveLength(4);
    expect(screen.queryByText('Backflow & water testing')).not.toBeInTheDocument();
    expect(cards().map((c) => c.querySelector('.num')?.textContent)).toEqual(['01', '02', '03', '04']);
  });
});

describe('malva-service-listing › Waste management listing', () => {
  it('Listing content: seven cards in order', async () => {
    getServicesByCategory.mockResolvedValue(wasteServices);
    await show({ category: 'waste-management', locale: 'en-US' });
    expect(cards()).toHaveLength(7);
    expect(cards().map((c) => within(c).getByRole('heading').textContent)).toEqual(wasteServices.map((s) => s.name));
    expect(screen.getByRole('heading', { level: 1, name: 'Waste management services' })).toBeInTheDocument();
  });
  it('Compliance band: "Compliance, documented" with two lists of three checks', async () => {
    getServicesByCategory.mockResolvedValue(wasteServices);
    await show({ category: 'waste-management', locale: 'en-US' });
    const band = screen.getByTestId('compliance-band');
    expect(within(band).getByRole('heading', { name: 'Compliance, documented' })).toBeInTheDocument();
    expect(within(band).getByText('Every collection is tracked from your site to final disposal.')).toBeInTheDocument();
    expect(band.querySelectorAll('ul.chk')).toHaveLength(2);
    expect(band.querySelectorAll('ul.chk li')).toHaveLength(6);
  });
});

describe('malva-service-listing › Cards lead to the service detail page', () => {
  it('Open a service: the card links to /<category>/<slug>, and the trail returns to the listing', async () => {
    getServicesByCategory.mockResolvedValue(plumbingServices);
    await show({ category: 'plumbing', locale: 'en-US' });
    expect(within(cards()[1]!).getByRole('link')).toHaveAttribute('href', '/en-US/plumbing/drain-cleaning-and-cctv-survey');
    const crumb = screen.getByRole('navigation', { name: 'Plumbing' });
    expect(within(crumb).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en-US');
    expect(within(crumb).getByText('Plumbing')).toHaveAttribute('aria-current', 'page');
  });
  it('Screen reader name: the accessible name is the service name and the number is hidden', async () => {
    getServicesByCategory.mockResolvedValue(plumbingServices);
    await show({ category: 'plumbing', locale: 'en-US' });
    expect(screen.getByRole('link', { name: 'Pipe installation & repair' })).toBeInTheDocument();
    expect(cards()[0]!.querySelector('.num')).toHaveAttribute('aria-hidden', 'true');
    expect(within(screen.getByTestId('service-grid')).getAllByRole('link')).toHaveLength(plumbingServices.length);
  });
  it('has no accessibility violations', async () => {
    getServicesByCategory.mockResolvedValue(wasteServices);
    const { container } = await show({ category: 'waste-management', locale: 'en-US' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('malva-service-listing › Optional sector filter', () => {
  it('Filter by sector: only tagged services, the active filter is shown and removable, the URL reproduces it', async () => {
    getServicesByCategory.mockResolvedValue(wasteServices);
    await show({ category: 'waste-management', locale: 'en-US', sector: 'healthcare' });
    const names = cards().map((c) => within(c).getByRole('heading').textContent);
    expect(names).not.toContain('Liquid waste & tankering');
    expect(names).toContain('Medical / clinical waste');
    expect(cards()[0]!.querySelector('.num')).toHaveTextContent('01');
    expect(screen.getByTestId('sector-active')).toHaveTextContent('Healthcare');
    expect(screen.getByRole('link', { name: 'Clear filter' })).toHaveAttribute('href', '/en-US/waste-management');
    expect(screen.getByRole('link', { name: 'Healthcare' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Healthcare' })).toHaveAttribute('href', '/en-US/waste-management?sector=healthcare');
  });
  it('Filter with no match: says so and offers to clear the filter and to request a quote', async () => {
    getServicesByCategory.mockResolvedValue(wasteServices);
    await show({ category: 'waste-management', locale: 'en-US', sector: 'aviation' });
    const box = screen.getByTestId('no-match');
    expect(within(box).getByText('No services match this sector.')).toBeInTheDocument();
    expect(within(box).getByRole('link', { name: 'Clear filter' })).toHaveAttribute('href', '/en-US/waste-management');
    expect(within(box).getByRole('link', { name: 'Request a quote' })).toHaveAttribute('href', '/en-US/request-a-quote');
    expect(screen.queryByTestId('service-grid')).not.toBeInTheDocument();
  });
  it('shows the control only when at least two sectors give different results', async () => {
    getServicesByCategory.mockResolvedValue(plumbingServices);
    expect(sectorFilterUseful(plumbingServices)).toBe(false);
    await show({ category: 'plumbing', locale: 'en-US' });
    expect(screen.queryByTestId('sector-filter')).not.toBeInTheDocument();
    expect(sectorFilterUseful(wasteServices)).toBe(true);
  });
  it('the sector route is statically generated for every locale and sector and renders the filtered page', async () => {
    const params = (wasteSectorRoute.generateStaticParams as () => unknown[])();
    expect(params).toHaveLength(8);
    getServicesByCategory.mockResolvedValue(wasteServices);
    const page = await wasteSectorRoute.default({ params: Promise.resolve({ locale: 'de-DE', sector: 'healthcare' }) });
    expect(getServicesByCategory).toHaveBeenCalledWith('waste-management', 'de-DE');
    const ui = await ListingPage(page.props);
    render(<Wrap locale="de-DE">{ui}</Wrap>);
    expect(screen.getByRole('heading', { level: 1, name: 'Abfallmanagement-Leistungen' })).toBeInTheDocument();
    expect(wasteSectorRoute.revalidate).toBe(60);
  });
});

describe('malva-service-listing › Listing is public, cacheable and navigable', () => {
  it('Empty category: the header remains and the body offers a quote', async () => {
    getServicesByCategory.mockResolvedValue([]);
    await show({ category: 'plumbing', locale: 'en-US' });
    expect(screen.getByRole('heading', { level: 1, name: 'Plumbing services' })).toBeInTheDocument();
    const box = screen.getByTestId('empty-category');
    expect(within(box).getByText('No services are listed here yet.')).toBeInTheDocument();
    expect(within(box).getByRole('link', { name: 'Request a quote' })).toBeInTheDocument();
  });
  it('is revalidated, reads no session, and has unique localized metadata with an absolute canonical', async () => {
    expect(plumbingRoute.revalidate).toBe(60);
    const en = await listingMetadata('plumbing', 'en-US');
    const de = await listingMetadata('waste-management', 'de-DE');
    const waste = await listingMetadata('waste-management', 'en-US');
    expect(en.title).not.toEqual(waste.title);
    expect(JSON.stringify(de.title)).toMatch(/Abfall/);
    expect(en.alternates?.canonical).toMatch(/^https?:\/\/.+\/en-US\/plumbing$/);
    expect(Object.keys(en.alternates?.languages ?? {})).toEqual(['en-US', 'de-DE', 'x-default']);
  });
});

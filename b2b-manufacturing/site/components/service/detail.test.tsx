import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en-US.json';
import deMessages from '@/messages/de-DE.json';
import type { Service } from '@/lib/types';
import { allServices, fakeGetTranslations, plumbingServices, wasteServices } from './test-fixtures';

const getServiceBySlug = vi.fn();
const getAllServices = vi.fn();
const getRelatedServices = vi.fn();
const push = vi.fn();
class NotFound extends Error {}
vi.mock('next-intl/server', () => ({ getTranslations: (a: never) => fakeGetTranslations(a), setRequestLocale: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound: () => { throw new NotFound('NEXT_NOT_FOUND'); }, usePathname: () => '/en-US/plumbing/x', useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }) }));
vi.mock('@/lib/ct/services', () => ({ getServiceBySlug: (...a: unknown[]) => getServiceBySlug(...a), getAllServices: (...a: unknown[]) => getAllServices(...a), getRelatedServices: (...a: unknown[]) => getRelatedServices(...a), getServicesByCategory: vi.fn() }));

const { ServiceDetail, detailMetadata } = await import('./ServiceDetail');
const plumbingRoute = await import('@/app/[locale]/plumbing/[slug]/page');
const wasteRoute = await import('@/app/[locale]/waste-management/[slug]/page');

const drain = plumbingServices[1]!;
const Wrap = ({ children, locale = 'en-US' }: { children: ReactNode; locale?: string }) => (
  <NextIntlClientProvider locale={locale} messages={locale === 'de-DE' ? deMessages : enMessages}>
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
  </NextIntlClientProvider>
);
const show = async (service: Service, related: Service[] = [], locale = 'en-US') => {
  const ui = await ServiceDetail({ service, locale, category: service.category, related });
  return render(<Wrap locale={locale}>{ui}</Wrap>);
};
const stubFetch = (handler: (url: string, init?: RequestInit) => Response) => vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => handler(url, init)));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => { push.mockReset(); getServiceBySlug.mockReset(); getAllServices.mockReset(); stubFetch(() => json({}, 404)); });
afterEach(() => vi.unstubAllGlobals());

describe('malva-service-detail › Each service has a detail page', () => {
  it('Open a service: every block that has content is shown, and no price, tax or total appears', async () => {
    const { container } = await show(drain, [plumbingServices[2]!]);
    expect(screen.getByRole('heading', { level: 1, name: drain.name })).toBeInTheDocument();
    for (const h of ["What's included", "Who it's for", 'How it works', 'Compliance and records', 'Frequently asked questions', 'Related services']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    const html = container.innerHTML;
    expect(html).not.toMatch(/[£$€]/);
    expect(html).not.toMatch(/\b(price|total|VAT|tax)\b/i);
  });
  it('omits each block whose data is empty', async () => {
    await show({ ...drain, included: [], sectors: [], steps: [], records: [], faq: [] });
    for (const h of ["What's included", "Who it's for", 'How it works', 'Compliance and records', 'Frequently asked questions', 'Related services']) expect(screen.queryByRole('heading', { name: h })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
  it('shows the trail Home / category / service, and the FAQ is native details', async () => {
    const { container } = await show(drain);
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumb).getByRole('link', { name: 'Plumbing' })).toHaveAttribute('href', '/en-US/plumbing');
    expect(within(crumb).getByText(drain.name)).toHaveAttribute('aria-current', 'page');
    expect(container.querySelectorAll('details > summary')).toHaveLength(1);
  });
  it('Unknown or unpublished service: not found for an unknown slug and for a slug under the wrong category', async () => {
    getServiceBySlug.mockResolvedValue(null);
    await expect(plumbingRoute.default({ params: Promise.resolve({ locale: 'en-US', slug: 'nope' }) })).rejects.toBeInstanceOf(NotFound);
    getServiceBySlug.mockResolvedValue(wasteServices[0]);
    await expect(plumbingRoute.default({ params: Promise.resolve({ locale: 'en-US', slug: wasteServices[0]!.slug }) })).rejects.toBeInstanceOf(NotFound);
    await expect(wasteRoute.default({ params: Promise.resolve({ locale: 'en-US', slug: wasteServices[0]!.slug }) })).resolves.toBeTruthy();
    expect(await plumbingRoute.generateMetadata({ params: Promise.resolve({ locale: 'en-US', slug: wasteServices[0]!.slug }) })).toEqual({});
  });
  it('the not-found page links to both listings', async () => {
    const NotFoundPage = (await import('@/app/[locale]/not-found')).default;
    render(<Wrap>{await NotFoundPage()}</Wrap>);
    expect(screen.getByRole('link', { name: 'Plumbing services' })).toHaveAttribute('href', '/en-US/plumbing');
    expect(screen.getByRole('link', { name: 'Waste management services' })).toHaveAttribute('href', '/en-US/waste-management');
  });
  it('generates static params for its own category in every locale and survives a catalog failure', async () => {
    getAllServices.mockResolvedValue(allServices);
    const params = await plumbingRoute.generateStaticParams();
    expect(params).toHaveLength(10);
    expect(params.every((p) => allServices.some((s) => s.slug === p.slug && s.category === 'plumbing'))).toBe(true);
    getAllServices.mockRejectedValue(new Error('down'));
    expect(await wasteRoute.generateStaticParams()).toEqual([]);
    expect(plumbingRoute.revalidate).toBe(60);
  });
  it('has no accessibility violations', async () => {
    const { container } = await show(drain, [plumbingServices[2]!]);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('malva-service-detail › Request a quote for this service', () => {
  it('Preselected service: the primary action links to the form with this service', async () => {
    await show(drain);
    expect(screen.getAllByRole('link', { name: 'Request a quote for this service' })[0]).toHaveAttribute('href', `/en-US/request-a-quote?service=${drain.slug}`);
  });
  it('Small screen: the action card precedes the long content in tab order and a sticky bar repeats the action', async () => {
    const { container } = await show(drain, [plumbingServices[2]!]);
    const links = screen.getAllByRole('link', { name: 'Request a quote for this service' });
    expect(links).toHaveLength(2);
    const long = screen.getByRole('heading', { name: "What's included" });
    expect(links[0]!.compareDocumentPosition(long) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('sticky-bar')).toContainElement(links[1]!);
    expect(container.querySelector('.pdp-aside')!.compareDocumentPosition(container.querySelector('.pdp-main')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('shows phone, response promise and emergency note in German too', async () => {
    await show(drain, [], 'de-DE');
    expect(screen.getByText('Wir antworten innerhalb eines Werktags.')).toBeInTheDocument();
    expect(screen.getByText(/Notdienst/)).toBeInTheDocument();
  });
});

describe('malva-service-detail › Add the service to the quote list', () => {
  it('Add: posts { serviceId } and switches to the added state with a link to the list', async () => {
    let body: unknown;
    stubFetch((url, init) => {
      if (url === '/api/quote-list/lines') { body = JSON.parse(String(init?.body)); return json({ id: 'q', count: 1, lines: [{ id: 'l1', serviceId: drain.id, slug: drain.slug, name: drain.name, quantity: 1 }] }); }
      return json({ id: null, lines: [], count: 0 });
    });
    await show(drain);
    await userEvent.click(await screen.findByRole('button', { name: 'Add to quote list' }));
    expect(await screen.findByTestId('quote-list-added')).toHaveTextContent('Added to your quote list');
    expect(body).toEqual({ serviceId: drain.id });
    expect(screen.getByRole('link', { name: 'View quote list' })).toHaveAttribute('href', '/en-US/quote-list');
  });
  it('sends the chosen frequency', async () => {
    let body: unknown;
    stubFetch((url, init) => { if (url === '/api/quote-list/lines') { body = JSON.parse(String(init?.body)); return json({ id: 'q', count: 1, lines: [] }); } return json({ id: null, lines: [], count: 0 }); });
    await show(drain);
    await userEvent.selectOptions(screen.getByLabelText('Frequency (optional)'), 'annual');
    await userEvent.click(screen.getByRole('button', { name: 'Add to quote list' }));
    await waitFor(() => expect(body).toEqual({ serviceId: drain.id, frequency: 'annual' }));
  });
  it('Already added: the added state is shown and there is no add button, so no duplicate can be sent', async () => {
    stubFetch(() => json({ id: 'q', count: 1, lines: [{ id: 'l1', serviceId: drain.id, slug: drain.slug, name: drain.name, quantity: 1 }] }));
    await show(drain);
    expect(await screen.findByTestId('quote-list-added')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to quote list' })).not.toBeInTheDocument();
  });
  it('falls back to the quote form with the service preselected while the quote-list API does not exist (404)', async () => {
    await show(drain);
    await userEvent.click(await screen.findByRole('button', { name: 'Add to quote list' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/en-US/request-a-quote?service=${drain.slug}`));
  });
  it('shows an error when the API answers with a failure message', async () => {
    stubFetch((url) => (url === '/api/quote-list/lines' ? json({ error: 'Boom' }, 500) : json({ id: null, lines: [], count: 0 })));
    await show(drain);
    await userEvent.click(await screen.findByRole('button', { name: 'Add to quote list' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not add this service');
    expect(push).not.toHaveBeenCalled();
  });
});

describe('malva-service-detail › Related services', () => {
  it('Fewer than three related: one card and no empty slots', async () => {
    await show(drain, [plumbingServices[2]!]);
    const grid = screen.getByTestId('related-services');
    expect(within(grid).getAllByRole('link')).toHaveLength(1);
    expect(grid.children).toHaveLength(1);
  });
  it('shows at most three and never the current service', async () => {
    await show(drain, [drain, ...plumbingServices.filter((s) => s !== drain), wasteServices[0]!]);
    const links = within(screen.getByTestId('related-services')).getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.getAttribute('href'))).not.toContain(`/en-US/plumbing/${drain.slug}`);
  });
  it('shows no related section when there is no relation', async () => {
    await show(drain, []);
    expect(screen.queryByTestId('related-services')).not.toBeInTheDocument();
  });
});

describe('malva-service-detail › Search-engine and sharing metadata', () => {
  const ld = (c: HTMLElement) => [...c.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent ?? ''));
  it('Structured data: Service with provider Malva, serviceType and areaServed, and a breadcrumb matching the trail', async () => {
    const { container } = await show(drain);
    const [service, crumbs] = ld(container);
    expect(service).toMatchObject({ '@type': 'Service', name: drain.name, provider: { '@type': 'Organization', name: 'Malva' }, serviceType: 'Plumbing', areaServed: { name: 'US' } });
    expect(service).not.toHaveProperty('offers');
    expect(crumbs['@type']).toBe('BreadcrumbList');
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(['Home', 'Plumbing', drain.name]);
    expect(crumbs.itemListElement[2].item).toMatch(/^https?:\/\/.+\/en-US\/plumbing\//);
  });
  it('names Germany for the German locale', async () => {
    const { container } = await show(drain, [], 'de-DE');
    expect(ld(container)[0].areaServed.name).toBe('DE');
    expect(ld(container)[0].serviceType).toBe('Sanitär');
  });
  it('gives each of the 12 services a unique title and description with an absolute canonical', async () => {
    for (const locale of ['en-US', 'de-DE']) {
      const metas = await Promise.all(allServices.map((s) => detailMetadata(s, locale)));
      expect(new Set(metas.map((m) => m.title)).size).toBe(12);
      expect(new Set(metas.map((m) => m.description)).size).toBe(12);
      expect(metas[0]!.alternates?.canonical).toMatch(new RegExp(`^https?://.+/${locale}/plumbing/`));
    }
  });
});

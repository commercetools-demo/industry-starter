import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import deMessages from '@/messages/de-DE.json';
import messages from '@/messages/en-US.json';
import { getSiteImage } from '@/content/images';
import type { Accreditation, Audience, Stat, Testimonial } from '@/content/schema';
import accreditationsJson from '@/content/accreditations.json';
import audiencesJson from '@/content/audiences.json';
import statsJson from '@/content/stats.json';
import testimonialsJson from '@/content/testimonials.json';

vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), usePathname: () => '/en-US', useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useParams: () => ({ locale: 'en-US' }) }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (arg: string | { locale: string; namespace: string }) => {
    const { locale, namespace } = typeof arg === 'string' ? { locale: 'en-US', namespace: arg } : arg;
    return createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : messages, namespace: namespace as 'home' });
  },
}));

const { Hero } = await import('./Hero');
const { Pillars } = await import('./Pillars');
const { StatsBand } = await import('./StatsBand');
const { Audiences } = await import('./Audiences');
const { Proof } = await import('./Proof');
const { default: HomePage, generateMetadata } = await import('@/app/[locale]/page');

const stats = statsJson as Stat[];
const audiences = audiencesJson as Audience[];
const accreditations = accreditationsJson as Accreditation[];
const testimonials = testimonialsJson as Testimonial[];
const Providers = ({ children, locale = 'en-US', msgs = messages }: { children: ReactNode; locale?: string; msgs?: typeof messages }) => <NextIntlClientProvider locale={locale} messages={msgs}>{children}</NextIntlClientProvider>;
const show = (ui: ReactNode, locale?: string, msgs?: typeof messages) => render(<Providers locale={locale} msgs={msgs}>{ui}</Providers>);

describe('malva-homepage › Homepage presents both services and a quote path', () => {
  it('First view: headline, promise, Request a quote and Explore services', () => {
    show(<Hero image={getSiteImage('home-hero')} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Plumbing and waste management for sites that can't stop.");
    expect(screen.getByText(/One contract for pipework, drains and waste/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a quote' })).toHaveAttribute('href', '/en-US/request-a-quote');
    expect(screen.getByRole('link', { name: 'Explore services' })).toHaveAttribute('href', '/en-US/plumbing');
  });
  it('Choosing a service line: the two cards link to the listings', () => {
    show(<Pillars plumbingImage={getSiteImage('pillar-plumbing')} wasteImage={getSiteImage('pillar-waste')} />);
    expect(screen.getByRole('link', { name: /Plumbing/ })).toHaveAttribute('href', '/en-US/plumbing');
    expect(screen.getByRole('link', { name: /Waste management/ })).toHaveAttribute('href', '/en-US/waste-management');
  });
});

describe('malva-homepage › Homepage speaks to each audience', () => {
  it('Audience cards: exactly four, in order', () => {
    show(<Audiences items={audiences} />);
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['Facilities managers', 'Manufacturers', 'Property & real estate', 'Healthcare']);
  });
  it('Audience card opens a prefilled quote: each link carries its sector', () => {
    show(<Audiences items={audiences} />);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['facilities', 'manufacturing', 'property', 'healthcare'].map((s) => `/en-US/request-a-quote?sector=${s}`));
  });
});

describe('malva-homepage › Proof content is managed and never rendered empty', () => {
  it('No testimonials published: the block is absent and the rest is unchanged', () => {
    const { container } = show(<Proof accreditations={accreditations} testimonials={[]} />);
    expect(screen.queryByRole('figure')).toBeNull();
    expect(screen.getByText('ISO 9001')).toBeInTheDocument();
    expect(container.querySelector('.grid')).toBeNull();
  });
  it('omits every section whose content is empty', () => {
    const { container } = show(<><StatsBand items={[]} /><Audiences items={[]} /><Proof accreditations={[]} testimonials={[]} /></>);
    expect(container.querySelector('section')).toBeNull();
  });
  it('Sample content is labelled: stats, accreditations and testimonials show the marker; confirmed items do not', () => {
    show(<><StatsBand items={stats} /><Proof accreditations={accreditations} testimonials={testimonials} /></>);
    expect(screen.getAllByText('Sample content')).toHaveLength(stats.length + accreditations.length + testimonials.length);
  });
  it('shows no marker once items are confirmed', () => {
    show(<StatsBand items={stats.map((s) => ({ ...s, sample: false }))} />);
    expect(screen.queryByText('Sample content')).toBeNull();
    expect(screen.getByText('98.6%')).toBeInTheDocument();
  });
  it('renders German text and marker for de-DE', () => {
    show(<StatsBand items={stats} />, 'de-DE', deMessages as typeof messages);
    expect(screen.getByText('Garantierte Reaktionszeit im Notfall')).toBeInTheDocument();
    expect(screen.getAllByText('Beispielinhalt')).toHaveLength(stats.length);
  });
});

describe('malva-homepage › Homepage performance and discoverability', () => {
  const render2 = async () => {
    const { container, unmount } = show(await HomePage({ params: Promise.resolve({ locale: 'en-US' }) }));
    const html = container.innerHTML;
    unmount();
    return html;
  };
  it('Cached delivery: output is identical for an anonymous and a signed-in visitor (no session read)', async () => {
    const anonymous = await render2();
    // A signed-in visitor has a session cookie; the page must not read it, so nothing differs.
    document.cookie = 'mpw_session=signed-in-client';
    const signedIn = await render2();
    expect(signedIn).toBe(anonymous);
  });
  it('page and its components never import the session, cookies or headers', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const sources = [readFileSync('app/[locale]/page.tsx', 'utf8'), ...readdirSync('components/home').filter((f) => /^[A-Z].*\.tsx$/.test(f)).map((f) => readFileSync(`components/home/${f}`, 'utf8'))].join('\n');
    expect(sources).not.toMatch(/lib\/session|next\/headers|cookies\(|headers\(/);
  });
  it('has exactly one h1 and sections use h2', async () => {
    show(await HomePage({ params: Promise.resolve({ locale: 'en-US' }) }));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(5);
  });
  it('hero image is priority-loaded with explicit size, sizes and no layout shift', () => {
    const { container } = show(<Hero image={getSiteImage('home-hero')} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('width');
    expect(img).toHaveAttribute('height');
    expect(img).toHaveAttribute('sizes', '100vw');
    expect(img).not.toHaveAttribute('loading', 'lazy');
    expect(img.getAttribute('src')).not.toMatch(/\?[^u]*$|#/);
  });
  it('has a unique title and description in each language, and a canonical', async () => {
    const en = await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }) });
    const de = await generateMetadata({ params: Promise.resolve({ locale: 'de-DE' }) });
    expect(en.description).toBeTruthy();
    expect(en.description).not.toBe(de.description);
    expect(JSON.stringify(en.title)).not.toBe(JSON.stringify(de.title));
    expect(en.alternates?.canonical).toMatch(/\/en-US$/);
  });
  it('has no accessibility violations', async () => {
    const { container } = show(await HomePage({ params: Promise.resolve({ locale: 'en-US' }) }));
    expect(await axe(container)).toHaveNoViolations();
  });
  it('shows no price anywhere', async () => {
    const { container } = show(await HomePage({ params: Promise.resolve({ locale: 'en-US' }) }));
    expect(within(container).queryByText(/[$€£]\s?\d/)).toBeNull();
  });
});

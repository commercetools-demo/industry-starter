import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import RatingSummary from '@/components/pdp/RatingSummary';
import ReviewsSlot from '@/components/pdp/ReviewsSlot';
import TrustRow from '@/components/pdp/TrustRow';
import { accessoryPage, machinePage, podPage, renderPdp, usd } from '@/test/pdp';
import enUS from '@/messages/en-US.json';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const intl = (ui: React.ReactElement) => render(<NextIntlClientProvider locale="en-US" messages={enUS}>{ui}</NextIntlClientProvider>);
const section = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

describe('accordions', () => {
  it('Details open by default, the others closed', async () => {
    await renderPdp(podPage());
    expect(section('Details')).toHaveAttribute('aria-expanded', 'true');
    expect(section('Brewing and care')).toHaveAttribute('aria-expanded', 'false');
    expect(section('Shipping and collection')).toHaveAttribute('aria-expanded', 'false');
  });

  it('Accordion toggles with chevron and animation class (the class is switched off by the reduced-motion rule in motion.css)', async () => {
    const user = userEvent.setup();
    await renderPdp(podPage());
    const brewing = section('Brewing and care');
    const panel = document.getElementById(brewing.getAttribute('aria-controls') as string) as HTMLElement;
    expect(panel).toHaveAttribute('hidden');
    expect(panel.className).not.toContain('fade-up');
    expect(brewing.querySelector('svg')?.getAttribute('class')).not.toContain('rotate-90');
    await user.click(brewing);
    expect(brewing).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveAttribute('hidden');
    expect(panel.className).toContain('fade-up');
    expect(brewing.querySelector('svg')?.getAttribute('class')).toContain('rotate-90');
    expect(within(panel).getByText(/Descale your machine every three months/)).toBeInTheDocument();
    await user.click(brewing);
    expect(panel).toHaveAttribute('hidden');
  });

  it('the reduced-motion rule exists for the animation utility', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('app/motion.css', 'utf8');
    expect(css).toMatch(/@utility fade-up \{[\s\S]*prefers-reduced-motion: no-preference/);
  });

  it('Details lists the facts and the machine specification rows with units', async () => {
    await renderPdp(machinePage('vertuo'));
    const details = document.getElementById(section('Details').getAttribute('aria-controls') as string) as HTMLElement;
    expect(within(details).getByText('Pressure').nextSibling).toHaveTextContent('19 bar');
    expect(within(details).getByText('Warranty').nextSibling).toHaveTextContent('24 months');
    expect(within(details).queryByText('Origin')).toBeNull();
  });

  it('Details of a pod show origin, notes, roast and intensity, and link to the other system', async () => {
    await renderPdp(podPage());
    const details = document.getElementById(section('Details').getAttribute('aria-controls') as string) as HTMLElement;
    expect(within(details).getByText('Origin').nextSibling).toHaveTextContent('Brazil');
    expect(within(details).getByText('Flavor notes').nextSibling).toHaveTextContent('dark chocolate, oak');
    expect(within(details).getByText('Intensity').nextSibling).toHaveTextContent('12 / 13');
    expect(within(details).getByRole('link', { name: 'Looking for Vertuo capsules?' })).toHaveAttribute('href', '/category/vertuo-pods');
  });

  it('the care text follows the product shape', async () => {
    const user = userEvent.setup();
    await renderPdp(accessoryPage());
    await user.click(section('Brewing and care'));
    expect(screen.getByText(/Hand wash with mild soap/)).toBeInTheDocument();
  });

  it('shipping text uses the live threshold and minutes', async () => {
    const user = userEvent.setup();
    await renderPdp(podPage({ freeShippingThreshold: usd(9900), returnDays: 14 }), { selectedKey: 'mcf-store-nyc-soho' });
    await user.click(section('Shipping and collection'));
    const text = screen.getByTestId('pdp-shipping-text');
    expect(text).toHaveTextContent('Free delivery over $99.00.');
    expect(text).toHaveTextContent('Standard delivery in 2 to 4 business days.');
    expect(text).toHaveTextContent('Collect in store, ready in about 15 minutes.');
    expect(text).toHaveTextContent('Returns accepted within 14 days.');
  });

  it('shipping text omits collection in Canada and the threshold when there is none', async () => {
    const user = userEvent.setup();
    await renderPdp(podPage({ collection: false, freeShippingThreshold: null }), { locale: 'en-CA' });
    await user.click(section('Shipping and collection'));
    const text = screen.getByTestId('pdp-shipping-text');
    expect(text).not.toHaveTextContent('Collect in store');
    expect(text).not.toHaveTextContent('Free delivery over');
  });
});

describe('trust row', () => {
  it('trust row uses the market return days', () => {
    intl(<TrustRow returnDays={30} />);
    const row = screen.getByTestId('pdp-trust');
    expect(within(row).getByText('30-day returns')).toBeInTheDocument();
    expect(within(row).getByText('Quality guarantee')).toBeInTheDocument();
    expect(within(row).getByText('Responsibly sourced')).toBeInTheDocument();
    expect(row.textContent).not.toContain('90');
  });
});

describe('rating summary', () => {
  it('rating summary shows average count and distribution', () => {
    intl(<RatingSummary rating={{ average: 4.5, count: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 2 } }} />);
    const summary = screen.getByTestId('rating-summary');
    expect(summary).toHaveAttribute('id', 'reviews');
    expect(within(summary).getByText('4.5')).toBeInTheDocument();
    expect(within(summary).getByText('4 reviews')).toBeInTheDocument();
    const rows = within(summary).getAllByRole('listitem');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      '5 stars: 2 reviews', '4 stars: 2 reviews', '3 stars: 0 reviews', '2 stars: 0 reviews', '1 stars: 0 reviews',
    ]);
    const fill = rows[0]?.querySelector('span[style]') as HTMLElement;
    expect(fill.style.width).toBe('50%');
    expect((rows[2]?.querySelector('span[style]') as HTMLElement).style.width).toBe('0%');
  });

  it('no reviews offers Be the first to review', () => {
    intl(<RatingSummary rating={null} />);
    expect(screen.getByText('Be the first to review')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('a single review reads in the singular', () => {
    intl(<RatingSummary rating={{ average: 5, count: 1, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } }} />);
    expect(screen.getByText('1 review')).toBeInTheDocument();
  });
});

describe('reviews slot', () => {
  it('reviews slot renders nothing until M', () => {
    const { container } = render(<ReviewsSlot productId="p-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('the page has the rating summary and no placeholder text for reviews', async () => {
    await renderPdp(podPage());
    expect(screen.getByTestId('rating-summary')).toBeInTheDocument();
    expect(screen.queryByText(/Reviews will appear here/)).toBeNull();
  });
});

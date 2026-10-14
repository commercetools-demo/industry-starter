// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FitBanner } from '@/components/vehicle/FitBanner';
import { installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';
import { Breadcrumb } from './Breadcrumb';
import { Gallery } from './Gallery';
import { Identity } from './Identity';
import { PriceBlock } from './PriceBlock';
import { detail, GOLF_2016, GOLF_2022 } from './test-fixtures';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/mau-reseller-north/p/x',
}));
afterEach(() => vi.unstubAllGlobals());

const render = (ui: ReactNode) => renderVehicle(ui as never, { locale: 'en-US' });

describe('Gallery', () => {
  it('thumbnails switch the main image', async () => {
    const user = userEvent.setup();
    render(<Gallery images={detail().images} />);
    const main = () => screen.getAllByRole('img').find((i) => i.getAttribute('alt') !== '') as HTMLElement;
    expect(main()).toHaveAttribute('alt', 'Front view');
    await user.click(screen.getByRole('button', { name: 'Show image 2' }));
    expect(main()).toHaveAttribute('alt', 'Side view');
    expect(screen.getByRole('button', { name: 'Show image 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Show image 1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('arrow keys move between thumbnails and Enter switches', async () => {
    const user = userEvent.setup();
    render(<Gallery images={detail().images} />);
    screen.getByRole('button', { name: 'Show image 1' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Show image 2' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Show image 2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('one image has no thumbnails', () => {
    render(<Gallery images={detail().images.slice(0, 1)} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('no image keeps the frame and says no photo', () => {
    render(<Gallery images={[]} />);
    expect(screen.getByText('No photo')).toBeInTheDocument();
  });
});

describe('Identity and breadcrumb', () => {
  it('h1 is the product name, with the eyebrow, part number and rating', () => {
    render(<Identity name="Vektra pads" brand="Vektra" qualityLabel="OEM" partNumber="BP-1" rating={{ average: 4.6, count: 128 }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Vektra pads' })).toBeInTheDocument();
    expect(screen.getByText('Vektra · OEM')).toBeInTheDocument();
    expect(screen.getByText('Part no. BP-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rated 4.6 out of 5 from 128 reviews' })).toHaveAttribute('href', '#reviews');
  });

  it('the rating is hidden without reviews', () => {
    render(<Identity name="x" brand="" partNumber="BP-1" rating={null} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('breadcrumb links home and the category trail and marks the page', () => {
    render(<Breadcrumb store="mau-reseller-north" trail={[{ id: 'c1', slug: 'brakes', name: 'Brakes' }]} name="Vektra pads" />);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en-US/mau-reseller-north');
    expect(screen.getByRole('link', { name: 'Brakes' })).toHaveAttribute('href', '/en-US/mau-reseller-north/category/brakes');
    expect(screen.getByText('Vektra pads')).toHaveAttribute('aria-current', 'page');
  });
});

describe('Price block', () => {
  it('chip shows the exact difference in the shopper currency', () => {
    render(<PriceBlock price={{ centAmount: 4500, oldCentAmount: 5000, currencyCode: 'USD', fractionDigits: 2 }} />);
    expect(screen.getByText('$45.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00', { selector: 's' })).toBeInTheDocument();
    expect(screen.getByText('Save $5.00')).toBeInTheDocument();
  });

  it('formats euros for de-DE', () => {
    renderVehicle(<PriceBlock price={{ centAmount: 4590, currencyCode: 'EUR', fractionDigits: 2 }} />, { locale: 'de-DE' });
    expect(screen.getByText(/45,90\s€/)).toBeInTheDocument();
  });

  it('no chip without an old price', () => {
    render(<PriceBlock price={{ centAmount: 4500, currencyCode: 'USD', fractionDigits: 2 }} />);
    expect(screen.queryByText(/Save/)).not.toBeInTheDocument();
    expect(document.querySelector('s')).toBeNull();
  });

  it('a missing price reads unavailable, never zero', () => {
    render(<PriceBlock price={null} />);
    expect(screen.getByText('Price unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/0[.,]00/)).not.toBeInTheDocument();
  });
});

describe('Fit banner on the product page', () => {
  const part = { fitmentKeys: ['Volkswagen|Golf|2012|2019|2.0 TDI'], universalFit: false };
  it('fit banner success text for a fitting part', () => {
    installFakeApi(stateOf(GOLF_2016));
    renderVehicle(<FitBanner product={part} alternativesHref="/s/category/brakes" />, { garage: stateOf(GOLF_2016) });
    expect(screen.getByRole('status')).toHaveTextContent('✓ Fits your 2016 Volkswagen Golf · 2.0 TDI');
  });
  it('danger banner with alternatives link', () => {
    installFakeApi(stateOf(GOLF_2022));
    renderVehicle(<FitBanner product={part} alternativesHref="/s/category/brakes" />, { garage: stateOf(GOLF_2022) });
    expect(screen.getByRole('status')).toHaveTextContent('does not fit your 2022 Volkswagen Golf');
    expect(screen.getByRole('link', { name: 'View fitting alternatives' })).toHaveAttribute('href', '/en-US/s/category/brakes');
  });
  it('no vehicle prompts to select one and claims nothing', () => {
    installFakeApi();
    renderVehicle(<FitBanner product={part} alternativesHref="/s" />);
    expect(screen.getByRole('status')).toHaveTextContent('Select your vehicle to check fit');
    expect(screen.getByRole('status')).not.toHaveTextContent('Fits your');
  });
});

describe('Accessibility', () => {
  it('no axe violations', async () => {
    const d = detail();
    const { container } = render(
      <>
        <Breadcrumb store="s" trail={d.categoryTrail} name={d.name} />
        <Gallery images={d.images} />
        <Identity name={d.name} brand={d.brand} qualityLabel={d.qualityLabel} partNumber={d.partNumber} rating={d.rating} />
        <PriceBlock price={{ centAmount: 4500, oldCentAmount: 5000, currencyCode: 'USD', fractionDigits: 2 }} />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

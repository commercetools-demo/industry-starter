// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeData, renderHome } from '@/test/home';
import { installFakeApi, stateOf } from '@/test/vehicle';
import { AutomotiveHero } from './AutomotiveHero';

vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());
afterEach(() => vi.unstubAllGlobals());

const GOLF = 'volkswagen.golf.2016.2-0-tdi';

describe('Vehicle-first hero', () => {
  it('promise says today for a same-day store', async () => {
    installFakeApi();
    renderHome(<AutomotiveHero />, { home: homeData({ pickup: 'today' }) });
    expect(await screen.findByText('Pick up in Hamburg today or have it shipped.')).toBeInTheDocument();
  });

  it('says tomorrow for a next-day store', () => {
    installFakeApi();
    renderHome(<AutomotiveHero />, { home: homeData({ pickup: 'tomorrow' }) });
    expect(screen.getByText('Pick up in Hamburg tomorrow or have it shipped.')).toBeInTheDocument();
    expect(screen.queryByText(/today/)).not.toBeInTheDocument();
  });

  it('ship-to-store line', () => {
    installFakeApi();
    renderHome(<AutomotiveHero />, { home: homeData({ pickup: 'ship-to-store' }) });
    expect(screen.getByText('Have it shipped to Hamburg to collect, or to your door.')).toBeInTheDocument();
  });

  it('a store without a branch only ships', () => {
    installFakeApi();
    renderHome(<AutomotiveHero />, { home: homeData({ pickup: 'ship-to-store', branch: null }) });
    expect(screen.getByText('Have it shipped to your door.')).toBeInTheDocument();
  });

  it('authored line with placeholders is filled as plain text', () => {
    installFakeApi();
    renderHome(<AutomotiveHero supportingLine="Collect in {city} {pickup}! <b>x</b>" headline="Welcome to {reseller}" />, { home: homeData({ pickup: 'tomorrow' }) });
    expect(screen.getByText('Collect in Hamburg tomorrow! <b>x</b>')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to Küstenwerk Autoteile');
    expect(document.querySelector('b')).toBeNull();
  });

  it('shows the design strings and a button to all parts', () => {
    installFakeApi();
    renderHome(<AutomotiveHero />);
    expect(screen.getByText('OEM parts · Fit guaranteed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Genuine parts from Küstenwerk Autoteile, ready near you.');
    expect(screen.getByRole('link', { name: 'Shop all parts' })).toHaveAttribute('href', '/en-US/mau-reseller-north/parts');
  });

  it('a javascript: button link never renders', () => {
    installFakeApi();
    renderHome(<AutomotiveHero ctaHref="javascript:alert(1)" />);
    expect(screen.getByRole('link', { name: 'Shop all parts' })).toHaveAttribute('href', '/en-US/mau-reseller-north/parts');
  });

  it('shows saved vehicle instead of empty selectors', () => {
    const garage = stateOf(GOLF);
    installFakeApi(garage);
    renderHome(<AutomotiveHero />, { garage });
    expect(screen.getByText('2016 Volkswagen Golf · 2.0 TDI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop parts that fit' })).toHaveAttribute('href', '/en-US/mau-reseller-north/parts');
    expect(document.querySelector('select')).toBeNull();
  });

  it('finder hidden when showFinder is false', () => {
    installFakeApi();
    renderHome(<AutomotiveHero showFinder={false} />);
    expect(screen.queryByRole('heading', { name: 'Find parts for your vehicle' })).not.toBeInTheDocument();
  });

  it('one h1', () => {
    installFakeApi();
    renderHome(<AutomotiveHero />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('image is a decorative background', () => {
    installFakeApi();
    const { container } = renderHome(<AutomotiveHero imageUrl="https://img.example.test/a.jpg" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"][style*="a.jpg"]')).not.toBeNull();
  });

  it('no axe violations', async () => {
    installFakeApi();
    const { container } = renderHome(<AutomotiveHero />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

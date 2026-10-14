// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { installFakeApi } from '@/test/vehicle';
import { renderHome } from '@/test/home';
import { BrandStrip } from './BrandStrip';
import { PromoBanner } from './PromoBanner';
import { VehicleFinderBlock } from './VehicleFinderBlock';

vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());

describe('Promo banner', () => {
  it('promo banner renders from props using theme tokens', () => {
    const { container } = renderHome(<PromoBanner title="Brake season −8%" text="Pads and discs for pickup in {city}." ctaLabel="Shop brakes" ctaHref="/category/brakes" tone="accent" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Brake season −8%' })).toBeInTheDocument();
    expect(screen.getByText('Pads and discs for pickup in Hamburg.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop brakes' })).toHaveAttribute('href', '/en-US/mau-reseller-north/category/brakes');
    expect(container.innerHTML).toContain('bg-accent-50');
    expect(container.innerHTML).toContain('text-accent-800');
    expect(container.innerHTML).toContain('rounded-md');
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b|style=/);
  });

  it('tones use the design tokens', () => {
    const brand = renderHome(<PromoBanner title="T" text="x" tone="brand" />);
    expect(brand.container.innerHTML).toContain('bg-surface-brand-subtle');
    expect(brand.container.innerHTML).toContain('text-text-link');
    brand.unmount();
    const neutral = renderHome(<PromoBanner title="T" text="x" tone="neutral" />);
    expect(neutral.container.innerHTML).toContain('bg-surface-quiet');
  });

  it('an HTML string is rendered as text', () => {
    const { container } = renderHome(<PromoBanner title="<img src=x onerror=alert(1)>" text="<script>window.__x=1</script>" />);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img, script')).toBeNull();
  });

  it('a javascript: link is dropped with its button', () => {
    renderHome(<PromoBanner title="T" text="x" ctaLabel="Go" ctaHref="javascript:alert(1)" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('absolute link opens as a plain anchor', () => {
    renderHome(<PromoBanner title="T" text="x" ctaLabel="Go" ctaHref="https://example.com/x" />);
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', 'https://example.com/x');
  });

  it('no axe violations', async () => {
    const { container } = renderHome(<PromoBanner title="Brake season" text="Save" ctaLabel="Go" ctaHref="/parts" tone="brand" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Brand strip', () => {
  it('brand strip alt text', () => {
    renderHome(<BrandStrip brands={[{ name: 'Vektra', logoUrl: 'https://img.example.test/v.png' }, { name: 'Textonly' }, { name: 'Linked', href: '/parts?brand=linked' }]} />);
    expect(screen.getByRole('img', { name: 'Vektra' })).toHaveAttribute('src', 'https://img.example.test/v.png');
    expect(screen.getByText('Textonly')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Linked' })).toHaveAttribute('href', '/en-US/mau-reseller-north/parts?brand=linked');
  });

  it('empty brands render nothing', () => {
    expect(renderHome(<BrandStrip brands={[]} />).container).toBeEmptyDOMElement();
    expect(renderHome(<BrandStrip />).container).toBeEmptyDOMElement();
  });

  it('a javascript: logo is dropped, the name stays', () => {
    renderHome(<BrandStrip brands={[{ name: 'Vektra', logoUrl: 'javascript:alert(1)' }]} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Vektra')).toBeInTheDocument();
  });
});

describe('Vehicle finder block', () => {
  it('shows the shared finder card', async () => {
    installFakeApi();
    renderHome(<VehicleFinderBlock />);
    expect(screen.getAllByRole('heading', { name: 'Find parts for your vehicle' })).toHaveLength(1);
    expect(await screen.findByRole('combobox', { name: 'Make' })).toBeInTheDocument();
  });

  it('a different title becomes a section heading', () => {
    installFakeApi();
    renderHome(<VehicleFinderBlock title="Your car, your parts" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Your car, your parts' })).toBeInTheDocument();
  });
});

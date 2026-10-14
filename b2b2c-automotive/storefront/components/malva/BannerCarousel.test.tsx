// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { act, fireEvent, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enUS from '@/messages/en-US.json';
import deDE from '@/messages/de-DE.json';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import { BannerCarousel, ROTATE_MS } from './BannerCarousel';

const banners = [
  { headline: 'Brakes', subline: 'Pads and discs', categorySlug: 'brakes', image: { url: 'https://placehold.co/1600x600.jpg', width: 1600, height: 600 } },
  { headline: 'Filters', subline: 'Oil', categorySlug: 'filters', image: { url: 'https://placehold.co/1600x600.jpg', width: 1600, height: 600 } },
  { headline: 'Batteries', subline: '', image: undefined },
];

let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query.includes('reduce'), addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const show = (items = banners, locale: 'en-US' | 'de-DE' = 'en-US') => renderWithProviders(<BannerCarousel banners={items} />, { locale, messages: locale === 'en-US' ? enUS : deDE });
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('Banner carousel', () => {
  it('shows the first banner with controls for the others', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Brakes' })).toBeInTheDocument();
    expect(screen.queryByText('Filters')).toBeNull();
    expect(screen.getByRole('group', { name: 'Slide 1 of 3' })).toBeInTheDocument();
    for (const name of ['Previous slide', 'Pause slides', 'Next slide']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });
  it('the call to action links to the category listing', () => {
    show();
    expect(screen.getByRole('link', { name: 'Shop now' })).toHaveAttribute('href', '/en-US/categories/brakes');
  });
  it('next and previous wrap around', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(screen.getByRole('heading', { name: 'Batteries' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByRole('heading', { name: 'Brakes' })).toBeInTheDocument();
  });
  it('advances by itself and the pause button stops it', () => {
    show();
    tick(ROTATE_MS);
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pause slides' }));
    expect(screen.getByRole('button', { name: 'Play slides' })).toHaveAttribute('aria-pressed', 'true');
    tick(ROTATE_MS * 3);
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
  });
  it('pauses on hover and resumes after', () => {
    show();
    const region = screen.getByRole('region', { name: 'Featured offers' });
    fireEvent.mouseEnter(region);
    tick(ROTATE_MS * 2);
    expect(screen.getByRole('heading', { name: 'Brakes' })).toBeInTheDocument();
    fireEvent.mouseLeave(region);
    tick(ROTATE_MS);
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
  });
  it('pauses while focus is inside and resumes when it leaves', () => {
    show();
    const next = screen.getByRole('button', { name: 'Next slide' });
    fireEvent.focus(next);
    tick(ROTATE_MS * 2);
    expect(screen.getByRole('heading', { name: 'Brakes' })).toBeInTheDocument();
    fireEvent.blur(next, { relatedTarget: document.body });
    tick(ROTATE_MS);
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
  });
  it('does not advance by itself under reduced motion', () => {
    reduced = true;
    show();
    tick(ROTATE_MS * 3);
    expect(screen.getByRole('heading', { name: 'Brakes' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
  });
  it('a banner without an image shows its text, and no image', () => {
    show([banners[2]]);
    expect(screen.getByRole('heading', { name: 'Batteries' })).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('a single banner has no controls', () => {
    show([banners[0]]);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('no banners render nothing', () => {
    const { container } = show([]);
    expect(container).toBeEmptyDOMElement();
  });
  it('German strings', () => {
    show(banners, 'de-DE');
    expect(screen.getByRole('button', { name: 'Nächste Folie' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jetzt entdecken' })).toBeInTheDocument();
  });
  it('has no accessibility violations', async () => {
    vi.useRealTimers();
    const { container } = show();
    expect(await axe(container)).toHaveNoViolations();
  });
});

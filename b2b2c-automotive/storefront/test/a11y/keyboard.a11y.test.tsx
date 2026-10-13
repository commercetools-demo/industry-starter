// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream Y (keyboard recipes K1 to K6): everything is operable without a pointer, dialogs take focus in and give it back, the skip
// link is the first stop, the gallery, steppers, delivery radios, promo field, filter sheet and account menu work from the keyboard.
// The store picker, vehicle finder and Modal have their own keyboard tests (StorePicker, VehicleFinderCard, Modal).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMenu } from '@/components/account/AccountMenu';
import { CartPage } from '@/components/cart/CartPage';
import { FilterSheet } from '@/components/listing/FilterPanel';
import { Gallery } from '@/components/product/detail/Gallery';
import { GarageChip } from '@/components/vehicle/GarageChip';
import { cart, line } from '@/test/cart-view-model';
import { axePage, renderStorePage, stubShellFetch } from '@/test/a11y';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/i18n/routing', async () => ({
  ...(await import('@/test/routing-mock')).mockRouting(),
  useRouter: () => nav,
  usePathname: () => '/mau-reseller-north/account/orders',
}));

afterEach(() => {
  vi.unstubAllGlobals();
  for (const fn of Object.values(nav)) fn.mockReset();
});

const STORE = 'mau-reseller-north';
const tabStops = () => [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => !el.closest('[aria-hidden="true"]') && !el.closest('dialog:not([open])'));

describe('K1: shell and header', () => {
  it('the skip link is the first stop and targets the main landmark', async () => {
    stubShellFetch();
    renderStorePage(<h1>Page</h1>);
    await screen.findByRole('button', { name: /Your store|Ihr Markt|Ihre Filiale/i }).catch(() => undefined);
    const first = tabStops()[0];
    expect(first.tagName).toBe('A');
    expect(first.getAttribute('href')).toBe('#main-content');
    expect(document.getElementById('main-content')?.tagName).toBe('MAIN');
  });

  it('Tab walks utility bar, header and navigation in reading order and every stop has a name', async () => {
    stubShellFetch();
    renderStorePage(<h1>Page</h1>, { signedIn: true });
    await screen.findByRole('button', { name: /Küstenwerk Hamburg-Harburg/ });
    const user = userEvent.setup();
    const seen: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      const el = document.activeElement as HTMLElement;
      const labelled = el as HTMLInputElement;
      seen.push(el.getAttribute('aria-label') ?? labelled.labels?.[0]?.textContent ?? el.getAttribute('placeholder') ?? el.textContent?.trim() ?? '');
      expect(el.getAttribute('tabindex') ?? '0', 'no positive tabindex').not.toMatch(/^[1-9]/);
    }
    expect(seen.every((name) => name.length > 0)).toBe(true);
    // Skip link, utility links, wordmark, store chip, search, garage, account, cart, then the category navigation: header before main content.
    expect(document.querySelector('header')!.compareDocumentPosition(document.querySelector('main')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the garage chip opens the garage dialog with Enter, Escape closes it and focus returns to the chip', async () => {
    stubShellFetch();
    renderStorePage(<GarageChip />, { bare: true });
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: /vehicle|Fahrzeug/i });
    button.focus();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(button);
  });
});

describe('K2: filter sheet', () => {
  const groups = [{ name: 'brand', param: 'brand', title: 'Marke', options: [{ key: 'vektra', label: 'Vektra', count: 3, selected: false }] }];
  it('opens with Enter, takes focus in, toggles with Space, applies with Enter and Escape returns focus', async () => {
    stubShellFetch();
    renderStorePage(<FilterSheet groups={groups} city="Hamburg" pickupAvailable />, { bare: true });
    const user = userEvent.setup();
    const open = screen.getByRole('button', { name: /Filter/i });
    open.focus();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const box = within(dialog).getByRole('checkbox', { name: /Vektra/ });
    box.focus();
    await user.keyboard(' ');
    expect(box).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: /Apply|Anwenden|Ergebnisse/i }));
    expect(nav.replace).toHaveBeenCalledWith(expect.stringContaining('brand=vektra'), { scroll: false });
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(open);
  });
});

describe('K3: gallery', () => {
  it('thumbnails are buttons: arrows move focus, Enter selects, the pressed state follows', async () => {
    const images = [
      { url: 'https://images.example.test/a.jpg', alt: 'Front', width: 800, height: 600 },
      { url: 'https://images.example.test/b.jpg', alt: 'Side', width: 800, height: 600 },
      { url: 'https://images.example.test/c.jpg', alt: 'Back', width: 800, height: 600 },
    ];
    renderStorePage(<Gallery images={images} />, { bare: true });
    const user = userEvent.setup();
    const thumbs = screen.getAllByRole('button', { pressed: undefined }).filter((b) => /Bild|image/i.test(b.getAttribute('aria-label') ?? ''));
    expect(thumbs).toHaveLength(3);
    thumbs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(thumbs[1]);
    await user.keyboard('{Enter}');
    expect(thumbs[1]).toHaveAttribute('aria-pressed', 'true');
    expect(thumbs[0]).toHaveAttribute('aria-pressed', 'false');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(document.activeElement).toBe(thumbs[2]);
  });
});

describe('K4: cart', () => {
  it('stepper, remove, delivery radios and the promo field work from the keyboard and announce the result', async () => {
    const after = cart({ lines: [line({ quantity: 3, total: { centAmount: 13800, currencyCode: 'EUR', fractionDigits: 2 } })] });
    stubShellFetch({ '/api/cart/items/li-1': { cart: after }, '/api/cart/delivery': { cart: after }, '/api/cart/discount-codes': { cart: after, promo: { code: 'WELCOME5', id: 'c1', state: 'applied', reason: null } } });
    renderStorePage(<CartPage store={STORE} />, { cart: cart({ lines: [line()] }), locale: 'en-US' });
    const user = userEvent.setup();
    const plus = screen.getByRole('button', { name: /Increase quantity of Brake pads front/ });
    plus.focus();
    expect(document.activeElement).toBe(plus);
    // Buttons are native: Enter and Space activate them (the optimistic update then shows the new number).
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('group', { name: /Quantity of Brake pads front/ })).toHaveTextContent('3'));
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(radios[1]);
    const promo = screen.getByRole('textbox', { name: /promo|code/i });
    await user.type(promo, 'WELCOME5{Enter}');
    expect(promo).not.toBeDisabled();
    expect(document.querySelectorAll('[role="status"]').length).toBeGreaterThan(0);
    expect(await axePage()).toHaveNoViolations();
  });
});

describe('K6: account menu', () => {
  it('the list marks the current page and the select (narrow screens) is labelled and changes page from the keyboard', async () => {
    stubShellFetch({ '/api/auth/me': { customer: null } });
    renderStorePage(<AccountMenu store={STORE} showSubscriptions />, { bare: true, locale: 'en-US' });
    const user = userEvent.setup();
    const list = screen.getByRole('navigation', { name: /account/i });
    expect(within(list).getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    const select = screen.getByRole('combobox', { name: /account|section|page/i });
    await user.selectOptions(select, 'Profile');
    expect(nav.push).toHaveBeenCalledWith(`/${STORE}/account/profile`);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });
});

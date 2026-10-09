import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { addRx, emptyCart, placeOrder, useSavedAddress } from './flows';
import { signInAs, watchConsole } from './helpers';

/**
 * Z-01 / Z-02: every route of design/DESIGN.md at 1440 px and 390 px. Per page: HTTP status, no console or page
 * errors, no horizontal overflow at 390 px, no critical or serious axe violation (WCAG 2 A/AA), and a screenshot
 * under the evidence folder (Z-<name>-1440.jpg / -390.jpg).
 */

const EVIDENCE = join(__dirname, '..', '..', 'plans', 'evidence');
const SIZES = [
  { label: '1440', width: 1440, height: 900 },
  { label: '390', width: 390, height: 844 },
] as const;

interface Target { name: string; path: string; status?: number }

async function visit(page: Page, t: Target, size: (typeof SIZES)[number], errors: string[]): Promise<void> {
  await page.setViewportSize({ width: size.width, height: size.height });
  const response = await page.goto(t.path);
  expect(response?.status(), `${t.name} status`).toBe(t.status ?? 200);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  if (size.width === 390) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${t.name} horizontal overflow at 390 px`).toBeLessThanOrEqual(1);
  }
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = result.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(
    bad.map((v) => `${v.id}: ${v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} ${v.id === 'color-contrast' ? JSON.stringify((n.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined) ?? {}) : ''}`).join(' | ')}`),
    `${t.name} @${size.label} axe`,
  ).toEqual([]);
  mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE, `Z-${t.name}-${size.label}.jpg`), fullPage: true, type: 'jpeg', quality: 55 });
  // The browser logs the document's own 404 as a console error; that is the expected status of the not-found page.
  const unexpected = errors.filter((e) => !(t.status === 404 && /status of 404/.test(e)));
  expect(unexpected, `${t.name} @${size.label} console`).toEqual([]);
}

const PUBLIC: Target[] = [
  { name: 'home', path: '/en-US' },
  { name: 'doctors-remote', path: '/en-US/doctors/remote' },
  { name: 'doctors-office', path: '/en-US/doctors/office' },
  { name: 'doctor-profile', path: '/en-US/doctor/mlv-doc-priya-nair?m=remote' },
  { name: 'search', path: '/en-US/search?q=nair' },
  { name: 'login', path: '/en-US/login' },
  { name: 'about', path: '/en-US/about' },
  { name: 'contact', path: '/en-US/contact' },
  { name: 'faq', path: '/en-US/faq' },
  { name: 'journal', path: '/en-US/journal' },
  { name: 'journal-article', path: '/en-US/journal/sleep-basics' },
  { name: 'policy-privacy', path: '/en-US/policies/privacy' },
  { name: 'policy-terms', path: '/en-US/policies/terms' },
  { name: 'policy-shipping', path: '/en-US/policies/shipping-and-returns' },
  { name: 'not-found', path: '/en-US/no-such-page', status: 404 },
];

test.describe('public pages (signed out)', () => {
  for (const t of PUBLIC) {
    test(t.name, async ({ page }) => {
      const c = watchConsole(page);
      for (const size of SIZES) {
        c.errors.length = 0;
        await visit(page, t, size, c.errors);
      }
    });
  }

  test('booking confirmation', async ({ page }) => {
    const c = watchConsole(page);
    await page.goto('/en-US/doctor/mlv-doc-daniel-reyes?m=remote');
    await page.getByRole('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('Gita Guest');
    await dialog.getByLabel('Email').fill('gita.guest@example.com');
    await dialog.getByLabel('Phone').fill('(212) 555-0111');
    await dialog.getByLabel('Reason for visit').fill('Check-up');
    await dialog.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page).toHaveURL(/\/en-US\/booked\/BK-/);
    const path = new URL(page.url()).pathname;
    for (const size of SIZES) {
      c.errors.length = 0;
      await visit(page, { name: 'booked', path }, size, c.errors);
    }
  });

  test('protected pages ask a guest to sign in (no error, no data)', async ({ page }) => {
    for (const path of ['/en-US/cart', '/en-US/checkout', '/en-US/prescriptions', '/en-US/account', '/en-US/account/labs']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toContainText(/Sign in/i);
    }
  });
});

test.describe('signed-in pages (Sam Rivera)', () => {
  test('cart, checkout, order and the account area', async ({ page, context }) => {
    test.setTimeout(240_000);
    const c = watchConsole(page);
    await signInAs(context, 'sam-rivera');
    await emptyCart(page);
    await addRx(page, 'RX-77102');
    const targets: Target[] = [{ name: 'prescriptions', path: '/en-US/prescriptions' }, { name: 'cart', path: '/en-US/cart' }];
    for (const t of targets) for (const size of SIZES) { c.errors.length = 0; await visit(page, t, size, c.errors); }

    await useSavedAddress(page);
    for (const size of SIZES) { c.errors.length = 0; await visit(page, { name: 'checkout', path: '/en-US/checkout' }, size, c.errors); }
    await useSavedAddress(page);
    const orderPath = await placeOrder(page);

    const rest: Target[] = [
      { name: 'order', path: orderPath },
      { name: 'account', path: '/en-US/account' },
      { name: 'account-labs', path: '/en-US/account/labs' },
      { name: 'account-lab-detail', path: '/en-US/account/labs/LAB-50301' },
      { name: 'account-appointments', path: '/en-US/account/appointments' },
      { name: 'account-orders', path: '/en-US/account/orders' },
      { name: 'account-addresses', path: '/en-US/account/addresses' },
      { name: 'account-profile', path: '/en-US/account/profile' },
      { name: 'account-allowance', path: '/en-US/account/allowance' },
      { name: 'account-auto-refill', path: '/en-US/account/auto-refill' },
      { name: 'account-payment-methods', path: '/en-US/account/payment-methods' },
      { name: 'account-lists', path: '/en-US/account/lists' },
      { name: 'labs-alias', path: '/en-US/labs' },
    ];
    for (const t of rest) for (const size of SIZES) { c.errors.length = 0; await visit(page, t, size, c.errors); }
  });
});

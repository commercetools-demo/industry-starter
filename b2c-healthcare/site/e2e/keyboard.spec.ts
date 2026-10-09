import { expect, test, type Page } from '@playwright/test';
import { addRx, emptyCart } from './flows';
import { signInAs } from './helpers';

/** Z-02: booking and checkout completed with the keyboard only (Tab, Shift+Tab, Enter, Space, typing, Escape). */

/** Presses Tab until the focused element satisfies `match` (run in the page); returns the number of presses. */
async function tabTo(page: Page, match: (el: Element) => boolean, max = 120): Promise<number> {
  for (let i = 1; i <= max; i += 1) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate(`(${match.toString()})(document.activeElement)`);
    if (hit) return i;
  }
  throw new Error(`no focusable element matched within ${max} Tab presses`);
}

/** The focused element has a visible focus indicator (outline or box-shadow), never "outline: none" alone. */
async function expectFocusRing(page: Page): Promise<void> {
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return { outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== 'none' };
  });
  expect(ring.outline || ring.shadow, 'focused element shows a focus ring').toBe(true);
}

test('booking with the keyboard only (as a guest), including Escape closing the dialog', async ({ page }) => {
  await page.goto('/en-US/doctors/remote');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /skip to/i })).toBeFocused();
  await tabTo(page, (el) => el.tagName === 'A' && /Dr\. Priya Nair/.test(el.textContent ?? ''));
  await expectFocusRing(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Dr. Priya Nair' })).toBeVisible();
  await expect(page.getByText('Book a time')).toBeVisible();
  await page.waitForSelector('button:text-matches("^\\\\d{2}:\\\\d{2}$")');
  await tabTo(page, (el) => el.tagName === 'BUTTON' && /^\d{2}:\d{2}$/.test((el.textContent ?? '').trim()));
  await expectFocusRing(page);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Escape closes, focus returns to the page, the same slot can open it again.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  await tabTo(page, (el) => (el as HTMLInputElement).name === 'name');
  await page.keyboard.type('Kai Keyboard');
  await page.keyboard.press('Tab');
  await page.keyboard.type('kai.keyboard@example.com');
  await page.keyboard.press('Tab');
  await page.keyboard.type('(212) 555-0112');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Follow-up');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Confirm booking' })).toBeFocused();
  await expectFocusRing(page);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/en-US\/booked\/BK-/);
});

test('checkout with the keyboard only (Sam, allowance covers the order)', async ({ page, context }) => {
  await signInAs(context, 'sam-rivera');
  await emptyCart(page);
  await addRx(page, 'RX-77102');
  await page.goto('/en-US/cart');
  await page.waitForLoadState('networkidle');
  await tabTo(page, (el) => el.tagName === 'A' && (el.textContent ?? '').trim() === 'Checkout');
  await expectFocusRing(page);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/en-US\/checkout/);
  await expect(page.locator('select[name=saved-address]')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await tabTo(page, (el) => (el as HTMLSelectElement).name === 'saved-address');
  await page.keyboard.press('ArrowDown');
  await tabTo(page, (el) => el.tagName === 'BUTTON' && (el.textContent ?? '').trim() === 'Use this address');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Delivering to /)).toBeVisible();
  await page.waitForLoadState('networkidle');
  await tabTo(page, (el) => el.tagName === 'BUTTON' && (el.textContent ?? '').trim() === 'Place order');
  await expectFocusRing(page);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/en-US\/order\/fixture-order-/);
});

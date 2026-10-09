import { expect, type Page } from '@playwright/test';

/** Small page flows shared by the journey and sweep specs (fixture mode, DEMO payment). */

export async function lookup(page: Page, rx: string): Promise<void> {
  await page.goto('/en-US/prescriptions');
  await page.getByRole('textbox', { name: 'RX number' }).fill(rx);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('Patient:')).toBeVisible();
}

export async function emptyCart(page: Page): Promise<void> {
  await page.goto('/en-US/cart');
  for (;;) {
    const remove = page.getByRole('button', { name: /^Remove/ }).first();
    if (!(await remove.isVisible({ timeout: 1500 }).catch(() => false))) return;
    await remove.click();
    await page.waitForTimeout(400);
  }
}

export async function addRx(page: Page, rx: string): Promise<void> {
  await lookup(page, rx);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText('Added to cart').first()).toBeVisible();
}

export async function useSavedAddress(page: Page): Promise<void> {
  await page.goto('/en-US/checkout');
  await page.locator('select[name=saved-address]').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Use this address' }).click();
  await expect(page.getByText(/Delivering to /)).toBeVisible();
}

/** Places the order from the checkout page and returns the order page path. */
export async function placeOrder(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/\/en-US\/order\/fixture-order-/);
  await expect(page.getByRole('main')).toContainText('Order placed');
  return new URL(page.url()).pathname;
}

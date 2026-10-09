import { expect, test } from '@playwright/test';
import { emptyCart, lookup, useSavedAddress } from './flows';
import { signInAs, watchConsole, type Patient } from './helpers';

/** Z-04 journeys against `next dev` with MALVA_FIXTURES=1 (no commercetools, DEMO payment). */

test.describe('journey 1: a guest books a doctor', () => {
  test('pick a slot, confirm as a guest, see the confirmation; nothing health-related in the URL', async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto('/en-US/doctors/remote');
    await page.getByRole('link', { name: /Dr\. Priya Nair/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Dr. Priya Nair' })).toBeVisible();
    await page.getByRole('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Booking as a guest')).toBeVisible();
    await dialog.getByLabel('Full name').fill('Gita Guest');
    await dialog.getByLabel('Email').fill('gita.guest@example.com');
    await dialog.getByLabel('Phone').fill('(212) 555-0111');
    await dialog.getByLabel('Reason for visit').fill('Trouble sleeping');
    await dialog.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page).toHaveURL(/\/en-US\/booked\/BK-/);
    expect(page.url()).not.toMatch(/sleep|gita|example\.com/i);
    await expect(page.getByRole('main')).toContainText('Dr. Priya Nair');
    expect(console_.errors).toEqual([]);
  });
});

test.describe('journey 2: Sam orders from a prescription and cancels', () => {
  test('look up RX-77102, add to cart, place with the allowance, see the order, cancel it', async ({ page, context }) => {
    const console_ = watchConsole(page);
    await signInAs(context, 'sam-rivera');
    await emptyCart(page);
    await lookup(page, 'RX-77102');
    await expect(page.getByText('Atorvastatin 20 mg tablets')).toBeVisible();
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByText('Added to cart').first()).toBeVisible();
    await page.goto('/en-US/cart');
    await expect(page.getByText('Atorvastatin 20 mg tablets')).toBeVisible();
    await expect(page.getByText('Allowance balance')).toBeVisible();
    await page.getByRole('link', { name: 'Checkout' }).click();
    await useSavedAddress(page);
    await expect(page.getByText('No card payment is needed')).toBeVisible();
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL(/\/en-US\/order\/fixture-order-/);
    await expect(page.getByRole('main')).toContainText('Order placed');
    expect(page.url()).not.toMatch(/RX-|atorvastatin/i);
    await page.goto('/en-US/account/orders');
    await expect(page.getByRole('main')).toContainText('Atorvastatin');
    await page.getByRole('link', { name: /Track|View/ }).first().click();
    await page.getByRole('button', { name: 'Cancel order' }).click();
    const confirm = page.getByRole('button', { name: /^(Yes|Confirm)/ });
    if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) await confirm.click();
    await expect(page.getByRole('main')).toContainText('Order cancelled');
    expect(console_.errors).toEqual([]);
  });

  test('a patient without funding pays with the DEMO payment; a declined payment keeps the cart', async ({ page, context }) => {
    await signInAs(context, 'jordan-lee');
    await emptyCart(page);
    await lookup(page, 'RX-55120');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByText('Added to cart').first()).toBeVisible();
    await useSavedAddress(page);
    await expect(page.getByText('DEMO payment')).toBeVisible();
    await page.getByLabel('Simulate a declined payment').check();
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page).toHaveURL(/\/checkout/);
    await page.getByLabel('Simulate a declined payment').uncheck();
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL(/\/en-US\/order\/fixture-order-/);
    await expect(page.getByRole('main')).toContainText('Order placed');
  });
});

test.describe('journey 3: auto-refill', () => {
  test('save a demo card, enable auto-refill, pause and resume it', async ({ page, context }) => {
    const console_ = watchConsole(page);
    await signInAs(context, 'sam-rivera');
    const saved = await page.request.post('/api/payment-methods/demo-add');
    expect(saved.ok()).toBe(true);
    await page.goto('/en-US/account/auto-refill');
    await page.getByRole('checkbox', { name: /Atorvastatin/ }).check();
    await page.getByRole('button', { name: 'Set up auto-refill' }).click();
    await expect(page.getByRole('main')).toContainText('Atorvastatin');
    await expect(page.getByRole('main')).toContainText(/Active/);
    await page.getByRole('button', { name: /^Pause/ }).first().click();
    await expect(page.getByRole('main')).toContainText(/Paused/);
    await page.getByRole('button', { name: /^Resume/ }).first().click();
    await expect(page.getByRole('main')).toContainText(/Active/);
    expect(console_.errors).toEqual([]);
  });
});

test.describe('journey 4: controlled medicines', () => {
  const cases: [Patient, string, RegExp, boolean][] = [
    ['alex-chen', 'RX-42017', /Requires a valid Schedule IV credential\. You have none on file\./, false],
    ['jordan-lee', 'RX-58833', /awaiting verification/, false],
    ['sam-rivera', 'RX-61044', /1 selected/, true],
  ];
  for (const [who, rx, text, allowed] of cases) {
    test(`${who} ${rx}: ${allowed ? 'allowed' : 'refused'}`, async ({ page, context }) => {
      await signInAs(context, who);
      await lookup(page, rx);
      await expect(page.getByRole('main')).toContainText(text);
      const add = page.getByRole('button', { name: 'Add to cart' });
      if (allowed) await expect(add).toBeEnabled();
      else await expect(add).toBeDisabled();
    });
  }
});

test.describe('journey 5: account area', () => {
  test('overview, labs, PDF download, appointments, addresses', async ({ page, context }) => {
    const console_ = watchConsole(page);
    await signInAs(context, 'sam-rivera');
    await page.goto('/en-US/account');
    await expect(page.getByRole('main')).toContainText('Hello, Sam');
    await page.goto('/en-US/account/labs');
    await expect(page.getByRole('main')).toContainText('Complete blood count');
    await page.getByRole('link', { name: /Complete blood count/ }).click();
    await expect(page.getByRole('main')).toContainText('Hemoglobin');
    const pdf = await page.request.get('/api/account/labs/LAB-50301/pdf');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    const foreign = await page.request.get('/api/account/labs/LAB-99999/pdf');
    expect(foreign.status()).toBe(404);
    await page.goto('/en-US/account/appointments');
    await expect(page.getByRole('main')).toContainText('Dr. Amara Okafor');
    await page.goto('/en-US/account/addresses');
    await page.getByRole('button', { name: 'Add address' }).click();
    await page.getByLabel('First name').fill('Sam');
    await page.getByLabel('Last name').fill('Rivera');
    await page.getByLabel('Street address').fill('99 Test Lane');
    await page.getByLabel('City').fill('Albany');
    await page.locator('select[name=state]').selectOption('NY');
    await page.getByLabel('ZIP code').fill('12207');
    await page.getByLabel('Phone').fill('(518) 555-0100');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByRole('main')).toContainText('99 Test Lane');
    expect(console_.errors).toEqual([]);
  });

  test("another patient cannot read Sam's lab (same 404 as an unknown id)", async ({ page, context }) => {
    await signInAs(context, 'alex-chen');
    expect((await page.request.get('/api/account/labs/LAB-50301/pdf')).status()).toBe(404);
    expect((await page.request.get('/api/account/labs/LAB-50301')).status()).toBe(404);
  });
});

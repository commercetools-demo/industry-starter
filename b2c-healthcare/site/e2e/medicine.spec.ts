import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { watchConsole } from './helpers';

/** AB: the medicine page against `next dev` with MALVA_FIXTURES=1, at 1440 px and 390 px, plus the search link. */

const SIZES = [
  { label: '1440', width: 1440, height: 900 },
  { label: '390', width: 390, height: 844 },
] as const;

async function expectAccessible(page: Page, name: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = result.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`), `${name} axe`).toEqual([]);
}

test.describe('medicine page', () => {
  for (const size of SIZES) {
    test(`Rx-only medicine at ${size.label} px: content, action, axe, no console errors`, async ({ page }) => {
      const console_ = watchConsole(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      const response = await page.goto('/en-US/medicine/mlv-med-atorvastatin-20-mg');
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: 'Atorvastatin 20 mg tablets' })).toBeVisible();
      await expect(page.getByText('Prescription only')).toBeVisible();
      await expect(page.getByTestId('medicine-price')).toContainText('$18.75');
      await expect(page.getByTestId('medicine-limit')).toContainText('Limit 3 packs per order');
      await page.getByRole('link', { name: 'Find it on your prescription' }).click();
      await expect(page).toHaveURL(/\/en-US\/prescriptions$/);
      await page.goBack();
      await page.waitForLoadState('networkidle');
      if (size.width === 390) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, 'horizontal overflow at 390 px').toBeLessThanOrEqual(1);
      }
      await expectAccessible(page, `rx @${size.label}`);
      expect(console_.errors).toEqual([]);
    });

    test(`controlled medicine at ${size.label} px shows the credential notice and keeps the page`, async ({ page }) => {
      const console_ = watchConsole(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/en-US/medicine/mlv-med-alprazolam-0-5-mg');
      await expect(page.getByRole('note')).toContainText('requires a valid Schedule IV credential');
      await expect(page.getByTestId('medicine-price')).toBeVisible();
      await expectAccessible(page, `controlled @${size.label}`);
      expect(console_.errors).toEqual([]);
    });

    test(`OTC medicine at ${size.label} px shows the prescription-page action`, async ({ page }) => {
      const console_ = watchConsole(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/en-US/medicine/mlv-med-ibuprofen-400-mg');
      await expect(page.getByText('Over the counter')).toBeVisible();
      await expect(page.getByText('HSA/FSA eligible')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Order from your prescription' })).toBeVisible();
      await expectAccessible(page, `otc @${size.label}`);
      expect(console_.errors).toEqual([]);
    });

    test(`dated stock states its shelf-life promise at ${size.label} px`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/en-US/medicine/mlv-med-famotidine-20-mg');
      await expect(page.getByTestId('medicine-shelf-life')).toContainText('Minimum 1 month of shelf life on delivery');
      await expect(page.getByText('Availability')).toBeVisible();
    });
  }

  test('an unknown medicine is a real 404 with the shared not-found view', async ({ page }) => {
    const response = await page.goto('/en-US/medicine/mlv-med-nope');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Medicine not found.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to search' })).toBeVisible();
  });

  test('search hit links to the medicine page', async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto('/en-US/search?q=ibuprofen');
    await page.getByRole('link', { name: 'Ibuprofen 400 mg tablets' }).click();
    await expect(page).toHaveURL(/\/en-US\/medicine\/mlv-med-ibuprofen-400-mg$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Ibuprofen 400 mg tablets' })).toBeVisible();
    expect(console_.errors).toEqual([]);
  });
});

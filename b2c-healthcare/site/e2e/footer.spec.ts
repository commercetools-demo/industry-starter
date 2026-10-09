import { expect, test } from '@playwright/test';

/** The footer band sits at the bottom of the viewport even when the page content is shorter than the screen (sign in). */
for (const size of [{ width: 1440, height: 1200 }, { width: 390, height: 1000 }]) {
  test(`footer touches the bottom of a tall ${size.width} px viewport on the sign-in page`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/en-US/login');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    const bottom = await footer.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(Math.round(bottom)).toBe(size.height);
    const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    expect(scrolls).toBe(false);
  });
}

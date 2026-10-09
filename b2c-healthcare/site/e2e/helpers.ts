import type { BrowserContext, Page } from '@playwright/test';
import { SESSION_COOKIE, signSession } from '../lib/session-core';

export type Patient = 'sam-rivera' | 'alex-chen' | 'jordan-lee';

/** Must equal SESSION_SECRET in playwright.config.ts (the dev server verifies the cookie with it). */
export const E2E_SESSION_SECRET = 'e2e-session-secret-e2e-session-secret-0000';
export const BASE = `http://localhost:3120`;

/** Signs in as a fixture patient by setting the signed session cookie (same value scripts/dev-session.ts prints). */
export async function signInAs(context: BrowserContext, slug: Patient): Promise<void> {
  const token = await signSession({ customerId: `fixture-${slug}`, locale: 'en-US', country: 'US', currency: 'USD' }, E2E_SESSION_SECRET);
  await context.addCookies([{ name: SESSION_COOKIE, value: token, url: BASE }]);
}

/** Collects console errors and page errors; assert `.errors` is empty at the end of a test. */
export function watchConsole(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return { errors };
}

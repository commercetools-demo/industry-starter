// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enUS from '@/messages/en-US.json';
import enCA from '@/messages/en-CA.json';

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'en-CA' ? enCA : enUS, namespace } as never),
}));

import { accountMetadata, accountOrderMetadata } from '@/lib/auth/account-metadata';

describe('account document titles (WCAG 2.4.2)', () => {
  it('a tab gets a title with its name and noindex', async () => {
    const meta = await accountMetadata('orders')({ params: Promise.resolve({ locale: 'en-US' }) });
    expect(meta.title).toBe('Orders: my account');
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect((await accountMetadata('payments')({ params: Promise.resolve({ locale: 'en-CA' }) })).title).toBe('Payment methods: my account');
  });

  it('an order gets its number in the title, decoded', async () => {
    const meta = await accountOrderMetadata({ params: Promise.resolve({ locale: 'en-US', orderNumber: 'MC-10%2D1' }) });
    expect(meta.title).toBe('Order MC-10-1: my account');
  });

  it('every page of the account frame exports generateMetadata (the index only redirects)', () => {
    const root = join(process.cwd(), 'app/[locale]/account/(shell)');
    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name === 'page.tsx') pages.push(full);
      }
    };
    walk(root);
    expect(pages.length).toBeGreaterThanOrEqual(9);
    const missing = pages.filter((p) => p !== join(root, 'page.tsx')).filter((p) => !/export const generateMetadata\s*=/.test(readFileSync(p, 'utf8')));
    expect(missing).toEqual([]);
  });
});

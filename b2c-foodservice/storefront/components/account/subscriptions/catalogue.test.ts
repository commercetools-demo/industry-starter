// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import enCA from '@/messages/en-CA.json';
import enUS from '@/messages/en-US.json';

const flatten = (o: unknown, prefix = ''): string[] =>
  typeof o === 'object' && o !== null
    ? Object.entries(o).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
    : [prefix];

describe('subscription messages', () => {
  it('catalogues have the same subscription keys', () => {
    const us = flatten(enUS.subscription).sort();
    const ca = flatten(enCA.subscription).sort();
    expect(ca).toEqual(us);
    for (const key of [
      'priceLock', 'cart.shippingNote', 'checkout.needsAccount', 'account.empty.cta', 'account.pending.text', 'status.failed', 'action.subscribeAgain',
      'dialog.cancel.textLast', 'dialog.cancel.textNone', 'toast.canceled', 'confirmation.late',
    ]) {
      expect(us, key).toContain(key);
    }
  });

  it('the stub key of the account tab is gone', () => {
    expect(enUS.account).not.toHaveProperty('subscriptions');
    expect(enCA.account).not.toHaveProperty('subscriptions');
  });

  it('no hard coded strings in subscription components', () => {
    const root = join(__dirname, '..', '..', '..');
    const files = [
      ...readdirSync(__dirname).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx')).map((f) => join(__dirname, f)),
      join(root, 'components/checkout/SubscriptionNote.tsx'),
    ];
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // JSX text between tags that contains letters, outside {expressions}.
      const literal = [...text.matchAll(/>\s*([A-Za-z][A-Za-z ,.'&;-]{2,})\s*</g)].map((m) => m[1]);
      expect(literal, file).toEqual([]);
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});

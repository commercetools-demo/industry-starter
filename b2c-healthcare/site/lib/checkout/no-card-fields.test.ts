// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

function sources(dirs: string[]): { file: string; code: string }[] {
  const out: { file: string; code: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?|html)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push({ file: relative(root, full), code: readFileSync(full, 'utf8') });
    }
  };
  for (const d of dirs) walk(join(root, d));
  return out;
}

/** The storefront's own source. Seed scripts and tests are not rendered and are out of scope. */
const STOREFRONT = ['app', 'components', 'hooks', 'lib', 'i18n', 'messages'];

describe('design-checkout: Payment through the payment widget: no card data in storefront code', () => {
  it('Payment card: no source file declares an autocomplete value starting with cc-', () => {
    const offenders = sources(STOREFRONT).filter(({ code }) => /autocomplete["'`]?\s*[:=]\s*\{?\s*["'`]cc-/i.test(code) || /["'`]cc-(number|exp|csc|name|type|exp-month|exp-year)["'`]/.test(code));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it('Payment card: no input is named or labelled as a card number, expiry or security code', () => {
    const offenders = sources(['app', 'components']).filter(({ code }) => /<(?:Input|input)\b[^>]*\b(?:name|id|label)=["'{`]\s*(?:card|cc|cvc|cvv|cardnumber|card-number|expiry|security-code)/i.test(code));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it('Payment card: the copy never asks for card details (the widget collects them)', () => {
    const messages = readFileSync(join(root, 'messages/en-US.json'), 'utf8');
    const checkout = JSON.stringify((JSON.parse(messages) as { checkout: unknown }).checkout);
    expect(checkout).not.toMatch(/card number|expiry|CVC|CVV|security code/i);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Tree = { [key: string]: Tree | string };
const load = (locale: string): Tree => JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8')) as Tree;

function keys(value: Tree | string, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('checkout and order catalogues (K-15)', () => {
  it('Catalogues have the same keys', () => {
    for (const ns of ['checkout', 'order']) {
      const us = keys(load('en-US')[ns] as Tree).sort();
      const ca = keys(load('en-CA')[ns] as Tree).sort();
      expect(us.length).toBeGreaterThan(20);
      expect(ca).toEqual(us);
    }
  });
  it('every promo reason commercetools can give has a message', () => {
    const reasons = Object.keys(((load('en-US').checkout as Tree).promo as Tree).reasons as Tree).sort();
    expect(reasons).toEqual(['ApplicationStoppedByPreviousDiscount', 'DoesNotMatchCart', 'MaxApplicationReached', 'NotActive', 'NotValid', 'DoesNotMatchCart'].filter((v, i, a) => a.indexOf(v) === i).sort());
  });
  it('every validator error code has a message', () => {
    const errors = Object.keys((load('en-US').checkout as Tree).errors as Tree).sort();
    expect(errors).toEqual(['code_malformed', 'person_invalid', 'pickup_name_invalid', 'pickup_name_required']);
  });
  it('no checkout or order string promises an email or a text message (D-032)', () => {
    for (const ns of ['checkout', 'order']) {
      expect(JSON.stringify(load('en-US')[ns])).not.toMatch(/emailed|email you|we'll text|text you|\bsent\b/i);
    }
  });
});

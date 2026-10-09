import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTAINER_INVENTORY, PRIVACY_CONTAINERS } from './inventory';

const site = path.resolve(__dirname, '../..');
const read = (p: string) => readFileSync(path.join(site, p), 'utf8');

/** Containers declared by the storefront (`CONTAINERS` in lib/ct/custom-objects.ts). */
const declared = (): string[] => {
  const block = /export const CONTAINERS = \{([\s\S]*?)\} as const;/.exec(read('lib/ct/custom-objects.ts'))?.[1] ?? '';
  return [...block.matchAll(/'(malva-[a-z-]+)'/g)].map((m) => m[1]);
};

describe('privacy inventory', () => {
  it('every container the storefront declares is in the script inventory, and nothing else is', () => {
    expect([...PRIVACY_CONTAINERS].sort()).toEqual(declared().sort());
  });

  it('every container is documented in docs/privacy-inventory.md with owner and erasure path', () => {
    const doc = read('docs/privacy-inventory.md');
    for (const c of CONTAINER_INVENTORY) expect(doc, c.container).toContain(`\`${c.container}\``);
    expect(doc).toContain('dataErasure=true');
    expect(doc).toContain('## 3. Cookies');
    expect(doc).toContain('## 4. Logs');
  });

  it('every resource kind of the GDPR list is documented', () => {
    const doc = read('docs/privacy-inventory.md');
    for (const kind of ['Customer', 'Cart', 'Order', 'Payment', 'Review', 'ShoppingList', 'DiscountCode', 'BusinessUnit', 'Quote', 'QuoteRequest', 'StagedQuote', 'Message']) expect(doc, kind).toContain(kind);
  });
});

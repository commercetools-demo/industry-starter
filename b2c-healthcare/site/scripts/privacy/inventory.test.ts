import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
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

describe('disclosure through the goods', () => {
  const doc = () => read('docs/privacy-inventory.md');
  const members = (file: string, name: string): string[] => {
    const sf = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
    const out: string[] = [];
    sf.forEachChild((n) => {
      if (ts.isInterfaceDeclaration(n) && n.name.text === name) for (const m of n.members) if (ts.isPropertySignature(m)) out.push(m.name.getText());
    });
    return out;
  };

  it('Disclosure through the goods is handled: the decision record says what a confirmation, order list and any future packing slip show, and who signs it off', () => {
    const text = doc();
    expect(text).toContain('## 6. Disclosure through the goods');
    expect(text).toMatch(/medication name/);
    expect(text).toMatch(/no emails, SMS messages or shipping labels in v1/);
    expect(text).toMatch(/packing slip/);
    expect(text).toContain('Owner sign-off');
  });

  it('Disclosure through the goods is handled: what the order pages carry is name, quantity and the catalog SKU (the link to the medicine page, AB) per line, with no sig, RX content, diagnosis or reason', () => {
    expect(members('lib/order-types.ts', 'OrderLineView').sort()).toEqual(['eligible', 'name', 'quantity', 'settledBy', 'sku']);
    const orderFields = members('lib/order-types.ts', 'OrderView');
    expect(orderFields.length).toBeGreaterThan(8);
    expect(orderFields.filter((f) => /^(sig|diagnos\w*|conditions?|results?|reason|rx\w*|notes?|labs?|prescription\w*)$/i.test(f))).toEqual([]);
  });
});

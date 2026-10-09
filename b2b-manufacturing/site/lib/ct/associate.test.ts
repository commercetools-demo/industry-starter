// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const chain = vi.fn();
vi.mock('./client', () => ({ apiRoot: { asAssociate: () => ({ withAssociateIdValue: (a: unknown) => ({ inBusinessUnitKeyWithBusinessUnitKeyValue: (b: unknown) => chain(a, b) }) }) } }));
const { asAssociate } = await import('./associate');

describe('malva-bff-and-session › Business-unit writes use the as-associate chain', () => {
  it('Signed-in client submits a request: chain with customerId and businessUnitKey', () => {
    asAssociate({ customerId: 'c1', businessUnitKey: 'co' });
    expect(chain).toHaveBeenCalledWith({ associateId: 'c1' }, { businessUnitKey: 'co' });
  });
  it('throws without both ids', () => {
    expect(() => asAssociate({ customerId: 'c1' })).toThrow(/businessUnitKey/);
    expect(() => asAssociate({ businessUnitKey: 'co' })).toThrow(/customerId/);
  });
  it('Anonymous visitor: carts, orders, quote requests and quotes are never reached through project-level apiRoot', () => {
    const dir = path.join(process.cwd(), 'lib/ct');
    const bad = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.startsWith('associate')).filter((f) => /apiRoot\s*\.\s*(carts|orders|quoteRequests|quotes|stagedQuotes)\s*\(/.test(readFileSync(path.join(dir, f), 'utf8')));
    expect(bad).toEqual([]);
  });
});

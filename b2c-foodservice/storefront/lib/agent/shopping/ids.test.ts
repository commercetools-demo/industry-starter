import { describe, expect, it } from 'vitest';
import { decodeId, encodeFamilyId, isFamilyId } from './ids';

describe('ids', () => {
  it('A family id round trips and an unknown string is a SKU', () => {
    expect(decodeId(encodeFamilyId('p-1'))).toEqual({ kind: 'family', mcpId: 'p-1' });
    expect(isFamilyId('fam:p-1')).toBe(true);
    expect(decodeId('MCF-POD-EMBER-50')).toEqual({ kind: 'sku', sku: 'MCF-POD-EMBER-50' });
    expect(decodeId('fam:')).toEqual({ kind: 'sku', sku: 'fam:' });
    expect(() => decodeId(undefined as never)).not.toThrow();
  });
});

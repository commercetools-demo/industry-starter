import { describe, expect, it } from 'vitest';
import { attributeProblems, demoObjects, REQUIRED_ATTRIBUTES, REQUIRED_TYPES } from './ensure-w.mjs';

const type = (names) => ({ attributes: names.map((name) => ({ name })) });

describe('ensure-w', () => {
  it('verifies the seed types and creates none: it only lists custom types W relies on', () => {
    expect(REQUIRED_TYPES).toEqual(['malva-line', 'malva-customer', 'mau-cart-discount-fields']);
    expect(REQUIRED_TYPES.join()).not.toMatch(/consent|audit|return-item/);
  });
  it('a complete local part type has no problems; a missing attribute or a fitment attribute is reported', () => {
    expect(attributeProblems('mau-pt-local-part', type(REQUIRED_ATTRIBUTES['mau-pt-local-part'].has))).toEqual([]);
    expect(attributeProblems('mau-pt-local-part', type(['part-number']))).toContain('product type mau-pt-local-part has no attribute review-state');
    expect(attributeProblems('mau-pt-local-part', type([...REQUIRED_ATTRIBUTES['mau-pt-local-part'].has, 'fitment-keys']))).toEqual(['product type mau-pt-local-part must not have attribute fitment-keys']);
    expect(attributeProblems('mau-pt-bundle', undefined)).toEqual(['product type mau-pt-bundle is missing']);
  });
  it('the demo records are marked demo and cover two campaigns and the three templates per store', () => {
    const objects = demoObjects(process.cwd(), ['mau-reseller-north', 'mau-reseller-south']);
    expect(objects.filter((o) => o.container === 'malva-coop-campaigns')).toHaveLength(2);
    expect(objects.filter((o) => o.container === 'malva-email-templates').map((o) => o.key)).toContain('mau-reseller-south--win-back');
    expect(objects.every((o) => o.value.demo === true)).toBe(true);
    expect(objects.filter((o) => o.container === 'malva-email-templates').every((o) => o.value.storeKey === o.key.split('--')[0])).toBe(true);
  });
});

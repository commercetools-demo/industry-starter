import { countBundleLines } from './bundle-count';

describe('countBundleLines', () => {
  it('Bundle count counts plans and add-ons: two plans and one add-on give 3', () => {
    expect(countBundleLines([{ offerKind: 'base-package' }, { offerKind: 'base-package' }, { offerKind: 'addon' }])).toBe(3);
  });

  it('equipment lines are not counted', () => {
    expect(countBundleLines([{ offerKind: 'base-package' }, { offerKind: 'equipment' }])).toBe(1);
  });

  it('counts devices and bundles', () => {
    expect(countBundleLines([{ offerKind: 'device' }, { offerKind: 'bundle' }])).toBe(2);
  });

  it('a phone plan with quantity 3 counts 1 (lines, not quantity)', () => {
    const line = { offerKind: 'base-package' as const, quantity: 3 };
    expect(countBundleLines([line])).toBe(1);
  });

  it('an empty bundle is 0', () => {
    expect(countBundleLines([])).toBe(0);
  });
});

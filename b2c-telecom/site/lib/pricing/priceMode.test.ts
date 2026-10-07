import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { lineRecurrence, priceModeCopyKey, priceModeForTerm, termFromContractTerm } from './priceMode';

describe('price mode (D-013)', () => {
  it('12 and 24 month plans are Fixed, month-to-month is Dynamic', () => {
    expect(priceModeForTerm(12)).toBe('Fixed');
    expect(priceModeForTerm(24)).toBe('Fixed');
    expect(priceModeForTerm(0)).toBe('Dynamic');
    expect(lineRecurrence('plan', 24).priceSelectionMode).toBe('Fixed');
    expect(lineRecurrence('plan', 0).priceSelectionMode).toBe('Dynamic');
  });
  it('add-on and equipment-rental are Dynamic for any term', () => {
    for (const term of [0, 12, 24] as const) {
      expect(lineRecurrence('addon', term).priceSelectionMode).toBe('Dynamic');
      expect(lineRecurrence('equipment-rental', term).priceSelectionMode).toBe('Dynamic');
    }
  });
  it('installment and lease are Fixed for any term', () => {
    for (const term of [0, 12, 24] as const) {
      expect(lineRecurrence('installment', term).priceSelectionMode).toBe('Fixed');
      expect(lineRecurrence('lease', term).priceSelectionMode).toBe('Fixed');
    }
  });
  it('the policy key is always malva-monthly', () => {
    for (const kind of ['plan', 'addon', 'equipment-rental', 'installment', 'lease'] as const) {
      expect(lineRecurrence(kind, 12).policyKey).toBe('malva-monthly');
    }
  });
  it('termFromContractTerm maps the three enum values', () => {
    expect(termFromContractTerm('month-to-month')).toBe(0);
    expect(termFromContractTerm('12-months')).toBe(12);
    expect(termFromContractTerm('24-months')).toBe(24);
  });
  it('Catalog price moved: Fixed and Dynamic each map to their own buyer-facing copy key', () => {
    expect(priceModeCopyKey('Fixed')).toBe('pricing.mode.fixed');
    expect(priceModeCopyKey('Dynamic')).toBe('pricing.mode.dynamic');
    for (const messages of [en, de]) {
      expect(messages.pricing.mode.fixed).toContain('{months}');
      expect(messages.pricing.mode.dynamic.length).toBeGreaterThan(0);
      expect(messages.pricing.mode.fixed).not.toBe(messages.pricing.mode.dynamic);
    }
  });
});

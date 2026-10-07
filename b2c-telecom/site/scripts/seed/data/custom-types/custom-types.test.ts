import { describe, expect, it } from 'vitest';
import type { TypeDraft } from '../../types';
import { cartType, customTypes, customerType, lineItemType, listLineType, orderType, paymentMethodType } from '.';

const names = (type: TypeDraft): string[] => type.fieldDefinitions.map((f) => f.name);

describe('custom types', () => {
  it('six types with the architecture keys and resource type ids', () => {
    expect(customTypes.map((t) => t.key)).toEqual(['malva-line-item', 'malva-cart', 'malva-order', 'malva-customer', 'malva-payment-method', 'malva-list-line']);
    expect(paymentMethodType.resourceTypeIds).toEqual(['payment-method']);
    expect(listLineType.resourceTypeIds).toEqual(['line-item']);
    expect(lineItemType.resourceTypeIds).toEqual(['line-item', 'custom-line-item']);
    expect(cartType.resourceTypeIds).toEqual(['order']);
    expect(orderType.resourceTypeIds).toEqual(['order']);
    expect(customerType.resourceTypeIds).toEqual(['customer']);
  });

  it('exact field names and types', () => {
    expect(lineItemType.fieldDefinitions.map((f) => [f.name, f.type.name])).toEqual([
      ['parentLineItemId', 'String'],
      ['acquisitionMode', 'Enum'],
      ['acquisitionTermMonths', 'Number'],
      ['offerKey', 'String'],
      ['autoAdded', 'Boolean'],
      ['acquisitionEndOfTerm', 'Enum'],
      ['acquisitionEndDate', 'Date'],
      ['financingDecisionId', 'String'],
    ]);
    expect(names(cartType)).toEqual(['postalCode', 'serviceableCable', 'serviceableWireless', 'serviceablePhone', 'demoMarker']);
    expect(names(customerType)).toEqual(['accountNumber', 'creditApproved', 'demoMarker', 'sessionsValidAfter']);
    expect(customerType.fieldDefinitions.find((f) => f.name === 'sessionsValidAfter')?.type).toEqual({ name: 'DateTime' });
    expect(orderType.fieldDefinitions.slice(0, 5).map((f) => [f.name, f.type.name])).toEqual([
      ['serviceStartDate', 'Date'],
      ['priceSchedule', 'String'],
      ['labelSnapshot', 'String'],
      ['cancellation', 'String'],
      ['returnRequest', 'String'],
    ]);
  });

  it('T: payment method descriptor and saved list line fields', () => {
    expect(paymentMethodType.fieldDefinitions.map((f) => [f.name, f.type.name])).toEqual([['brand', 'Enum'], ['last4', 'String'], ['expMonth', 'Number'], ['expYear', 'Number']]);
    expect(listLineType.fieldDefinitions.map((f) => [f.name, f.type.name])).toEqual([['offerKey', 'String'], ['savedAmountCents', 'Number'], ['savedCurrency', 'String'], ['savedAt', 'String']]);
  });

  it('the enum keys of acquisitionMode are outright, installments, lease', () => {
    const mode = lineItemType.fieldDefinitions.find((f) => f.name === 'acquisitionMode');
    expect(mode?.type).toMatchObject({ name: 'Enum' });
    expect((mode?.type as { values: { key: string }[] }).values.map((v) => v.key)).toEqual(['outright', 'installments', 'lease']);
  });

  it('malva-order repeats every malva-cart field so values survive the cart-to-order handover', () => {
    for (const name of names(cartType)) expect(names(orderType)).toContain(name);
  });

  it('every field is optional and every type has both locales on name, description and labels', () => {
    for (const type of customTypes) {
      expect(type.name['en-US'] && type.name['de-DE']).toBeTruthy();
      expect(type.description?.['en-US'] && type.description?.['de-DE']).toBeTruthy();
      for (const f of type.fieldDefinitions) {
        expect(f.required).toBe(false);
        expect(f.label['en-US'] && f.label['de-DE']).toBeTruthy();
      }
    }
  });
});

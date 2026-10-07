import type { FieldDefinitionDraft, FieldType } from '../../types';
import { ls } from '../catalog-types';

export function field(name: string, en: string, de: string, type: FieldType, required = false, inputHint: 'SingleLine' | 'MultiLine' = 'SingleLine'): FieldDefinitionDraft {
  return { name, label: ls(en, de), required, type, inputHint };
}

export const STRING: FieldType = { name: 'String' };
export const BOOLEAN: FieldType = { name: 'Boolean' };
export const NUMBER: FieldType = { name: 'Number' };
export const DATE: FieldType = { name: 'Date' };

/** Cart and order fields that survive the cart-to-order handover (malva-order repeats them). */
export const CART_FIELDS: FieldDefinitionDraft[] = [
  field('postalCode', 'Postal code', 'Postleitzahl', STRING),
  field('serviceableCable', 'Cable serviceable', 'Kabel verfügbar', BOOLEAN),
  field('serviceableWireless', 'Wireless serviceable', 'Funk verfügbar', BOOLEAN),
  field('serviceablePhone', 'Phone serviceable', 'Mobilfunk verfügbar', BOOLEAN),
  field('demoMarker', 'Demo marker', 'Demo-Markierung', STRING),
];

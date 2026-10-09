import { CURRENCY, PREFIX, type InventoryWanted } from '../lib';
import { classCategoryKey } from './categories';
import type { ImageEntry } from './images';
import { TAX_RX_MEDICINE } from './tax';
import { INVENTORY_TYPE_KEY, L, MEDICATION_PRODUCT_TYPE_KEY } from './types';

export type ControlClass = 'none' | 'schedule-iv';

export interface MedicationDef {
  slug: string;
  name: string;
  strength: string;
  form: 'tablet' | 'capsule';
  rxOnly: boolean;
  packSize: number;
  /** Price per pack in USD cents (the prototype's dollars x 100). */
  priceCents: number;
  cls: string;
  hsaEligible: boolean;
  controlClass: ControlClass;
  minRemainingShelfLifeDays: number;
  /** Ceiling per order; mirrored as the native inventory `maxCartQuantity`. Absent means no ceiling. */
  maxQtyPerOrder?: number;
  /** Short-dated demo supply (expiry-dated-supply): ISO date held on the inventory entry. */
  expiryDate?: string;
  /** Generic photo-search term (brand names return noise). */
  imageQuery: string;
}

const m = (
  slug: string, name: string, strength: string, form: 'tablet' | 'capsule', rxOnly: boolean, packSize: number, priceCents: number, cls: string,
  o: Partial<MedicationDef> = {},
): MedicationDef => ({
  slug, name, strength, form, rxOnly, packSize, priceCents, cls,
  hsaEligible: true, controlClass: 'none', minRemainingShelfLifeDays: 90, imageQuery: form === 'capsule' ? 'capsules pills medicine' : 'pharmacy medicine blister pack',
  ...o,
});

export const MEDICATIONS: MedicationDef[] = [
  m('amoxicillin-500-mg', 'Amoxicillin 500 mg capsules', '500 mg', 'capsule', true, 21, 1450, 'antibiotics', { maxQtyPerOrder: 2 }),
  m('ibuprofen-400-mg', 'Ibuprofen 400 mg tablets', '400 mg', 'tablet', false, 20, 620, 'pain-relief', { maxQtyPerOrder: 5 }),
  m('cetirizine-10-mg', 'Cetirizine 10 mg tablets', '10 mg', 'tablet', false, 30, 890, 'allergy', { maxQtyPerOrder: 5 }),
  m('atorvastatin-20-mg', 'Atorvastatin 20 mg tablets', '20 mg', 'tablet', true, 30, 1875, 'cardiovascular', { maxQtyPerOrder: 3 }),
  m('lisinopril-10-mg', 'Lisinopril 10 mg tablets', '10 mg', 'tablet', true, 30, 1140, 'cardiovascular', { maxQtyPerOrder: 3 }),
  m('azithromycin-250-mg', 'Azithromycin 250 mg tablets', '250 mg', 'tablet', true, 6, 1680, 'antibiotics', { maxQtyPerOrder: 2 }),
  m('ciprofloxacin-500-mg', 'Ciprofloxacin 500 mg tablets', '500 mg', 'tablet', true, 14, 1520, 'antibiotics', { maxQtyPerOrder: 2 }),
  m('amoxicillin-clavulanate-875-125-mg', 'Amoxicillin-clavulanate 875/125 mg tablets', '875/125 mg', 'tablet', true, 14, 2140, 'antibiotics', { maxQtyPerOrder: 2 }),
  m('acetaminophen-500-mg', 'Acetaminophen 500 mg tablets', '500 mg', 'tablet', false, 50, 730, 'pain-relief'),
  m('naproxen-220-mg', 'Naproxen 220 mg tablets', '220 mg', 'tablet', false, 40, 910, 'pain-relief', { maxQtyPerOrder: 5 }),
  m('loratadine-10-mg', 'Loratadine 10 mg tablets', '10 mg', 'tablet', false, 30, 940, 'allergy', { maxQtyPerOrder: 5 }),
  m('fexofenadine-180-mg', 'Fexofenadine 180 mg tablets', '180 mg', 'tablet', false, 30, 1360, 'allergy', { maxQtyPerOrder: 5 }),
  m('amlodipine-5-mg', 'Amlodipine 5 mg tablets', '5 mg', 'tablet', true, 30, 1050, 'cardiovascular', { maxQtyPerOrder: 3 }),
  m('metoprolol-50-mg', 'Metoprolol 50 mg tablets', '50 mg', 'tablet', true, 60, 1230, 'cardiovascular', { maxQtyPerOrder: 3 }),
  m('metformin-500-mg', 'Metformin 500 mg tablets', '500 mg', 'tablet', true, 60, 820, 'diabetes', { maxQtyPerOrder: 3 }),
  m('omeprazole-20-mg', 'Omeprazole 20 mg capsules', '20 mg', 'capsule', false, 28, 1190, 'digestive', { maxQtyPerOrder: 4 }),
  m('famotidine-20-mg', 'Famotidine 20 mg tablets', '20 mg', 'tablet', false, 30, 980, 'digestive', { maxQtyPerOrder: 4, expiryDate: '2026-11-15', minRemainingShelfLifeDays: 30 }),
  m('sertraline-50-mg', 'Sertraline 50 mg tablets', '50 mg', 'tablet', true, 30, 1420, 'mental-health', { maxQtyPerOrder: 2 }),
  m('alprazolam-0-5-mg', 'Alprazolam 0.5 mg tablets', '0.5 mg', 'tablet', true, 30, 1260, 'mental-health', { controlClass: 'schedule-iv', hsaEligible: false, maxQtyPerOrder: 1 }),
  m('tramadol-50-mg', 'Tramadol 50 mg tablets', '50 mg', 'tablet', true, 30, 1310, 'pain-relief', { controlClass: 'schedule-iv', hsaEligible: false, maxQtyPerOrder: 1 }),
];

export const medKey = (d: MedicationDef) => `${PREFIX}med-${d.slug}`;
export const medSku = (d: MedicationDef) => `MED-${d.slug}`;

/** Stock per SKU: at least 500 so demos never run dry. */
export const STOCK = 600;

export function medicationDraft(d: MedicationDef, images: ImageEntry[] = []) {
  return {
    key: medKey(d),
    productType: { typeId: 'product-type', key: MEDICATION_PRODUCT_TYPE_KEY },
    name: L(d.name),
    slug: L(d.slug),
    description: L(`${d.name}, ${d.packSize} per pack.`),
    categories: [{ typeId: 'category', key: classCategoryKey(d.cls) }],
    taxCategory: { typeId: 'tax-category', key: TAX_RX_MEDICINE },
    masterVariant: {
      sku: medSku(d),
      key: medSku(d),
      attributes: [
        { name: 'strength', value: d.strength },
        { name: 'dosageForm', value: d.form },
        { name: 'rxOnly', value: d.rxOnly },
        { name: 'dispenseUnit', value: d.form },
        { name: 'minRemainingShelfLifeDays', value: d.minRemainingShelfLifeDays },
        ...(d.maxQtyPerOrder !== undefined ? [{ name: 'maxQtyPerOrder', value: d.maxQtyPerOrder }] : []),
        { name: 'hsaEligible', value: d.hsaEligible },
        { name: 'controlClass', value: d.controlClass },
      ],
      prices: [{ value: { currencyCode: CURRENCY, centAmount: d.priceCents } }],
      images,
    },
    publish: true,
  };
}

export function medicationInventory(d: MedicationDef): InventoryWanted {
  return {
    sku: medSku(d),
    quantityOnStock: STOCK,
    ...(d.maxQtyPerOrder !== undefined ? { maxCartQuantity: d.maxQtyPerOrder } : {}),
    ...(d.expiryDate ? { custom: { type: { typeId: 'type', key: INVENTORY_TYPE_KEY }, fields: { expiryDate: d.expiryDate } } } : {}),
  };
}

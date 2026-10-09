import { LOCALE, PREFIX } from '../lib';

export const L = (en: string) => ({ [LOCALE]: en });

// ---------------------------------------------------------------- channels (price scopes)

/** `ProductDistribution` is required for a channel to scope prices. */
export const CHANNELS = [
  { key: `${PREFIX}remote`, roles: ['ProductDistribution'], name: L('Remote session') },
  { key: `${PREFIX}office`, roles: ['ProductDistribution'], name: L('Office visit') },
];

// ---------------------------------------------------------------- custom types

type FieldType = { name: 'String' | 'Number' | 'Boolean' | 'Money' | 'Date' };
const field = (name: string, label: string, type: FieldType['name']) => ({ name, label: L(label), required: false, type: { name: type } as FieldType });

export const CUSTOM_TYPES = [
  {
    key: `${PREFIX}rx-line`,
    name: L('Prescription line'),
    resourceTypeIds: ['line-item'],
    fieldDefinitions: [
      field('rxNumber', 'Prescription number', 'String'),
      field('rxLineRef', 'Prescription line reference', 'String'),
      field('prescribedQty', 'Prescribed quantity', 'Number'),
      field('credentialRef', 'Credential reference', 'String'),
      field('eligibleForRestricted', 'Eligible for restricted funds', 'Boolean'),
      field('coveredAmount', 'Covered amount', 'Money'),
      field('lastSeenUnitPrice', 'Unit price at the previous cart read', 'Money'),
      // Written at order placement: what the order line supplied and on what authorization.
      field('dispensedQty', 'Dispensed quantity', 'Number'),
      field('authorizationParams', 'Authorization parameters at placement (JSON)', 'String'),
      field('suppliedLots', 'Supplied lots (JSON, filled at packing)', 'String'),
      // Written when the line is added and again at order placement: the credential id is `credentialRef`.
      field('credentialValidTo', 'Credential expiry, copied when the line was checked', 'String'),
      // Written at order placement: which instrument settled how much of the line (JSON).
      field('settlement', 'Settlement by instrument (JSON)', 'String'),
    ],
  },
  {
    key: `${PREFIX}patient`,
    name: L('Patient'),
    resourceTypeIds: ['customer'],
    fieldDefinitions: [field('patientRef', 'Opaque patient reference', 'String'), field('fundingScheme', 'Funding scheme', 'String')],
  },
  {
    key: `${PREFIX}order-meta`,
    name: L('Order metadata'),
    resourceTypeIds: ['order'],
    fieldDefinitions: [field('allowanceApplied', 'Allowance applied', 'Money'), field('restrictedApplied', 'Restricted funds applied', 'Money')],
  },
  {
    key: `${PREFIX}review-meta`,
    name: L('Review metadata'),
    resourceTypeIds: ['review'],
    fieldDefinitions: [field('verifiedPatient', 'Verified patient', 'Boolean')],
  },
  {
    // not in the workstream list: the expiry-dated-supply demo needs somewhere to hold `expiryDate` on an inventory entry
    key: `${PREFIX}inventory-meta`,
    name: L('Inventory metadata'),
    resourceTypeIds: ['inventory-entry'],
    fieldDefinitions: [field('expiryDate', 'Expiry date of the supply', 'Date')],
  },
];

export const INVENTORY_TYPE_KEY = `${PREFIX}inventory-meta`;

// ---------------------------------------------------------------- product types

const enumType = (values: { key: string; label: string }[]) => ({ name: 'enum', values });
const attr = (name: string, label: string, type: unknown, o: { searchable?: boolean; required?: boolean } = {}) => ({
  name,
  label: L(label),
  isRequired: o.required ?? false,
  isSearchable: o.searchable ?? false,
  attributeConstraint: 'None',
  inputHint: 'SingleLine',
  type,
});

export const SPECIALTIES = [
  { key: 'general-practice', label: 'General Practice' },
  { key: 'dermatology', label: 'Dermatology' },
  { key: 'psychiatry', label: 'Psychiatry' },
  { key: 'pediatrics', label: 'Pediatrics' },
  { key: 'cardiology', label: 'Cardiology' },
  { key: 'orthopedics', label: 'Orthopedics' },
  { key: 'gynecology', label: 'Gynecology' },
];
export const CITIES = [
  { key: 'new-york', label: 'New York' },
  { key: 'austin', label: 'Austin' },
  { key: 'chicago', label: 'Chicago' },
];
export const MODES = [
  { key: 'remote', label: 'Remote session' },
  { key: 'office', label: 'Office visit' },
];
export const DOSAGE_FORMS = [
  { key: 'tablet', label: 'Tablet' },
  { key: 'capsule', label: 'Capsule' },
];
export const CONTROL_CLASSES = [
  { key: 'none', label: 'Not controlled' },
  { key: 'schedule-iv', label: 'Schedule IV' },
];

export const DOCTOR_PRODUCT_TYPE_KEY = `${PREFIX}doctor`;
export const MEDICATION_PRODUCT_TYPE_KEY = `${PREFIX}medication`;

/**
 * ATTRIBUTES THE STOREFRONT SEARCHES OR FILTERS ON (lib/ct/search-query.ts, lib/ct/doctors.ts, lib/ct/search-all.ts).
 * Each must stay `isSearchable: true` in the product types below: Product Search can neither filter nor full-text match
 * an attribute that is not indexed.
 *
 * !!! SEARCHABILITY IS A ONE-WAY DECISION IN PRACTICE: `changeIsSearchable` exists, but the Product Search index is
 * rebuilt for every product of the type, and an attribute name must have the SAME `isSearchable` in every product type that
 * uses it or it leaves search everywhere. Decide BEFORE the first live seed. Changing a value here later makes `seed.ts` send
 * `changeIsSearchable` (update-plans.ts) and `seed:verify` checks the result; types-searchable.test.ts fails when an attribute
 * the storefront code searches is not searchable.
 */
export const SEARCHED_ATTRIBUTES: Record<string, string[]> = {
  [`${PREFIX}doctor`]: ['specialty', 'city', 'modes', 'clinicName'],
  [`${PREFIX}medication`]: ['rxOnly'],
};

/** One variant per product, so attribute constraints stay `None` (an irreversible choice that is harmless here). */
export const PRODUCT_TYPES = [
  {
    key: DOCTOR_PRODUCT_TYPE_KEY,
    name: 'Doctor',
    description: 'A doctor offering remote sessions and/or office visits; fee per mode is a price on a price channel.',
    attributes: [
      attr('specialty', 'Specialty', enumType(SPECIALTIES), { searchable: true, required: true }),
      attr('yearsExperience', 'Years of experience', { name: 'number' }),
      attr('languages', 'Languages', { name: 'set', elementType: { name: 'text' } }),
      attr('education', 'Education', { name: 'ltext' }),
      attr('clinicName', 'Clinic', { name: 'text' }, { searchable: true }),
      attr('city', 'City', enumType(CITIES), { searchable: true, required: true }),
      attr('timezone', 'Time zone (IANA)', { name: 'text' }),
      attr('modes', 'Visit modes', { name: 'set', elementType: enumType(MODES) }, { searchable: true }),
    ],
  },
  {
    key: MEDICATION_PRODUCT_TYPE_KEY,
    name: 'Medication',
    description: 'A prescription or over-the-counter medicine sold per pack.',
    attributes: [
      attr('strength', 'Strength', { name: 'text' }),
      attr('dosageForm', 'Dosage form', enumType(DOSAGE_FORMS), { searchable: true }),
      attr('rxOnly', 'Prescription only', { name: 'boolean' }, { searchable: true, required: true }),
      attr('dispenseUnit', 'Dispense unit', { name: 'text' }),
      attr('minRemainingShelfLifeDays', 'Minimum remaining shelf life (days)', { name: 'number' }),
      attr('maxQtyPerOrder', 'Maximum quantity per order', { name: 'number' }),
      attr('hsaEligible', 'HSA eligible', { name: 'boolean' }),
      attr('controlClass', 'Controlled-substance class', enumType(CONTROL_CLASSES), { searchable: true }),
    ],
  },
];

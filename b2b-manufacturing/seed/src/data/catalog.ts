import type {
  AttributeDefinitionDraft,
  CategoryDraft,
  ProductTypeDraft,
  ShippingMethodDraft,
  TaxCategoryDraft,
  TypeDraft,
  ZoneDraft,
} from '@commercetools/platform-sdk';
import { COUNTRIES, CURRENCIES, ls } from './locales';
import { FREQUENCIES, SECTORS } from './services';

const l = (text: string, de?: string) => ls(text, de);

export const KEYS = {
  taxCategory: 'mpw-service-vat',
  zone: 'mpw-service-area',
  shippingMethod: 'mpw-on-site-service',
  faqType: 'mpw-faq-item',
  serviceType: 'mpw-service',
  categoryPlumbing: 'mpw-plumbing',
  categoryWaste: 'mpw-waste-management',
  store: 'mpw-web',
  selection: 'mpw-all-services',
  typeLine: 'mpw-line-service',
  typeQuoteRequest: 'mpw-quote-request',
  typeCustomer: 'mpw-customer',
  typeCompany: 'mpw-company',
} as const;

export const SECTOR_LABELS: Record<string, string> = {
  facilities: 'Facilities management',
  manufacturing: 'Manufacturing',
  property: 'Property / real estate',
  healthcare: 'Healthcare',
};

export const taxCategoryDraft: TaxCategoryDraft = {
  key: KEYS.taxCategory,
  name: 'Malva service VAT',
  rates: [
    { key: 'mpw-vat-de', name: 'VAT Germany', amount: 0.19, includedInPrice: false, country: 'DE' },
    // US sales tax depends on the state and is stated on the quote, so the fallback rate is 0.
    { key: 'mpw-tax-us', name: 'Sales tax US (stated on the quote)', amount: 0, includedInPrice: false, country: 'US' },
  ],
};

export const zoneDraft: ZoneDraft = { key: KEYS.zone, name: 'Malva service area', locations: COUNTRIES.map((country) => ({ country })) };

export const shippingMethodDraft: ShippingMethodDraft = {
  key: KEYS.shippingMethod,
  name: 'On-site service, no delivery',
  localizedName: l('On-site service, no delivery', 'Service vor Ort, kein Versand'),
  localizedDescription: l('Services are delivered at your site; nothing is shipped.', 'Leistungen werden an Ihrem Standort erbracht; es wird nichts versendet.'),
  taxCategory: { typeId: 'tax-category', key: KEYS.taxCategory },
  isDefault: true,
  zoneRates: [
    {
      zone: { typeId: 'zone', key: KEYS.zone },
      shippingRates: CURRENCIES.map((currencyCode) => ({ price: { currencyCode, centAmount: 0 } })),
    },
  ],
};

const text = (name: string, label: string, extra: Partial<AttributeDefinitionDraft> = {}): AttributeDefinitionDraft => ({
  name,
  label: l(label),
  isRequired: false,
  type: { name: 'ltext' },
  attributeConstraint: 'SameForAll',
  isSearchable: false,
  inputHint: 'MultiLine',
  ...extra,
});

export const faqItemTypeDraft: ProductTypeDraft = {
  key: KEYS.faqType,
  name: 'Malva FAQ item',
  description: 'A question and its answer, nested in a service.',
  attributes: [text('question', 'Question', { inputHint: 'SingleLine' }), text('answer', 'Answer')],
};

/**
 * The service product type. A nested attribute references its product type by ID (not key), so the FAQ item type
 * must exist first and its id is passed in (the seed looks it up; tests pass a placeholder).
 */
export const buildServiceTypeDraft = (faqTypeId: string): ProductTypeDraft => ({
  key: KEYS.serviceType,
  name: 'Malva service',
  description: 'A plumbing or waste-management service that is quoted, not sold at a listed price.',
  attributes: [
    text('summary', 'Summary', { inputHint: 'SingleLine' }),
    {
      name: 'sectors',
      label: l('Sectors'),
      isRequired: false,
      type: { name: 'set', elementType: { name: 'enum', values: SECTORS.map((key) => ({ key, label: SECTOR_LABELS[key] ?? key })) } },
      attributeConstraint: 'SameForAll',
      isSearchable: true,
      inputHint: 'SingleLine',
    },
    {
      name: 'frequencies',
      label: l('Frequencies'),
      isRequired: false,
      type: { name: 'set', elementType: { name: 'enum', values: FREQUENCIES.map((key) => ({ key, label: key })) } },
      attributeConstraint: 'SameForAll',
      isSearchable: true,
      inputHint: 'SingleLine',
    },
    { ...text('included', 'Included'), type: { name: 'set', elementType: { name: 'ltext' } } },
    { ...text('steps', 'How it works'), type: { name: 'set', elementType: { name: 'ltext' } } },
    { ...text('records', 'Records produced'), type: { name: 'set', elementType: { name: 'ltext' } } },
    {
      ...text('faq', 'FAQ'),
      type: { name: 'set', elementType: { name: 'nested', typeReference: { typeId: 'product-type', id: faqTypeId } } },
    },
    {
      ...text('related', 'Related services'),
      type: { name: 'set', elementType: { name: 'reference', referenceTypeId: 'product' } },
    },
    { ...text('needs-waste-details', 'Needs waste details'), type: { name: 'boolean' }, inputHint: 'SingleLine' },
    { ...text('display-order', 'Display order'), type: { name: 'number' }, inputHint: 'SingleLine' },
  ],
});

/** For tests and dry runs only: the service type with a placeholder FAQ type id. */
export const serviceTypeDraft: ProductTypeDraft = buildServiceTypeDraft('00000000-0000-0000-0000-000000000000');

export const categoryDrafts: CategoryDraft[] = [
  { key: KEYS.categoryPlumbing, name: l('Plumbing', 'Sanitär'), slug: l('plumbing'), orderHint: '0.1' },
  { key: KEYS.categoryWaste, name: l('Waste management', 'Abfallmanagement'), slug: l('waste-management'), orderHint: '0.2' },
];

const str =(name: string, label: string) => ({ name, label: l(label), required: false, type: { name: 'String' as const }, inputHint: 'SingleLine' as const });
const enumField = (name: string, label: string, values: { key: string; label: string }[]) => ({ name, label: l(label), required: false, type: { name: 'Enum' as const, values } });

export const SITE_COUNTS = [
  { key: '1', label: '1' },
  { key: '2-10', label: '2–10' },
  { key: '11-50', label: '11–50' },
  { key: '50-plus', label: '50+' },
];

const sectorValues = [...SECTORS.map((k) => ({ key: k, label: SECTOR_LABELS[k] ?? k })), { key: 'other', label: 'Other' }];

export const typeDrafts: TypeDraft[] = [
  {
    key: KEYS.typeLine,
    name: l('Malva service line'),
    resourceTypeIds: ['line-item'],
    fieldDefinitions: [enumField('frequency', 'Frequency', FREQUENCIES.map((k) => ({ key: k, label: k }))), str('note', 'Note')],
  },
  {
    key: KEYS.typeQuoteRequest,
    name: l('Malva quote request details'),
    resourceTypeIds: ['quote'],
    fieldDefinitions: [
      enumField('sector', 'Sector', sectorValues),
      enumField('siteCount', 'Number of sites', SITE_COUNTS),
      str('wasteTypes', 'Waste types'),
      str('permitNumber', 'Permit or licence number'),
      str('notes', 'Notes'),
      str('contactName', 'Contact name'),
      str('jobTitle', 'Job title'),
      str('phone', 'Phone'),
      str('reference', 'Reference'),
    ],
  },
  {
    key: KEYS.typeCustomer,
    name: l('Malva customer'),
    resourceTypeIds: ['customer'],
    fieldDefinitions: [str('jobTitle', 'Job title'), str('phone', 'Phone'), { name: 'mustChangePassword', label: l('Must change password'), required: false, type: { name: 'Boolean' as const } }],
  },
  {
    key: KEYS.typeCompany,
    name: l('Malva company'),
    resourceTypeIds: ['business-unit'],
    fieldDefinitions: [enumField('sector', 'Sector', sectorValues)],
  },
];

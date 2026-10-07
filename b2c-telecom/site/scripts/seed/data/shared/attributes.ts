// One definition per shared attribute name (the platform rejects conflicting definitions of one name across product
// types). Product types take a shared definition through `shared(name, { isRequired })`; only requiredness and the
// label may differ between types.
import type { AttributeDefinitionDraft, AttributeType } from '../../types';
import { ls } from '../catalog-types';
import { ADDON_KIND, ADDON_TAG, BADGE, CHARGE_TYPE, COLOR, CONTRACT_TERM, MEMORY_GB, NETWORK_GENERATION, TECHNOLOGY } from './enums';

type Def = AttributeDefinitionDraft;

const text: AttributeType = { name: 'text' };
const number: AttributeType = { name: 'number' };
const ltext: AttributeType = { name: 'ltext' };

function def(name: string, en: string, de: string, type: AttributeType, rest: Partial<Def> = {}): Def {
  return {
    name,
    label: ls(en, de),
    type,
    isRequired: false,
    attributeConstraint: 'SameForAll',
    inputHint: 'SingleLine',
    isSearchable: false,
    level: 'Variant',
    savedToLineItem: false,
    ...rest,
  };
}

const BASE: Record<string, Def> = {
  technology: def('technology', 'Technology', 'Technologie', { name: 'lenum', values: TECHNOLOGY }, { isSearchable: true }),
  'downstream-mbps': def('downstream-mbps', 'Downstream (Mbps)', 'Download (Mbit/s)', number, { isSearchable: true }),
  'upstream-mbps': def('upstream-mbps', 'Upstream (Mbps)', 'Upload (Mbit/s)', number, { isSearchable: true }),
  'contract-term': def('contract-term', 'Contract term', 'Vertragslaufzeit', { name: 'lenum', values: CONTRACT_TERM }, { attributeConstraint: 'None', isSearchable: true }),
  'charge-type': def('charge-type', 'Charge type', 'Entgeltart', { name: 'lenum', values: CHARGE_TYPE }, { attributeConstraint: 'None', isSearchable: true }),
  'network-generation': def('network-generation', 'Network generation', 'Netzgeneration', { name: 'lenum', values: NETWORK_GENERATION }, { isSearchable: true }),
  'typical-download-mbps': def('typical-download-mbps', 'Typical download (Mbps)', 'Typischer Download (Mbit/s)', number),
  'typical-upload-mbps': def('typical-upload-mbps', 'Typical upload (Mbps)', 'Typischer Upload (Mbit/s)', number),
  'typical-latency-ms': def('typical-latency-ms', 'Typical latency (ms)', 'Typische Latenz (ms)', number),
  'data-gb': def('data-gb', 'Data (GB, -1 = unlimited)', 'Datenvolumen (GB, -1 = unbegrenzt)', number, { isSearchable: true }),
  'price-lock-months': def('price-lock-months', 'Price lock (months)', 'Preisgarantie (Monate)', number),
  'activation-fee': def('activation-fee', 'Activation fee (whole units)', 'Aktivierungsgebühr (ganze Einheiten)', number),
  'early-termination-fee': def('early-termination-fee', 'Early termination fee', 'Gebühr bei vorzeitiger Kündigung', ltext, { inputHint: 'MultiLine' }),
  badge: def('badge', 'Badge', 'Kennzeichnung', { name: 'lenum', values: BADGE }, { isSearchable: true }),
  'label-plan-id': def('label-plan-id', 'Label plan ID', 'Plan-ID auf dem Label', text),
  'bundle-discount-text': def('bundle-discount-text', 'Discounts & Bundles', 'Rabatte & Pakete', ltext),
  'included-addons': def('included-addons', 'Included add-ons (product keys)', 'Enthaltene Zusatzangebote (Produktschlüssel)', { name: 'set', elementType: text }),
  'conflicts-with': def('conflicts-with', 'Conflicts with (offer keys)', 'Nicht kombinierbar mit (Angebotsschlüssel)', { name: 'set', elementType: text }),
  highlights: def('highlights', 'Highlights', 'Highlights', { name: 'set', elementType: ltext }, { inputHint: 'MultiLine' }),
  'addon-kind': def('addon-kind', 'Add-on kind', 'Art des Zusatzangebots', { name: 'lenum', values: ADDON_KIND }, { isSearchable: true }),
  'addon-tag': def('addon-tag', 'Add-on tag', 'Zusatzangebot-Kategorie', { name: 'lenum', values: ADDON_TAG }, { isSearchable: true }),
  color: def('color', 'Color', 'Farbe', { name: 'lenum', values: COLOR }, { attributeConstraint: 'None' }),
  'memory-gb': def('memory-gb', 'Memory', 'Speicher', { name: 'enum', values: MEMORY_GB }, { attributeConstraint: 'None' }),
};

export type SharedName = keyof typeof BASE;
export const SHARED_NAMES = Object.keys(BASE);

/** The shared definition of `name`; a product type may only change `isRequired` (and the label). */
export function shared(name: string, overrides: Partial<Pick<Def, 'isRequired' | 'label'>> = {}): Def {
  const base = BASE[name];
  if (!base) throw new Error(`No shared attribute definition named "${name}"`);
  return structuredClone({ ...base, ...overrides });
}

/** A definition that is not shared (the name occurs in one product type only). */
export function own(name: string, en: string, de: string, type: AttributeType, rest: Partial<Def> = {}): Def {
  if (name in BASE) throw new Error(`"${name}" is a shared attribute: use shared()`);
  return def(name, en, de, type, rest);
}

// Facet definitions for the product listing (application configuration, not CMS). See plans/workstreams/G-browse.md 3.3.
export type CategoryRoot = 'pods' | 'coffee' | 'machines' | 'accessories' | 'gifts';
export type FacetControl = 'checkbox' | 'radio' | 'colour' | 'grid';

export interface FacetDef {
  /** URL name (`f_<name>`) and response facet name. */
  name: string;
  /** i18n key under `plp.facet`. */
  labelKey: string;
  control: FacetControl;
  kind: 'distinct' | 'ranges';
  /** Search field path. Empty for the virtual `collection` facet. */
  field: string;
  fieldType?: 'enum' | 'text' | 'boolean' | 'number' | 'set_enum';
  appliesTo: CategoryRoot[] | 'all';
  limit?: number;
  /** Accepted URL values: an explicit list or a pattern. Anything else is dropped before it reaches commercetools. */
  values?: readonly string[];
  pattern?: RegExp;
}

const ROASTS = ['light', 'medium', 'medium-dark', 'dark'];
const BREW = ['espresso', 'filter', 'french-press', 'moka', 'cold-brew'];
const SYSTEMS = ['original', 'vertuo', 'bean-to-cup', 'espresso', 'filter', 'grinder'];
const COLOURS = ['black', 'white', 'red', 'silver', 'cream'];
export const COLLECTION_VALUES = ['bestseller', 'new', 'limited-edition', 'subscribable'] as const;
export const INTENSITY_VALUES = Array.from({ length: 13 }, (_, i) => String(i + 1));

export const FACETS: FacetDef[] = [
  { name: 'category', labelKey: 'category', control: 'checkbox', kind: 'distinct', field: 'categories', fieldType: 'text', appliesTo: 'all', limit: 50, pattern: /^mcf-cat-[a-z0-9-]{1,64}$/ },
  { name: 'system', labelKey: 'system', control: 'checkbox', kind: 'distinct', field: 'variants.attributes.system.key', fieldType: 'enum', appliesTo: ['pods', 'machines'], values: SYSTEMS },
  { name: 'intensity', labelKey: 'intensity', control: 'grid', kind: 'ranges', field: 'variants.attributes.intensity', fieldType: 'number', appliesTo: ['pods', 'coffee'], values: INTENSITY_VALUES },
  { name: 'roast', labelKey: 'roast', control: 'checkbox', kind: 'distinct', field: 'variants.attributes.roast.key', fieldType: 'enum', appliesTo: ['coffee'], values: ROASTS },
  { name: 'brew', labelKey: 'brew', control: 'checkbox', kind: 'distinct', field: 'variants.attributes.brewMethods.key', fieldType: 'set_enum', appliesTo: ['coffee', 'machines', 'accessories'], values: BREW },
  { name: 'origin', labelKey: 'origin', control: 'checkbox', kind: 'distinct', field: 'variants.attributes.origin', fieldType: 'text', appliesTo: ['coffee'], limit: 50, pattern: /^[\p{L}\p{N} ,.'-]{1,60}$/u },
  { name: 'decaf', labelKey: 'decaf', control: 'checkbox', kind: 'distinct', field: 'variants.attributes.decaf', fieldType: 'boolean', appliesTo: ['pods', 'coffee'], values: ['true'] },
  { name: 'organic', labelKey: 'organic', control: 'checkbox', kind: 'distinct', field: 'variants.attributes.organic', fieldType: 'boolean', appliesTo: ['pods', 'coffee'], values: ['true'] },
  { name: 'fairtrade', labelKey: 'fairtrade', control: 'checkbox', kind: 'distinct', field: 'variants.attributes.fairtrade', fieldType: 'boolean', appliesTo: ['pods', 'coffee'], values: ['true'] },
  { name: 'colour', labelKey: 'colour', control: 'colour', kind: 'distinct', field: 'variants.attributes.colour.key', fieldType: 'enum', appliesTo: ['machines', 'accessories'], values: COLOURS },
  { name: 'price', labelKey: 'price', control: 'radio', kind: 'ranges', field: 'variants.prices.centAmount', fieldType: 'number', appliesTo: 'all', values: ['p0', 'p1', 'p2', 'p3', 'p4'] },
  { name: 'rating', labelKey: 'rating', control: 'radio', kind: 'ranges', field: 'reviewRatingStatistics.averageRating', fieldType: 'number', appliesTo: 'all', values: ['4.5', '4.0'] },
  { name: 'collection', labelKey: 'collection', control: 'checkbox', kind: 'distinct', field: '', appliesTo: 'all', values: [...COLLECTION_VALUES] },
];

export const FACET_BY_NAME: Record<string, FacetDef> = Object.fromEntries(FACETS.map((f) => [f.name, f]));

export function isFacetValueAllowed(def: FacetDef, value: string): boolean {
  if (def.values) return def.values.includes(value);
  return def.pattern ? def.pattern.test(value) : false;
}

/** `collection` values that map to the `badge` enum; `subscribable` maps to the boolean attribute. */
export const BADGE_FIELD = 'variants.attributes.badge.key';
export const SUBSCRIBABLE_FIELD = 'variants.attributes.subscribable';

export const facetMode = (def: FacetDef): 'multi' | 'single' => (def.control === 'radio' ? 'single' : 'multi');

export const CATEGORY_ROOTS: CategoryRoot[] = ['pods', 'coffee', 'machines', 'accessories', 'gifts'];

/** Whether a facet is relevant for the scope root; a `null` root (shop, search) shows every facet that has buckets. */
export function facetApplies(def: FacetDef, root: CategoryRoot | null): boolean {
  return root === null || def.appliesTo === 'all' || def.appliesTo.includes(root);
}

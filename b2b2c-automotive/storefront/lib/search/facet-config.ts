// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Facets are application configuration, not Contentools configuration (D7). Add a facet only when its attribute exists in the
// product type `mau-pt-part` (seed/src/data/product-types.ts) and is searchable. Enum attributes use the `.key` path.

export interface FacetConfig {
  /** Attribute name and the facet name in the Product Search response. */
  name: string;
  field: string;
  fieldType: 'enum';
  /** Address parameter: `brand`, or `attr.<name>` for part specific facets. */
  param: string;
}

const enumFacet = (name: string, param = `attr.${name}`): FacetConfig => ({ name, field: `variants.attributes.${name}.key`, fieldType: 'enum', param });

export const FACETS: readonly FacetConfig[] = [enumFacet('brand', 'brand'), enumFacet('quality-tier'), enumFacet('position')];

/** Part specific facets (everything but the brand, which has its own address parameter). */
export const ATTRIBUTE_FACETS: readonly FacetConfig[] = FACETS.filter((f) => f.name !== 'brand');

/** Product type that carries the facet attributes; its enum labels feed the filter panel. */
export const PART_PRODUCT_TYPE_KEY = 'mau-pt-part';

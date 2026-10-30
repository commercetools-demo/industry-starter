// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { FieldDefinition, TypeDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

const str = (name: string, en: string): FieldDefinition => ({ name, label: ls(en), required: false, type: { name: 'String' }, inputHint: 'SingleLine' });
const text = (name: string, en: string): FieldDefinition => ({ name, label: ls(en), required: false, type: { name: 'String' }, inputHint: 'MultiLine' });
const num = (name: string, en: string): FieldDefinition => ({ name, label: ls(en), required: false, type: { name: 'Number' }, inputHint: 'SingleLine' });

export const FULFILMENT_VALUES = ['collect', 'delivery', 'subscribe'] as const;

/** Values of the `orderType` enum on carts and orders (workstream R, D-042). `in-store-purchase` is set by the In-store companion. */
export const ORDER_TYPE_VALUES = [
  { key: 'in-store-purchase', label: 'In-store purchase' },
  { key: 'online', label: 'Online' },
] as const;

/**
 * Line item type: the fulfilment of each line (`collect`, `delivery` or `subscribe`), mirrored from supplyChannel and
 * recurrenceInfo so the UI and reports read one value. Channel type: the store details the picker shows.
 */
export const typeDrafts: TypeDraft[] = [
  {
    key: K.typeLine, name: ls('Malva line fulfilment'), resourceTypeIds: ['line-item'],
    fieldDefinitions: [
      {
        name: 'fulfilment', label: ls('Fulfilment'), required: false, inputHint: 'SingleLine',
        type: { name: 'Enum', values: FULFILMENT_VALUES.map((key) => ({ key, label: key })) },
      },
    ],
  },
  {
    key: K.typeStore, name: ls('Malva store'), resourceTypeIds: ['channel'],
    fieldDefinitions: [
      str('addressLine', 'Address line'), str('city', 'City'), str('postalCode', 'Postal code'),
      str('phone', 'Phone'), text('hours', 'Opening hours (JSON by weekday)'),
      num('collectionMinutes', 'Collection ready after (minutes)'),
    ],
  },
  // In-store order type (workstream R, D-041 to D-043): the key is the owner's, not `mcf-` prefixed. Cart and order, so the order
  // placed from an in-store cart can be told apart in reports. `orderType` is an enum: `in-store-purchase` or `online`.
  {
    key: K.typeInstoreOrder, name: ls('In-store order type'), resourceTypeIds: ['order', 'cart'],
    fieldDefinitions: [
      {
        name: 'orderType', label: ls('Order type'), required: false, inputHint: 'SingleLine',
        type: { name: 'Enum', values: ORDER_TYPE_VALUES.map((v) => ({ key: v.key, label: v.label })) },
      },
    ],
  },
  // Review type (workstream M): set by the storefront when a review is written; seeded reviews carry no custom fields.
  {
    key: K.typeReview, name: ls('Malva review'), resourceTypeIds: ['review'],
    fieldDefinitions: [
      { name: 'verifiedPurchase', label: ls('Verified purchase'), required: false, type: { name: 'Boolean' }, inputHint: 'SingleLine' },
      str('orderNumber', 'Order number'),
    ],
  },
];

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { FieldDefinition, TypeDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

const str = (name: string, en: string): FieldDefinition => ({ name, label: ls(en), required: false, type: { name: 'String' }, inputHint: 'SingleLine' });
const text = (name: string, en: string): FieldDefinition => ({ name, label: ls(en), required: false, type: { name: 'String' }, inputHint: 'MultiLine' });
const num = (name: string, en: string): FieldDefinition => ({ name, label: ls(en), required: false, type: { name: 'Number' }, inputHint: 'SingleLine' });

export const FULFILMENT_VALUES = ['collect', 'delivery', 'subscribe'] as const;

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
];

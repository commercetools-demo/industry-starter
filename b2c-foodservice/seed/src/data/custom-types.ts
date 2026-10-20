// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { FieldDefinition, TypeDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

const str = (name: string, en: string, de: string): FieldDefinition => ({ name, label: ls(en, de), required: false, type: { name: 'String' }, inputHint: 'SingleLine' });
const text = (name: string, en: string, de: string): FieldDefinition => ({ name, label: ls(en, de), required: false, type: { name: 'String' }, inputHint: 'MultiLine' });
const num = (name: string, en: string, de: string): FieldDefinition => ({ name, label: ls(en, de), required: false, type: { name: 'Number' }, inputHint: 'SingleLine' });

export const FULFILMENT_VALUES = ['collect', 'ship', 'subscribe'] as const;

/**
 * Line item type: the fulfilment of each line (`collect`, `ship` or `subscribe`), mirrored from supplyChannel and
 * recurrenceInfo so the UI and reports read one value. Channel type: the store details the picker shows.
 */
export const typeDrafts: TypeDraft[] = [
  {
    key: K.typeLine, name: ls('Malva line fulfilment', 'Malva Positions-Fulfillment'), resourceTypeIds: ['line-item'],
    fieldDefinitions: [
      {
        name: 'fulfilment', label: ls('Fulfilment', 'Fulfillment'), required: false, inputHint: 'SingleLine',
        type: { name: 'Enum', values: FULFILMENT_VALUES.map((key) => ({ key, label: key })) },
      },
    ],
  },
  {
    key: K.typeStore, name: ls('Malva store', 'Malva Store'), resourceTypeIds: ['channel'],
    fieldDefinitions: [
      str('addressLine', 'Address line', 'Straße und Nummer'), str('city', 'City', 'Ort'), str('postalCode', 'Postal code', 'Postleitzahl'),
      str('phone', 'Phone', 'Telefon'), text('hours', 'Opening hours (JSON by weekday)', 'Öffnungszeiten (JSON je Wochentag)'),
      num('collectionMinutes', 'Collection ready after (minutes)', 'Abholbereit nach (Minuten)'),
    ],
  },
];

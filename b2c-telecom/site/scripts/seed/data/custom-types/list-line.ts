import type { TypeDraft } from '../../types';
import { ls } from '../catalog-types';
import { NUMBER, STRING, field } from './fields';

/** Workstream T: the price a saved-list line had when it was saved (a ShoppingListLineItem has no price of its own). */
export const listLineType: TypeDraft = {
  key: 'malva-list-line',
  name: ls('Malva saved-list line', 'Malva-Merklistenposition'),
  description: ls('Offer key and the price (in cents) at the time the line was saved, so the list can show what changed.', 'Angebotsschlüssel und Preis (in Cent) beim Speichern, damit die Liste Änderungen zeigen kann.'),
  resourceTypeIds: ['line-item'],
  fieldDefinitions: [
    field('offerKey', 'Offer key', 'Angebotsschlüssel', STRING),
    field('savedAmountCents', 'Saved price (cents)', 'Gespeicherter Preis (Cent)', NUMBER),
    field('savedCurrency', 'Saved currency', 'Gespeicherte Währung', STRING),
    field('savedAt', 'Saved at (ISO)', 'Gespeichert am (ISO)', STRING),
  ],
};

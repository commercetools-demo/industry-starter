import type { Customer, CustomerUpdateAction } from '@commercetools/platform-sdk';
import { ConcurrentModificationError, HttpError } from './errors';
import type { CtApi } from './ct-api';

export const NOTES_TYPE_KEY = 'instore-customer-type';
export const MAX_NOTES = 100;
export const MAX_TEXT = 1000;
const MAX_ATTEMPTS = 3;

export interface Note {
  index: number;
  text: string;
}

/**
 * A Set custom field has no fixed order, so notes are always shown sorted. `index` is the position in that
 * sorted list: the same contents give the same indexes whatever order commercetools returns them in.
 */
export function sortNotes(raw: readonly string[]): string[] {
  return [...raw].sort((a, b) => a.localeCompare(b, 'en') || (a < b ? -1 : a > b ? 1 : 0));
}

export function presentNotes(raw: readonly string[]): Note[] {
  return sortNotes(raw).map((text, index) => ({ index, text }));
}

type TypeRef = { id: string; obj?: { key?: string } };

/** Which kind of custom data the customer carries: ours, none, or another type. */
export function customKind(customer: Customer): 'ours' | 'none' | 'foreign' {
  if (!customer.custom) return 'none';
  return (customer.custom.type as TypeRef).obj?.key === NOTES_TYPE_KEY ? 'ours' : 'foreign';
}

/** The stored notes (unsorted), `[]` when the field or the type is absent. */
export function storedNotes(customer: Customer): string[] {
  if (customKind(customer) !== 'ours') return [];
  const value = customer.custom!.fields.notes as unknown;
  return Array.isArray(value) ? (value as string[]) : [];
}

export function parseIndex(raw: string): number {
  if (!/^\d+$/.test(raw)) throw new HttpError(400, 'invalid_index', 'index must be a whole number, 0 or more');
  return Number(raw);
}

export function parseText(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text.length < 1 || text.length > MAX_TEXT) {
    throw new HttpError(400, 'invalid_text', `text must be 1 to ${MAX_TEXT} characters`);
  }
  return text;
}

export function parseExpected(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string') throw new HttpError(400, 'invalid_expected', 'expected must be a string');
  return raw;
}

/** What a change does to the sorted list: the new list, or an HttpError. */
export type Change = (current: string[]) => string[];

/**
 * Reads the customer, applies `change`, writes the new list. A customer with our type gets `setCustomField` only
 * (never `setCustomType`, which would replace paymentAccountIds); a customer with no type gets `setCustomType`;
 * a customer with another type is refused. A stale version is retried from a fresh read, at most 3 times.
 */
export async function writeNotes(api: CtApi, customerId: string, change: Change): Promise<Note[]> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const customer = await api.getCustomer(customerId);
    if (!customer) throw new HttpError(404, 'customer_not_found', 'customer not found');
    const kind = customKind(customer);
    if (kind === 'foreign') {
      throw new HttpError(409, 'foreign_custom_type', 'the customer has a different custom type; notes cannot be stored');
    }
    const next = sortNotes(change(sortNotes(storedNotes(customer))));
    const actions: CustomerUpdateAction[] =
      kind === 'none'
        ? [{ action: 'setCustomType', type: { typeId: 'type', key: NOTES_TYPE_KEY }, fields: { notes: next } }]
        : [{ action: 'setCustomField', name: 'notes', value: next.length > 0 ? next : undefined }];
    try {
      const updated = await api.updateCustomer(customerId, customer.version, actions);
      return presentNotes(storedNotes(updated));
    } catch (e) {
      if (!(e instanceof ConcurrentModificationError)) throw e;
    }
  }
  throw new HttpError(409, 'conflict', 'the customer was changed by someone else; try again');
}

export function addNote(text: string): Change {
  return (current) => {
    if (current.includes(text)) throw new HttpError(409, 'duplicate_note', 'that note already exists');
    if (current.length >= MAX_NOTES) throw new HttpError(409, 'too_many_notes', `at most ${MAX_NOTES} notes per customer`);
    return [...current, text];
  };
}

function noteAt(current: string[], index: number, expected: string | undefined): string {
  const text = current[index];
  if (text === undefined) throw new HttpError(404, 'note_not_found', 'no note at that index');
  if (expected !== undefined && expected !== text) {
    throw new HttpError(409, 'note_changed', 'the note at that index is not the one you expected');
  }
  return text;
}

export function editNote(index: number, text: string, expected: string | undefined): Change {
  return (current) => {
    const old = noteAt(current, index, expected);
    if (text === old) return current;
    if (current.includes(text)) throw new HttpError(409, 'duplicate_note', 'that note already exists');
    return current.map((n, i) => (i === index ? text : n));
  };
}

export function deleteNote(index: number, expected: string | undefined): Change {
  return (current) => {
    noteAt(current, index, expected);
    return current.filter((_, i) => i !== index);
  };
}

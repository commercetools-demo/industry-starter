import 'server-only';
import { ApiError } from '@/lib/api';
import { ListLimitError } from '@/lib/ct/shopping-lists';

/** One body and one status for a list that is not the signed-in customer's and for one that does not exist. */
export const LIST_NOT_FOUND = 'List not found.';
export const listNotFound = () => new ApiError(404, LIST_NOT_FOUND);

/** Maps a list limit to a 422 the buyer can read (no stack, no commercetools text). */
export function listLimitError(error: unknown): never {
  if (error instanceof ListLimitError) {
    const text = { NAME: 'Give the list a name.', LINES: 'A list can hold up to 250 medicines.', EMPTY: 'Your cart is empty, so there is nothing to save yet.' }[error.reason];
    throw new ApiError(422, text);
  }
  throw error;
}

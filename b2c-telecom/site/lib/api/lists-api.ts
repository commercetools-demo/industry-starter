import 'server-only';
import { InvalidListNameError, ListFullError, ListLimitError, ListNotFoundError, UnknownOfferError } from '@/lib/ct/lists';
import { LIST_NAME_MAX, MAX_LINES_PER_LIST, MAX_LISTS } from '@/lib/config/lists';
import { AccountRefusal } from './account-api';

/** Maps the typed errors of lib/ct/lists.ts to this API's stable codes. A foreign list is the same 404 as an unknown one. */
export async function withListErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ListNotFoundError) throw new AccountRefusal(404, 'LIST_NOT_FOUND', 'List not found.');
    if (error instanceof ListLimitError) throw new AccountRefusal(422, 'LIST_LIMIT', `You can keep up to ${MAX_LISTS} lists.`, { max: MAX_LISTS });
    if (error instanceof ListFullError) throw new AccountRefusal(422, 'LIST_FULL', `This list is full (${MAX_LINES_PER_LIST} items).`, { max: MAX_LINES_PER_LIST });
    if (error instanceof InvalidListNameError) throw new AccountRefusal(400, 'INVALID_NAME', `A list name has 1 to ${LIST_NAME_MAX} characters.`, { max: LIST_NAME_MAX });
    if (error instanceof UnknownOfferError) throw new AccountRefusal(404, 'UNKNOWN_OFFER', 'That offer is not for sale.');
    throw error;
  }
}

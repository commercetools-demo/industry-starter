import 'server-only';
import { ApiError } from '../errors';

/** The same answer for a missing resource and another company's resource, so nothing about it is disclosed. */
export const notFoundError = () => new ApiError(404, 'Not found.');

/** Throws not-found unless the resource belongs to the session's Business Unit. */
export function requireOwnership(session: { businessUnitKey?: string }, resourceBusinessUnitKey: string | undefined | null): void {
  if (!session.businessUnitKey || !resourceBusinessUnitKey || session.businessUnitKey !== resourceBusinessUnitKey) throw notFoundError();
}

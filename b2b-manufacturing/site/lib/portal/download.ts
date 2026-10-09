import 'server-only';
import { notFoundError, requireOwnership } from '@/lib/ct/ownership';

const SHORT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The record id to look up inside the session's Business Unit. A request id of the form `<unit>.<id>` (the Custom Object
 * key) names its owner, which must be the session's unit; another company's id and a malformed one answer exactly like
 * a missing one. The returned id is always looked up under the session's own unit, never under a request-supplied key.
 */
export function ownedRecordId(session: { businessUnitKey?: string }, requestId: string): string {
  const dot = requestId.indexOf('.');
  const [owner, id] = dot === -1 ? [session.businessUnitKey, requestId] : [requestId.slice(0, dot), requestId.slice(dot + 1)];
  requireOwnership(session, owner);
  if (!SHORT_ID.test(id ?? '')) throw notFoundError();
  return id as string;
}

export const pdfResponse = (name: string, bytes: Uint8Array): Response =>
  new Response(bytes as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': String(bytes.byteLength) } });

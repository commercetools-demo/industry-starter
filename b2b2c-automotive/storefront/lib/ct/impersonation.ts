// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The handoff record of "Shop as customer" (V-06): custom object container `malva-impersonation`, key `<jti>`, value
// `{ customerId, storeKey, actorId, createdAt, status: 'issued' | 'active' | 'ended' }` (written by the portal, `portal/lib/ct/seller/impersonation.ts`).
// The storefront moves it `issued` to `active` exactly once (a version guarded write, so two requests with one token cannot both win) and to
// `ended` on exit. Needs the scope `manage_key_value_documents`.
import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { inStore } from '@/lib/ct/in-store';

export const IMPERSONATION_CONTAINER = 'malva-impersonation';
export type RecordStatus = 'issued' | 'active' | 'ended';
interface HandoffRecord {
  customerId: string;
  storeKey: string;
  actorId: string;
  createdAt?: string;
  status: RecordStatus;
}

const ID = /^[A-Za-z0-9_-]{1,256}$/;
const statusOf = (error: unknown): number | undefined => (typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined);

async function readRecord(jti: string): Promise<{ value: HandoffRecord; version: number } | null> {
  if (!ID.test(jti)) return null;
  try {
    const { body } = await apiRoot.customObjects().withContainerAndKey({ container: IMPERSONATION_CONTAINER, key: jti }).get().execute();
    return { value: body.value as HandoffRecord, version: body.version };
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

const writeRecord = (jti: string, value: HandoffRecord, version: number) =>
  apiRoot.customObjects().post({ body: { container: IMPERSONATION_CONTAINER, key: jti, value, version } }).execute();

/**
 * Claims the record of a verified token for the single use. `true` only when the record is `issued` for this customer, store and actor, the
 * customer belongs to the store (the in-store endpoint answers 404 for another reseller's customer) and this request won the write.
 */
export async function claimHandoff(claims: { customerId: string; storeKey: string; actorId: string; jti: string }): Promise<boolean> {
  const record = await readRecord(claims.jti);
  if (!record || record.value.status !== 'issued') return false;
  const { value } = record;
  if (value.customerId !== claims.customerId || value.storeKey !== claims.storeKey || value.actorId !== claims.actorId) return false;
  try {
    await inStore(claims.storeKey).customers().withId({ ID: claims.customerId }).get().execute();
  } catch (error) {
    if (statusOf(error) === 404) return false;
    throw error;
  }
  try {
    await writeRecord(claims.jti, { ...value, status: 'active' }, record.version);
  } catch (error) {
    if (statusOf(error) === 409) return false; // another request used the token first
    throw error;
  }
  return true;
}

/** The record's status, or `undefined` when it is gone, malformed or cannot be read (the session deadlines still apply). */
export async function getRecordStatus(jti: string): Promise<RecordStatus | undefined> {
  try {
    return (await readRecord(jti))?.value.status;
  } catch {
    return undefined;
  }
}

/** Marks the record `ended`. Best effort: a missing, already ended or unreadable record is not an error. */
export async function endRecord(jti: string): Promise<void> {
  try {
    const record = await readRecord(jti);
    if (!record || record.value.status === 'ended') return;
    await writeRecord(jti, { ...record.value, status: 'ended' }, record.version);
  } catch {
    // The session cookie is cleared anyway and its deadlines are short.
  }
}

/** "Anna M" for the banner (first name and the initial of the last name); `null` without a first name. Never the e-mail address. */
export async function getImpersonatedName(storeKey: string, customerId: string): Promise<string | null> {
  const { body } = await inStore(storeKey).customers().withId({ ID: customerId }).get().execute();
  const first = body.firstName?.trim();
  if (!first) return null;
  const last = body.lastName?.trim();
  return last ? `${first} ${last[0].toUpperCase()}` : first;
}

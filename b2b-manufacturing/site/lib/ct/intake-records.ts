/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';
import { apiRoot } from './client';
import type { IntakeRecord } from '../intake/types';

export type { IntakeRecord, IntakeStatus } from '../intake/types';

/**
 * Intake has no get, list or status endpoint, so each submission is recorded here: a Custom Object per intake, key `<businessUnitKey>.<id>`.
 * Only names and sizes of files are kept, never the prompt or file contents.
 */
export const INTAKE_CONTAINER = 'mpw-intake';
export const LIST_LIMIT = 50;
export const STALE_AFTER_MS = Number(process.env.INTAKE_STALE_MS) > 0 ? Number(process.env.INTAKE_STALE_MS) : 10 * 60 * 1000;
export const STALE_CODE = 'StaleProcessing';

const SAFE_KEY = /^[A-Za-z0-9_-]{1,200}$/;
const keyOf = (businessUnitKey: string, id: string) => `${businessUnitKey}.${id}`;
const statusOf = (error: unknown) => (error as { statusCode?: number }).statusCode;

export async function createIntakeRecord(businessUnitKey: string, input: Pick<IntakeRecord, 'outputType' | 'listName' | 'fileNames' | 'customerId'>): Promise<IntakeRecord> {
  if (!SAFE_KEY.test(businessUnitKey)) throw new Error('Invalid business unit key');
  const record: IntakeRecord = { id: randomUUID(), status: 'processing', warnings: [], createdAt: new Date().toISOString(), ...input };
  await apiRoot.customObjects().post({ body: { container: INTAKE_CONTAINER, key: keyOf(businessUnitKey, record.id), value: record } }).execute();
  return record;
}

/** Moves a `processing` record to its final state. A record that already finished is left alone (a late writer cannot overwrite it). */
export async function finishIntakeRecord(businessUnitKey: string, id: string, outcome: Pick<IntakeRecord, 'status' | 'entity' | 'warnings' | 'errorCode' | 'errorMessage'>): Promise<void> {
  const key = keyOf(businessUnitKey, id);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { body } = await apiRoot.customObjects().withContainerAndKey({ container: INTAKE_CONTAINER, key }).get().execute();
    const current = body.value as IntakeRecord;
    if (current.status !== 'processing') return;
    try {
      await apiRoot.customObjects().post({ body: { container: INTAKE_CONTAINER, key, version: body.version, value: { ...current, ...outcome, completedAt: new Date().toISOString() } } }).execute();
      return;
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
    }
  }
}

/** A record stuck in `processing` past the threshold is presented as failed (the function that owned it did not report back). */
export function presentRecord(record: IntakeRecord, now = Date.now(), staleAfterMs = STALE_AFTER_MS): IntakeRecord {
  if (record.status !== 'processing' || now - Date.parse(record.createdAt) <= staleAfterMs) return record;
  return { ...record, status: 'failed', errorCode: STALE_CODE, errorMessage: 'This request did not finish.' };
}

/** The Business Unit's newest records (the unit always comes from the session). Key range `["<bu>.", "<bu>/")` is the prefix match. */
export async function listIntakeRecords(businessUnitKey: string, now = Date.now()): Promise<IntakeRecord[]> {
  if (!SAFE_KEY.test(businessUnitKey)) return [];
  const where = `key >= "${businessUnitKey}." and key < "${businessUnitKey}/"`;
  const out: IntakeRecord[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const { body } = await apiRoot.customObjects().withContainer({ container: INTAKE_CONTAINER }).get({ queryArgs: { where, sort: 'key asc', limit: 100, offset } }).execute();
    out.push(...body.results.map((o) => o.value as IntakeRecord));
    if (body.results.length < 100) break;
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, LIST_LIMIT).map((r) => presentRecord(r, now));
}

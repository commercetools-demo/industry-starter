/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { after } from 'next/server';
import { ApiError, handle, ok, parseBody, requireBusinessUnit } from '@/lib/api';
import { enforce } from '@/lib/auth-limits';
import { callIntake, type IntakeResult } from '@/lib/ct/intake';
import { createIntakeRecord, finishIntakeRecord, listIntakeRecords } from '@/lib/ct/intake-records';
import { buildPrompt } from '@/lib/intake/prompt';
import { submitIntakeSchema } from '@/lib/intake/schemas';

/** Intake is synchronous and can be slow; the platform's own limit applies (design D1). */
export const maxDuration = 300;

const FAILED = { code: 'IntakeUnavailable', message: 'We could not process your input. Please try again.' };

/**
 * Submit files and/or text to the Intake agent. Multipart body: `outputType` (Cart | ShoppingList | QuoteRequest), `listName` (shopping list), `text`, `files` (up to 3).
 * Answers 202 `{ id }` at once with a `processing` record; the Intake call finishes after the response and updates that record.
 */
export const POST = handle(async (request: Request) => {
  const session = await requireBusinessUnit();
  if (!session.customerEmail) throw new ApiError(400, 'Your account has no email address.');
  await enforce('intake', session.customerId);
  const body = await parseBody(request, submitIntakeSchema);
  const outputType = body.outputType as 'Cart' | 'ShoppingList' | 'QuoteRequest';
  const record = await createIntakeRecord(session.businessUnitKey, { outputType, listName: outputType === 'ShoppingList' ? body.listName?.trim() : undefined, fileNames: body.files.map((f) => f.name), customerId: session.customerId });
  const prompt = buildPrompt({ outputType, email: session.customerEmail, businessUnitKey: session.businessUnitKey, country: session.country, listName: body.listName, text: body.text });
  const { businessUnitKey, locale } = session;

  after(async () => {
    let result: IntakeResult;
    try {
      result = await callIntake({ outputType, locale, prompt, files: body.files.map((f) => ({ name: f.name, data: f })) });
    } catch (error) {
      console.error('intake error', error instanceof Error ? error.name : 'unknown');
      result = { ok: false, code: FAILED.code, message: error instanceof Error && error.message ? error.message : FAILED.message };
    }
    try {
      await finishIntakeRecord(businessUnitKey, record.id, result.ok
        ? { status: 'done', entity: result.entity, warnings: result.warnings }
        : { status: 'failed', warnings: [], errorCode: result.code, errorMessage: result.message });
    } catch (error) {
      console.error('intake record error', error instanceof Error ? error.name : 'unknown');
    }
  });

  return Response.json({ id: record.id }, { status: 202 });
});

/** The signed-in client's recent intakes, newest first (at most 50). A record stuck in `processing` is shown as failed. */
export const GET = handle(async () => {
  const session = await requireBusinessUnit();
  return ok({ intakes: await listIntakeRecords(session.businessUnitKey) });
});

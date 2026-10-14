// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Route helpers of Company & team and Account settings (workstream U-09, U-10). The unit and the customer always come from the
// SESSION, never from a query or body: session (401) -> unit and store (400) -> role (403) -> validation (400) -> work.
import 'server-only';
import type { z } from 'zod';
import { ApiError, handle, requireBusinessUnit } from '@/lib/api';
import { authorizeStore } from '@/lib/authz/authorize-store';
import type { PortalAction } from '@/lib/authz/permissions';
import type { CompanySession } from '@/lib/ct/company';
import { readSession } from '@/lib/portal/seam';

/** `handle` for these routes (domain errors are `ApiError`s). */
export const companyHandle = handle;

/** The signed-in associate in the session's unit, allowed to do `action`. */
export async function companyContext(action: PortalAction): Promise<CompanySession> {
  const session = await readSession();
  requireBusinessUnit(session);
  if (!session.storeKey) throw new ApiError(400, 'No store selected');
  await authorizeStore(session, session.storeKey, action);
  return session as CompanySession;
}

/** Context first (so a Buyer learns nothing about the body rules), then the strict body. */
export async function companyBody<S extends z.ZodType>(request: Request, action: PortalAction, schema: S): Promise<{ session: CompanySession; body: z.infer<S> }> {
  const session = await companyContext(action);
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid request');
  return { session, body: parsed.data };
}

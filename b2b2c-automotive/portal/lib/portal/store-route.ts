// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Route helpers of the Store & channels, Content and Company seller endpoints (workstream U). Every seller endpoint:
//   session (401) -> store and role check with `authorizeStore` (403, before any validation and before any commercetools write)
//   -> zod validation (400) -> work. The store key comes from the request (query or JSON body) and must equal the session's.
import 'server-only';
import type { z } from 'zod';
import { ApiError, errorResponse, handle, requireCustomer } from '@/lib/api';
import { authorizeStore } from '@/lib/authz/authorize-store';
import type { PortalAction } from '@/lib/authz/permissions';
import { CatalogError } from '@/lib/catalog/errors';
import { readSession } from '@/lib/portal/seam';
import { UnprocessableError } from '@/lib/store/errors';
import type { Session } from '@/lib/types';

/** `handle` plus the two domain errors that carry their own status and code (`lib/api.ts` would turn a 422 into a 500). */
export function storeHandle<A extends unknown[]>(fn: (...args: A) => Promise<Response>): (...args: A | [Request, ...unknown[]]) => Promise<Response> {
  return handle(async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof UnprocessableError) return errorResponse(422, error.message, error.code);
      if (error instanceof CatalogError) return errorResponse(error.status, error.message, error.code);
      // Contentools not connected is a state the screens explain, not a failure (503 `contentools_not_connected`).
      if (error instanceof ApiError && error.status === 503) return errorResponse(503, error.message, error.code);
      throw error;
    }
  });
}

export interface Authorized {
  session: Session & { customerId: string };
  storeKey: string;
}

/** Signed in (401), `storeKey` present (400), equal to the session's store and allowed for the role (403). */
export async function authorizeRequest(storeKey: unknown, action: PortalAction): Promise<Authorized> {
  const session = await readSession();
  requireCustomer(session);
  if (typeof storeKey !== 'string' || storeKey === '') throw new ApiError(400, 'storeKey is required');
  await authorizeStore(session, storeKey, action);
  return { session, storeKey };
}

/** For GET and DELETE: the store key is the `storeKey` query parameter. */
export function authorizeQuery(request: Request, action: PortalAction): Promise<Authorized> {
  return authorizeRequest(new URL(request.url).searchParams.get('storeKey'), action);
}

/** For POST and PUT with a JSON body: authorize on the raw `storeKey`, only then validate the whole body. */
export async function authorizeBody<S extends z.ZodType>(request: Request, action: PortalAction, schema: S): Promise<Authorized & { body: z.infer<S> }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    // The session is still checked first so an anonymous caller learns nothing about the body rules.
    requireCustomer(await readSession());
    throw new ApiError(400, 'Invalid JSON body');
  }
  const authorized = await authorizeRequest((raw as { storeKey?: unknown } | null)?.storeKey, action);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid request');
  return { ...authorized, body: parsed.data };
}

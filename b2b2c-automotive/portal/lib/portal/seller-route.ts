// Shared plumbing of the catalog seller routes (workstream T): authorization first, then validation, then the service call.
//   authorizeSeller(storeKey, action)  the store must be the session's store and the role must allow the action, BEFORE any
//                                      commercetools call (R `authorizeStore`; in the dev fixture mode the fixture roles decide)
//   sellerHandle(fn)                   `handle` plus the mapping of `CatalogError` to `{ error, code, ...details }` with its status
//   storeKeyParam(url)                 `?storeKey=` of a GET
import 'server-only';
import { z } from 'zod';
import { CatalogError } from '@/lib/catalog/errors';
import { authorizeStore } from '@/lib/authz/authorize-store';
import { can, type PortalAction } from '@/lib/authz/permissions';
import { ApiError, handle, json, requireCustomer } from './route-kit';
import { devFixturesEnabled, getPorts, readSession } from './seam';
import type { PortalSession } from './types';

export const StoreKey = z.string().min(1).max(256);

/** 401 without a customer, 403 for another store or a role that may not do the action. Returns the session. */
export async function authorizeSeller(storeKey: string, action: PortalAction): Promise<PortalSession> {
  const session = await readSession();
  requireCustomer(session);
  if (devFixturesEnabled()) {
    const viewer = await getPorts().loadViewer(session);
    if (!session.businessUnitKey || session.pending || !viewer || !session.storeKey || session.storeKey !== storeKey) throw new ApiError(403, 'Forbidden');
    if (!can({ roles: viewer.roles, ctPermissions: viewer.ctPermissions }, action)) throw new ApiError(403, 'Forbidden');
    return session;
  }
  await authorizeStore(session, storeKey, action);
  return session;
}

export function sellerHandle<A extends unknown[]>(fn: (...args: A) => Promise<Response>): (...args: A | [Request, ...unknown[]]) => Promise<Response> {
  return handle(async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof CatalogError) return json({ error: error.message, code: error.code, ...error.details }, { status: error.status });
      throw error;
    }
  });
}

/**
 * Body of a seller write: reads the JSON, authorizes by its `storeKey` (403 before anything else is checked or read), then
 * validates the whole body against the strict schema (400 with the first issue). Unknown keys fail the strict schemas.
 */
export async function authorizedBody<T extends { storeKey: string }>(request: Request, schema: z.ZodType<T>, action: PortalAction): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
  const head = z.object({ storeKey: StoreKey }).loose().safeParse(raw);
  if (!head.success) throw new ApiError(400, 'storeKey is required');
  await authorizeSeller(head.data.storeKey, action);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid request');
  return parsed.data;
}

/** `storeKey` of a GET query: 400 when missing. */
export function storeKeyParam(request: Request): string {
  const value = new URL(request.url).searchParams.get('storeKey');
  const parsed = StoreKey.safeParse(value);
  if (!parsed.success) throw new ApiError(400, 'storeKey is required');
  return parsed.data;
}

/** Integer query parameter with a default and a maximum. */
export function intParam(request: Request, name: string, fallback: number, max: number): number {
  const raw = new URL(request.url).searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new ApiError(400, `${name} must be a whole number`);
  return Math.min(n, max);
}

export function textParam(request: Request, name: string): string | undefined {
  const raw = new URL(request.url).searchParams.get(name);
  return raw ? raw.slice(0, 200) : undefined;
}

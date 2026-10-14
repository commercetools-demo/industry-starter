// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Errors and route plumbing of the account area (workstream Q). A refusal is a machine `code` (the UI maps it to a localized message),
// never an SDK message. Only the password rule name is added to the answer, so the form can say which rule failed.
import 'server-only';
import { ApiError, handle, requireCustomer } from '@/lib/api';
import { isImpersonating } from '@/lib/impersonation/state';
import { getSession } from '@/lib/session';
import type { Session } from '@/lib/types';

export class AccountError extends ApiError {
  constructor(
    public readonly code: string,
    status = 400,
    public readonly detail?: string,
  ) {
    super(status, code);
    this.name = 'AccountError';
  }
}

/** By name, so a copy of the class loaded twice (hot reload, module reset in tests) is still recognised. */
export const isAccountError = (error: unknown): error is AccountError => error instanceof AccountError || (error instanceof Error && error.name === 'AccountError');

export const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/** Like `handle`, and an `AccountError` answers `{ error: code, rule? }` with its status. */
export function accountHandle<A extends unknown[]>(fn: (...a: A) => Promise<Response>): (...a: A) => Promise<Response> {
  return handle(async (...args: A) => {
    try {
      // shop-as (Q-V25, workstream X C21): a seller shopping as a customer may look, never change the account.
      const request = args[0];
      if (request instanceof Request && request.method !== 'GET' && request.method !== 'HEAD') {
        if (isImpersonating(await getSession())) throw new AccountError('impersonation-restricted', 403);
      }
      return await fn(...args);
    } catch (error) {
      if (isAccountError(error)) return Response.json({ error: error.code, ...(error.detail ? { rule: error.detail } : {}) }, { status: error.status, headers: NO_STORE });
      throw error;
    }
  });
}

/** The signed-in session of an account route: 401 without a customer, 404 without a store. Every query is scoped by these two values. */
export async function accountSession(): Promise<Session & { customerId: string; storeKey: string }> {
  const session = await getSession();
  requireCustomer(session);
  if (!session.storeKey) throw new ApiError(404, 'Not found');
  return { ...session, customerId: session.customerId, storeKey: session.storeKey };
}

export const statusOf = (error: unknown): number | undefined => (typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined);
export const errorCodes = (error: unknown): string[] => ((error as { body?: { errors?: { code?: string }[] } })?.body?.errors ?? []).map((e) => e.code ?? '');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A customer or resource id from a session or a URL, checked before it goes into a predicate. */
export function safeId(value: string): string {
  if (!UUID.test(value)) throw new AccountError('not-found', 404);
  return value;
}

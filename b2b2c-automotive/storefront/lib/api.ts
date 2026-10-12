// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import type { z } from 'zod';
import type { Session } from '@/lib/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Safe messages by status. Anything else is "Something went wrong"; SDK messages never reach the browser. */
const SAFE_MESSAGES: Record<number, string> = {
  401: 'Not signed in',
  403: 'Insufficient permissions to perform this task',
  404: 'Not found',
  409: 'Conflict, please retry',
};
const GENERIC = 'Something went wrong';

function sdkStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { statusCode, status } = error as { statusCode?: unknown; status?: unknown };
  const value = typeof statusCode === 'number' ? statusCode : typeof status === 'number' ? status : undefined;
  return value !== undefined && value >= 400 && value < 600 ? value : undefined;
}

/** Maps any thrown value to `{ status, error }` with a safe message. */
export function toApiFailure(error: unknown): { status: number; message: string } {
  if (error instanceof ApiError) return { status: error.status, message: error.message };
  const status = sdkStatus(error);
  if (status === 404 || status === 409 || status === 401 || status === 403) return { status, message: SAFE_MESSAGES[status] };
  return { status: 500, message: GENERIC };
}

/**
 * Wraps a Route Handler: ApiError and commercetools SDK errors (`statusCode`) become `{ "error": "<safe message>" }`.
 * Logs only the status and the error class, never the message, body, headers or credentials.
 */
export function handle<A extends unknown[]>(fn: (...a: A) => Promise<Response>): (...a: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      const { status, message } = toApiFailure(error);
      if (status >= 500) console.error(`[api] failed with status ${status} (${error instanceof Error ? error.constructor.name : typeof error})`);
      return Response.json({ error: message }, { status });
    }
  };
}

export function requireCustomer(session: Session): asserts session is Session & { customerId: string } {
  if (!session.customerId) throw new ApiError(401, SAFE_MESSAGES[401]);
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, result.error.issues[0]?.message ?? 'Invalid request');
  return result.data;
}

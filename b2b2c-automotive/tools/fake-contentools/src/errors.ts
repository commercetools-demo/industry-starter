// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

/**
 * Mirrors the real service's `CustomError` (service/src/errors/custom.error.ts). The error middleware answers with
 * `{ message, errors? }` and the status code of the error.
 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors?: unknown[],
  ) {
    super(message);
  }
}

/**
 * An error that is NOT a `CustomError` in the real service (a raw commercetools SDK error, a body-parser error, a
 * multer error). The real error middleware turns every such error into `500 { message: 'Internal server error' }`.
 */
export class RawUpstreamError extends Error {}

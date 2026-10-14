/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** An error whose message is safe to show to the visitor. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

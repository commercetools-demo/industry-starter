// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { validateEnv } from '@/lib/env';

/** Fail fast at server start: a missing variable or a weak SESSION_SECRET stops the server with a message naming the variable. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'test') validateEnv(process.env);
}

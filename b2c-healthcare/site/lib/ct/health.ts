/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { getApiRoot } from '@/lib/ct/client';

/**
 * Project key for the development smoke page, or null when the connection is not available (missing
 * credentials, network, wrong scopes). Never throws and never reveals why, so a bare checkout renders.
 */
export function tryProjectKey(): Promise<string | null> {
  return checkConnection().then(
    ({ projectKey }) => projectKey,
    () => null,
  );
}

/** Calls the project endpoint with the storefront client; returns the project key on success. */
export async function checkConnection(): Promise<{ projectKey: string }> {
  const { body } = await getApiRoot().get().execute();
  return { projectKey: body.key };
}

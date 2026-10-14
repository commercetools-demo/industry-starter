/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

export function scanBundle(dir: string, env: Record<string, string | undefined>): string[];
export function loadSecretValues(siteDir: string, base?: Record<string, string | undefined>): Record<string, string | undefined>;

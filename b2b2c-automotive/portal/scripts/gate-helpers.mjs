/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import path from 'node:path';
import { scanBundle } from './check-bundle-secrets.mjs';

/** Scans `.next/static` of an app root with no secrets; a missing directory is a pass. */
export const checkBundleSecretsDir = (root) => scanBundle(path.join(root, '.next', 'static'), []);

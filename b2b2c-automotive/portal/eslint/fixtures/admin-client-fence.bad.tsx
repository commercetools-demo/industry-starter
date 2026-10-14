/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { adminApiRoot } from '@/lib/ct/admin-client';
import { provisioningApiRoot } from '@/lib/ct/provisioning-client';

export const roots = [adminApiRoot, provisioningApiRoot];

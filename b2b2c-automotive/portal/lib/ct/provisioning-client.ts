// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import type { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { createApiRoot } from '@/lib/ct/client';
import { validatePortalEnv } from '@/lib/env';

let cached: ByProjectKeyRequestBuilder | null = null;

/**
 * Provisioning client (`CTP_PROVISION_*`), used only by the registration endpoint (`app/api/auth/register/**`) to create
 * a pending reseller business unit and its first administrator. Created lazily, once.
 */
export function getProvisioningRoot(): ByProjectKeyRequestBuilder {
  if (cached) return cached;
  const { provisioning } = validatePortalEnv(process.env);
  if (!provisioning) throw new Error('Provisioning client is not configured');
  cached = createApiRoot(provisioning);
  return cached;
}

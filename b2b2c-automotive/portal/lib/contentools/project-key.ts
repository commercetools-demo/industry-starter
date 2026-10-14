// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Copied from storefront/lib/contentools/project-key.ts. The commercetools project key is the Contentools tenant. It is
// not a secret. Reading it here keeps the Contentools modules free of lib/ct (which builds the SDK client).
import 'server-only';

export function getProjectKey(): string {
  return process.env.CTP_PROJECT_KEY ?? '';
}

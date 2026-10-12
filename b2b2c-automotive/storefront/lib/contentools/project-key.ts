// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Thin seam: the commercetools project key is the Contentools tenant. It is not a secret. Reading it here keeps the
// Contentools modules free of lib/ct (which builds the SDK client); G's validateEnv makes the variable mandatory.
import 'server-only';

export function getProjectKey(): string {
  return process.env.CTP_PROJECT_KEY ?? '';
}

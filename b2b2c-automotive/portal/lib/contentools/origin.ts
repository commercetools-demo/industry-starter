// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Copied from storefront/lib/contentools/origin.ts (workstream H); the apps are separate packages.
// The only reader of CONTENTOOLS_ORIGIN (lib/env.ts validates the variable by name). No `server-only`: client code
// imports CONTENTOOLS_PROXY_BASE. There is no default URL; validatePortalEnv makes the variable mandatory.
export const CONTENTOOLS_ORIGIN = (process.env.CONTENTOOLS_ORIGIN ?? '').replace(/\/+$/, '');
export const CONTENTOOLS_PROXY_BASE = '/api/contentools/service';

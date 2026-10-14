// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Copied from storefront/lib/contentools/origin.ts (workstream H); the apps are separate packages.
// The only reader of CONTENTOOLS_ORIGIN (lib/env.ts validates the variable by name). No `server-only`: client code
// imports CONTENTOOLS_PROXY_BASE. There is no default URL; validatePortalEnv makes the variable mandatory.
/** The origin without trailing slashes and without a trailing `/service`: every URL built from it adds `/service/<store>/...` itself. */
export const normalizeContentoolsOrigin = (value: string): string => value.trim().replace(/\/+$/, '').replace(/\/service$/i, '');
export const CONTENTOOLS_ORIGIN = normalizeContentoolsOrigin(process.env.CONTENTOOLS_ORIGIN ?? '');
export const CONTENTOOLS_PROXY_BASE = '/api/contentools/service';

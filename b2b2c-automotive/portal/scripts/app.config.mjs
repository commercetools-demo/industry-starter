/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// The only per-app differences of the gate scripts (the scripts are copied between storefront/ and portal/).
export const APP = 'portal';

/** Variables that must never carry a NEXT_PUBLIC_ prefix and must be listed empty in .env.example. */
export const SECRET_VARS = [
  'CTP_PROJECT_KEY',
  'CTP_AUTH_URL',
  'CTP_API_URL',
  'CTP_CLIENT_ID',
  'CTP_CLIENT_SECRET',
  'CTP_SCOPES',
  'CTP_ADMIN_CLIENT_ID',
  'CTP_ADMIN_CLIENT_SECRET',
  'CTP_ADMIN_SCOPES',
  'CTP_PROVISION_CLIENT_ID',
  'CTP_PROVISION_CLIENT_SECRET',
  'CTP_PROVISION_SCOPES',
  'SESSION_SECRET',
  'CONTENTOOLS_ORIGIN',
  'IMPERSONATION_SECRET',
];

/** Values that are scanned for in the client bundle. */
export const BUNDLE_SECRET_NAMES = [
  'CTP_CLIENT_SECRET',
  'CTP_ADMIN_CLIENT_SECRET',
  'CTP_PROVISION_CLIENT_SECRET',
  'SESSION_SECRET',
  'IMPERSONATION_SECRET',
];

/** Where the admin and provisioning clients may be imported (portal only; enforced by ESLint, see eslint/). */
export const ADMIN_CLIENT_ALLOWED = ['app/api/seller/**', 'lib/ct/seller/**', 'lib/contentools/jwt.ts'];

/** Path of the design source for tokens.css, relative to the app root. */
export const TOKENS_SOURCE = '../design/export/tokens.admin.css';

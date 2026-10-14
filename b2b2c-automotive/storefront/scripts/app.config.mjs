// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The only differences between the gate scripts of the storefront and the portal.
export const APP = 'storefront';
export const SECRET_VARS = ['CTP_CLIENT_ID', 'CTP_CLIENT_SECRET', 'SESSION_SECRET'];
/** Every variable that must be listed (empty) in .env.example. */
export const ENV_VARS = ['CTP_PROJECT_KEY', 'CTP_AUTH_URL', 'CTP_API_URL', 'CTP_CLIENT_ID', 'CTP_CLIENT_SECRET', 'CTP_SCOPES', 'SESSION_SECRET', 'CONTENTOOLS_ORIGIN'];
/** Storefront has no admin client. */
export const ADMIN_CLIENT_ALLOWED = [];
/** Design source of the token file, relative to the app root. */
export const TOKENS_SOURCE = '../design/export/tokens.automotive.css';

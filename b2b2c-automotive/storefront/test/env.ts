// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Vitest setup: dummy configuration so modules that validate the environment can be imported. Never a real secret.
const defaults: Record<string, string> = {
  CTP_PROJECT_KEY: 'test-project',
  CTP_AUTH_URL: 'https://auth.example.test',
  CTP_API_URL: 'https://api.example.test',
  CTP_CLIENT_ID: 'test-client-id',
  CTP_CLIENT_SECRET: 'test-client-secret',
  CTP_SCOPES: 'view_stores view_project_settings',
  SESSION_SECRET: 'x'.repeat(48),
  ORDER_ACCESS_SECRET: 'o'.repeat(48),
  CONTENTOOLS_ORIGIN: 'https://contentools.example.test',
  NOMINATIM_CONTACT: 'ops@example.test',
};
for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value;
}

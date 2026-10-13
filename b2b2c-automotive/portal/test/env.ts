// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Vitest setup: dummy configuration so modules that validate the environment can be imported. Never a real secret.
const defaults: Record<string, string> = {
  CTP_PROJECT_KEY: 'test-project',
  CTP_AUTH_URL: 'https://auth.example.test',
  CTP_API_URL: 'https://api.example.test',
  CTP_CLIENT_ID: 'test-client-id',
  CTP_CLIENT_SECRET: 'dummy-client-secret',
  CTP_SCOPES: 'view_stores view_project_settings',
  CTP_ADMIN_CLIENT_ID: 'test-admin-client-id',
  CTP_ADMIN_CLIENT_SECRET: 'dummy-admin-client-secret',
  CTP_ADMIN_SCOPES: 'manage_key_value_documents',
  CTP_PROVISION_CLIENT_ID: 'test-provision-client-id',
  CTP_PROVISION_CLIENT_SECRET: 'dummy-provision-client-secret',
  CTP_PROVISION_SCOPES: 'manage_business_units',
  SESSION_SECRET: 'x'.repeat(48),
  CONTENTOOLS_ORIGIN: 'https://contentools.example.test',
};
for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value;
}

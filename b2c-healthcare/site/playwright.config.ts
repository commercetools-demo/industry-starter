import { defineConfig } from '@playwright/test';

/**
 * End-to-end sweep. Runs against `next dev` with MALVA_FIXTURES=1 (no commercetools needed).
 * Not part of `npm run check`: use `npm run e2e`. Port 3120 (E2E_PORT overrides it).
 */
const port = Number(process.env.E2E_PORT ?? 3120);

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${port}`, trace: 'off' },
  webServer: {
    command: `npx next dev -p ${port}`,
    url: `http://localhost:${port}/en-US`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      MALVA_FIXTURES: '1',
      AUTO_REFILL_ENABLED: 'true',
      PORT: String(port),
      SESSION_SECRET: 'e2e-session-secret-e2e-session-secret-0000',
      CTP_PROJECT_KEY: 'e2e',
      CTP_AUTH_URL: 'http://localhost:1',
      CTP_API_URL: 'http://localhost:1',
      CTP_CLIENT_ID: 'e2e',
      CTP_CLIENT_SECRET: 'e2e',
      CTP_SCOPES: 'e2e',
    },
  },
});

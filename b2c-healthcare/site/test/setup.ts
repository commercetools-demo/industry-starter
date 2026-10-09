import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Deployment variables (a Netlify build has them all set) must not change what a unit test sees: a test that needs one stubs it.
const DEPLOYMENT_ENV = ['AUTO_REFILL_ENABLED', 'SITE_URL', 'DEMO_LOGIN_PASSWORD', 'SESSION_SECRET'];

beforeEach(() => {
  for (const name of DEPLOYMENT_ENV) vi.stubEnv(name, undefined);
});

// `globals` is off, so Testing Library's automatic cleanup is wired here.
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

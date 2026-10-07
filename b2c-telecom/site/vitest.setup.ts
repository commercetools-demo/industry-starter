import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// Offline guard: unit tests never reach the network. Tests that need fetch use vi.stubGlobal('fetch', ...).
globalThis.fetch = (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  throw new Error(`Network is disabled in unit tests (fetch ${url}); stub fetch or mock the module.`);
};

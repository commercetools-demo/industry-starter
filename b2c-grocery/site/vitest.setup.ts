import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

// next/font/google needs the Next build pipeline; return fixed class names in unit tests.
vi.mock('next/font/google', () => ({
  Caprasimo: () => ({ variable: 'font-var', className: 'font-cls' }),
  Figtree: () => ({ variable: 'font-var', className: 'font-cls' }),
}));

// Offline guard (platform-stack "Offline tests"): a unit test that reaches for the network fails at once, so `npm test` needs neither network nor credentials. Tests that need `fetch` stub it themselves.
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  throw new Error(`Network is disabled in unit tests (fetch ${target}); stub fetch or mock the module.`);
}) as typeof fetch;

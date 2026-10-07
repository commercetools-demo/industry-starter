import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

// Offline guard: unit tests never reach the network. Tests that need fetch use vi.stubGlobal('fetch', ...).
globalThis.fetch = (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  throw new Error(`Network is disabled in unit tests (fetch ${url}); stub fetch or mock the module.`);
};

// next/font/google downloads at build time; unit tests get inert loaders returning a CSS variable and a class.
vi.mock('next/font/google', () => ({
  Exo: vi.fn(() => ({ variable: 'font-exo-var', className: 'font-exo' })),
  Inter: vi.fn(() => ({ variable: 'font-inter-var', className: 'font-inter' })),
  Roboto: vi.fn(() => ({ variable: 'font-roboto-var', className: 'font-roboto' })),
}));

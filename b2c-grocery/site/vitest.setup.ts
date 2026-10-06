import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

// next/font/google needs the Next build pipeline; return fixed class names in unit tests.
vi.mock('next/font/google', () => ({
  Caprasimo: () => ({ variable: 'font-var', className: 'font-cls' }),
  Figtree: () => ({ variable: 'font-var', className: 'font-cls' }),
}));

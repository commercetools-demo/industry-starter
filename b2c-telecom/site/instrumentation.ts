import { validateEnv } from './lib/ct/env-core';

// Stops `next start` with the name of the missing or weak variable. Development and test never validate up front.
export function register(): void {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
    validateEnv(process.env);
  }
}

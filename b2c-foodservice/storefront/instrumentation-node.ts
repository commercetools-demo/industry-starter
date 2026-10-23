// Node-only part of the start-up check (see instrumentation.ts). It lives in its own file so the Edge bundle never sees `process.exit`.
import { getEnv } from '@/lib/env';

export function checkEnvironment(): void {
  try {
    getEnv();
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') throw e;
    console.error(e instanceof Error ? e.message : 'The environment is not valid');
    process.exit(1);
  }
}

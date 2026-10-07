export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
    const { validateEnv } = await import('./lib/env-core');
    validateEnv();
  }
}

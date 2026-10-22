// Fail fast: an invalid environment stops the server before it serves a request.
// In production the process exits with 1 after printing the message (it names the variable, never a value); a server that
// stayed up would answer 500 on every route and look healthy to a process manager (found by Q, bootstrap.md S1). In
// development the error is thrown so the overlay shows it and a fixed `.env.local` is read without a restart.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { getEnv } = await import('@/lib/env');
  try {
    getEnv();
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') throw e;
    console.error(e instanceof Error ? e.message : 'The environment is not valid');
    process.exit(1);
  }
}

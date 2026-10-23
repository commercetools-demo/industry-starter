// Fail fast: an invalid environment stops the server before it serves a request.
// In production the process exits with 1 after printing the message (it names the variable, never a value); a server that
// stayed up would answer 500 on every route and look healthy to a process manager (found by Q, bootstrap.md S1). In
// development the error is thrown so the overlay shows it and a fixed `.env.local` is read without a restart.
// The check is in instrumentation-node.ts: `process.exit` in this file made Next warn that it is not supported in the Edge runtime.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { checkEnvironment } = await import('./instrumentation-node');
    checkEnvironment();
  }
}

// Clears the in-memory rate limiter between tests (it is per process).
export function resetRateLimitForTests(): void {
  (globalThis as { __malvaRateLimit?: Map<string, unknown> }).__malvaRateLimit?.clear();
}

// Capability flags for claims the storefront may only make when the service can honor them.
// Pure and server-side: the home page reads them at request time.

/**
 * Whether auto-refills exist (workstream T, recurring orders). Defaults to FALSE: the "Auto-refills you can
 * pause anytime" claim is shown only after T ships and `AUTO_REFILL_ENABLED=true` is set.
 */
export function autoRefillEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.AUTO_REFILL_ENABLED ?? '').trim().toLowerCase() === 'true';
}

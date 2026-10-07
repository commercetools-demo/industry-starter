import 'server-only';
import { SERVICEABILITY_TTL } from '@/lib/config/cache';
import { createCachedServiceability, createStubProvider, type StubMode } from '@/lib/offers/serviceability';

type Service = ReturnType<typeof createCachedServiceability>;

let instance: Service | undefined;

/** `SERVICEABILITY_STUB`: `table` | `all` | `none`; anything else or unset is `table`. */
export function stubModeFromEnv(raw: string | undefined): StubMode {
  return raw === 'all' || raw === 'none' ? raw : 'table';
}

/** One cached provider per server process (the stub is deterministic, a lost cache only costs a lookup). */
export function getServiceability(): Service {
  instance ??= createCachedServiceability(createStubProvider(stubModeFromEnv(process.env.SERVICEABILITY_STUB)), SERVICEABILITY_TTL);
  return instance;
}

/** Test seam: forget the singleton so the next call re-reads the environment. */
export function resetServiceabilityForTests(): void {
  instance = undefined;
}

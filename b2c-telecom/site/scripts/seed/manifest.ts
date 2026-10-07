// Assembles the seed manifest from the typed data modules (data/index.ts). Demo customers and orders only with --with-demo.
import { DEMO, MANIFEST, PLATFORM_MANIFEST } from './data';
import type { SeedManifest } from './types';

export function buildManifest(opts: { withDemo: boolean } = { withDemo: false }): SeedManifest {
  return opts.withDemo ? { ...MANIFEST, ...DEMO } : { ...MANIFEST };
}

/** Market-level resources only (workstream F's part); the framework tests use it. */
export function buildPlatformManifest(): SeedManifest {
  return { ...PLATFORM_MANIFEST };
}

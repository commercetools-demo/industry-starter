// npm run lint:catalog: reads the live catalog through workstream H and prints the findings of lib/offers/lint.ts.
// Exits 1 on any error. Not part of `npm run verify` (needs network and credentials).
import Module from 'node:module';

type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;

// `next/cache` needs the Next.js runtime; outside it `unstable_cache` throws, so a script reads uncached.
function bypassNextCache(): void {
  const internals = Module as unknown as { _load: Loader };
  const original = internals._load;
  internals._load = (request, parent, isMain) =>
    request === 'next/cache' ? { unstable_cache: <T>(fn: T): T => fn } : original.call(Module, request, parent, isMain);
}

async function main(): Promise<number> {
  bypassNextCache();
  const [{ getAllOffers }, { MARKETS }, { lintCatalog }] = await Promise.all([
    import('@/lib/ct/catalog'),
    import('@/lib/config/markets'),
    import('@/lib/offers/lint'),
  ]);
  const offers = await getAllOffers(MARKETS['en-US']);
  const findings = lintCatalog(offers);
  console.log(`Checked ${offers.length} offers.`);
  for (const finding of findings) console.log(`${finding.level} ${finding.offerKey}: ${finding.message}`);
  const errors = findings.filter((finding) => finding.level === 'error').length;
  console.log(`${errors} error(s), ${findings.length - errors} warning(s).`);
  return errors > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  },
);

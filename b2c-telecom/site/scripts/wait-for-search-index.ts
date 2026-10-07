// npm run search:wait: blocks until Product Search returns the seeded offer "Cable 500" (the index lags writes by minutes, D-056).
// Polls every 30 s for at most 40 attempts (20 minutes), prints the elapsed time and exits 1 on timeout. Read-only; uses .env.local.
// Not part of `npm run verify` (needs network and credentials).
import Module from 'node:module';

type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;

// `next/cache` needs the Next.js runtime; outside it `unstable_cache` throws, so a script reads uncached.
function bypassNextCache(): void {
  const internals = Module as unknown as { _load: Loader };
  const original = internals._load;
  internals._load = (request, parent, isMain) =>
    request === 'next/cache' ? { unstable_cache: <T>(fn: T): T => fn } : original.call(Module, request, parent, isMain);
}

const INTERVAL_MS = 30_000;
const ATTEMPTS = 40;

async function main(): Promise<number> {
  bypassNextCache();
  const [{ searchOfferHits }, { pollUntil }] = await Promise.all([import('@/lib/ct/search'), import('@/lib/search/pollUntil')]);
  const started = Date.now();
  const seconds = (): number => Math.round((Date.now() - started) / 1000);
  try {
    const attempt = await pollUntil(
      async () => {
        const { total } = await searchOfferHits({ text: 'Cable 500', locale: 'en-US' });
        console.log(`[search:wait] ${seconds()} s: ${total} hit(s)`);
        return total >= 1;
      },
      { intervalMs: INTERVAL_MS, attempts: ATTEMPTS },
    );
    console.log(`Search index ready after ${seconds()} s (attempt ${attempt}).`);
    return 0;
  } catch {
    console.error(`Search index not ready after ${seconds()} s.`);
    return 1;
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  },
);

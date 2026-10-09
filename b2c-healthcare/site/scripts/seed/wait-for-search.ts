import { getAdminRoot, isMain, PREFIX, realSleep, type Root } from './lib';

/**
 * Confirms Product Search indexing is Activated and polls until the index holds the seeded products.
 *
 *   npx tsx scripts/seed/wait-for-search.ts [--expected 28] [--timeout-min 5]
 *
 * Read-only. The Product Search request needs a `query`; `prefix` on `key` counts the products the seed created.
 */
export interface WaitOptions {
  expected: number;
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (line: string) => void;
}

export async function indexingStatus(root: Root): Promise<string | undefined> {
  const project = (await root.get().execute()).body as { searchIndexing?: { productsSearch?: { status?: string } } };
  return project.searchIndexing?.productsSearch?.status;
}

export async function searchCount(root: Root): Promise<number> {
  const res = await root.products().search().post({ body: { query: { prefix: { field: 'key', value: PREFIX } }, limit: 1 } as never }).execute();
  return (res.body as { total: number }).total;
}

export async function waitForSearch(root: Root, o: WaitOptions): Promise<number> {
  const { timeoutMs = 5 * 60_000, intervalMs = 10_000, sleep = realSleep, now = Date.now, log = console.log } = o;
  const status = await indexingStatus(root);
  if (status !== 'Activated') throw new Error(`searchIndexing.productsSearch.status is "${String(status)}", expected "Activated". Activate it first (PROJECT-FINDINGS.md).`);
  const deadline = now() + timeoutMs;
  for (;;) {
    const total = await searchCount(root);
    log(`search index holds ${total} of ${o.expected} seeded products`);
    if (total >= o.expected) return total;
    if (now() + intervalMs > deadline) throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)} s: index has ${total} of ${o.expected} products`);
    await sleep(intervalMs);
  }
}

export function parseWaitArgs(argv: string[], defaultExpected: number): { expected: number; timeoutMs: number } {
  const get = (n: string) => (argv.includes(n) ? Number(argv[argv.indexOf(n) + 1]) : undefined);
  const expected = get('--expected') ?? defaultExpected;
  const minutes = get('--timeout-min') ?? 5;
  if (!Number.isInteger(expected) || expected < 0) throw new Error('--expected must be a non-negative integer');
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 30) throw new Error('--timeout-min must be between 0 and 30');
  return { expected, timeoutMs: minutes * 60_000 };
}

/** 8 doctors + 20 medications; a data test (data.test.ts) keeps this equal to the data files. */
export const DEFAULT_EXPECTED = 28;

async function main() {
  const { expected, timeoutMs } = parseWaitArgs(process.argv.slice(2), DEFAULT_EXPECTED);
  const { root } = await getAdminRoot();
  await waitForSearch(root, { expected, timeoutMs });
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

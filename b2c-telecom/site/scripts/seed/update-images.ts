// npm run seed:images -- [--dry-run] [--only <key>] [--count 2] [--max-lookups 40]
//
// Refreshes the committed lock file `data/product-images.json` (D-055): only keys without an entry, or whose search term
// changed, are looked up. The search is the public JSON endpoint behind pexels.com/search: no account, no API key, no
// cookie. It is undocumented and may change (accepted risk, D-055). Nothing is written to commercetools: `npm run seed`
// attaches the recorded images.
import { writeFileSync } from 'node:fs';
import { consoleLog, parseArgs, type Log } from './cli';
import { IMAGE_TARGETS } from './data/image-terms';
import {
  DEFAULT_COUNT,
  DEFAULT_MAX_LOOKUPS,
  FALLBACK_SIZE,
  LOCK_FILE,
  jpegSize,
  pendingTargets,
  readLock,
  refreshLock,
  type Lock,
  type RefreshDeps,
  type SearchResult,
} from './images';

const ENDPOINT = 'https://www.pexels.com/en-us/api/v3/getty-media/photos';
/** Public client id the pexels.com web app itself sends (same as the grocery seed); without it the endpoint answers 401. */
const CLIENT_ID = process.env.PEXELS_CLIENT_ID ?? '4faffa81915014bbd90c420f22898950';

export function parseImageArgs(argv: string[]): { dryRun: boolean; only?: string; count: number; maxLookups: number } {
  const { flags, values } = parseArgs(argv, ['only', 'count', 'max-lookups']);
  const count = Number(values.get('count') ?? DEFAULT_COUNT);
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error('--count must be an integer from 1 to 6');
  const maxLookups = Number(values.get('max-lookups') ?? DEFAULT_MAX_LOOKUPS);
  if (!Number.isInteger(maxLookups) || maxLookups < 1) throw new Error('--max-lookups must be a positive integer');
  const only = values.get('only');
  return { dryRun: flags.has('dry-run'), ...(only ? { only } : {}), count, maxLookups };
}

export const liveDeps: RefreshDeps = {
  async search(term, number): Promise<SearchResult> {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(term)}?number=${number}&page=1`, {
      headers: { accept: '*/*', 'content-type': 'application/json', 'x-client-type': 'react', 'pexels-client-id': CLIENT_ID, 'user-agent': 'malva-seed' },
    });
    const header = res.headers.get('x-ratelimit-remaining');
    const remaining = header !== null && header !== '' && Number.isFinite(Number(header)) ? Number(header) : undefined;
    const body = res.ok ? ((await res.json()) as unknown) : undefined;
    return { status: res.status, ...(remaining !== undefined ? { remaining } : {}), body };
  },
  async measure(url) {
    const res = await fetch(url); // follows the redirect to the sized image
    return res.ok ? (jpegSize(new Uint8Array(await res.arrayBuffer())) ?? FALLBACK_SIZE) : FALLBACK_SIZE;
  },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export function hostsOf(lock: Lock): Map<string, number> {
  const hosts = new Map<string, number>();
  for (const entry of Object.values(lock)) {
    for (const image of entry.images) {
      const host = new URL(image.url).hostname;
      hosts.set(host, (hosts.get(host) ?? 0) + 1);
    }
  }
  return hosts;
}

export interface ImageDeps {
  deps?: RefreshDeps;
  log?: Log;
  file?: string;
  write?: (file: string, text: string) => void;
}

export async function main(argv: string[], d: ImageDeps = {}): Promise<number> {
  const log = d.log ?? consoleLog;
  const file = d.file ?? LOCK_FILE;
  let args: ReturnType<typeof parseImageArgs>;
  try {
    args = parseImageArgs(argv);
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
    return 1;
  }
  if (args.only && !IMAGE_TARGETS.some((t) => t.key === args.only)) {
    log(`No image target with key "${args.only}"`);
    return 1;
  }
  const lock = readLock(file);
  const todo = pendingTargets(lock, IMAGE_TARGETS).filter((t) => !args.only || t.key === args.only);
  if (todo.length === 0) {
    log('Nothing to look up: the lock file is complete.');
    return 0;
  }
  const report = await refreshLock(lock, IMAGE_TARGETS, d.deps ?? liveDeps, { count: args.count, maxLookups: args.maxLookups, ...(args.only ? { only: args.only } : {}) });
  for (const target of todo) {
    const entry = report.lock[target.key];
    if (!entry || entry.images.length === 0) continue;
    log(`${args.dryRun ? 'would set' : 'recorded'}  ${target.key}  ("${target.term}")`);
    for (const image of entry.images) log(`  ${image.url}  ${image.dimensions.w}x${image.dimensions.h}  photographer: ${image.photographer ?? 'unknown'}`);
  }
  if (!args.dryRun && report.looked.length > 0) {
    (d.write ?? writeFileSync)(file, `${JSON.stringify(report.lock, null, 2)}\n`);
    log(`Lock file written (${Object.keys(report.lock).length} entries).`);
  }
  log(`Hosts in the lock after this run: ${[...hostsOf(report.lock)].map(([h, n]) => `${h} (${n})`).join(', ') || 'none'}`);
  for (const error of report.errors) log(`error: ${error}`);
  if (report.stopped) log(`Stopped looking up: ${report.stopped}`);
  if (report.missing.length > 0) log(`Still without images (${report.missing.length}): ${report.missing.join(', ')}`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

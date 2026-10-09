// Launch check (malva-homepage › Sample content is labelled): lists every managed content item still flagged
// `sample: true`. With --strict (release build) it fails while any remains.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const flagged = (file, node, where = file) => {
  if (Array.isArray(node)) return node.flatMap((item, i) => flagged(file, item, `${file}[${item && item.id ? item.id : i}]`));
  if (node && typeof node === 'object') return node.sample === true ? [where] : [];
  return [];
};

/** Names of every sample-flagged item, e.g. `stats.json[response]`. */
export function findSamples(root) {
  const dir = path.join(root, 'content');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'site-images.json').sort()
    .flatMap((f) => flagged(f, JSON.parse(readFileSync(path.join(dir, f), 'utf8'))));
}

export function run(root, strict) {
  const samples = findSamples(root);
  return { samples, failed: strict && samples.length > 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const strict = process.argv.includes('--strict');
  const { samples, failed } = run(process.cwd(), strict);
  if (samples.length) console.log(`${samples.length} sample-flagged content item(s):\n${samples.map((s) => `  - ${s}`).join('\n')}`);
  else console.log('sample content: none');
  if (failed) { console.error('Launch check failed: set "sample": false on confirmed items (see README, Managed content).'); process.exit(1); }
}

// Copies the clean banner-image picks from the seed project into the site (content/site-images.json) so the build
// does not depend on the seed directory at runtime. Keeps the committed copy when the seed file is not available.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE = ['..', 'seed', 'src', 'data', 'site-images.json'];
export const TARGET = ['content', 'site-images.json'];

/** Returns 'copied' | 'kept' (no source, existing copy) and throws when neither exists or a URL is unclean. */
export function syncSiteImages(root) {
  const src = path.join(root, ...SOURCE);
  const dest = path.join(root, ...TARGET);
  if (existsSync(src)) {
    const data = JSON.parse(readFileSync(src, 'utf8'));
    const dirty = Object.values(data).flat().filter((i) => /[?#]/.test(i.url));
    if (dirty.length) throw new Error(`Image URLs must be clean (no ? or #): ${dirty.map((i) => i.url).join(', ')}`);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    return 'copied';
  }
  if (existsSync(dest)) return 'kept';
  throw new Error('No site-images.json found in seed/src/data or content/');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(`site images: ${syncSiteImages(process.cwd())}`); } catch (e) { console.error(e.message); process.exit(1); }
}

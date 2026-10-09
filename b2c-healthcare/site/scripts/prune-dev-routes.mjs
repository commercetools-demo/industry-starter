// Release builds only (Netlify sets NETLIFY=true; or MALVA_RELEASE_BUILD=1): deletes the development-only routes so they
// are absent from the production build, not merely answering 404. DESTRUCTIVE to the working tree: it refuses to run
// elsewhere (restore with `git checkout -- .` if you ran it by mistake with the flag set).
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEV_ONLY_DIRS = ['app/api/health', 'app/[locale]/%5Ftokens', 'app/[locale]/%5Fboom'];

export function isReleaseBuild(env = process.env) {
  return env.NETLIFY === 'true' || env.MALVA_RELEASE_BUILD === '1';
}

/** Returns the directories removed (relative paths). Does nothing unless this is a release build. */
export function pruneDevRoutes(root, env = process.env) {
  if (!isReleaseBuild(env)) return [];
  const removed = [];
  for (const dir of DEV_ONLY_DIRS) {
    const path = resolve(root, dir);
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
      removed.push(dir);
    }
  }
  return removed;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..');
  if (!isReleaseBuild()) {
    console.log('prune dev routes: skipped (not a release build; set NETLIFY=true or MALVA_RELEASE_BUILD=1 to prune)');
  } else {
    const removed = pruneDevRoutes(root);
    console.log(`prune dev routes: removed ${removed.length ? removed.join(', ') : 'nothing (already absent)'}`);
  }
}

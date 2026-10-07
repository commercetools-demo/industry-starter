import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV_DIRECTORIES = ['api/health', 'api/dev', 'dev'];

/**
 * Returns the problems of a production build (empty = pass): development-only routes must be absent.
 * @param {string} siteDir the site directory (containing .next)
 * @returns {string[]}
 */
export function checkDevRoutes(siteDir) {
  const problems = [];
  const serverApp = path.join(siteDir, '.next', 'server', 'app');
  const manifestPath = path.join(siteDir, '.next', 'server', 'app-paths-manifest.json');
  if (!existsSync(path.join(siteDir, '.next', 'server'))) {
    problems.push('.next/server not found (run the build first)');
    return problems;
  }
  for (const directory of DEV_DIRECTORIES) {
    if (existsSync(path.join(serverApp, directory))) {
      problems.push(`.next/server/app/${directory} exists (development-only route in a production build)`);
    }
  }
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const [route, file] of Object.entries(manifest)) {
      const isDevRoute = /^\/(api\/health|api\/dev|dev)(\/|$)/.test(route) || /\.dev\.[a-z]+$/.test(String(file));
      if (isDevRoute) problems.push(`app-paths-manifest.json lists ${route}`);
    }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkDevRoutes(process.cwd());
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}

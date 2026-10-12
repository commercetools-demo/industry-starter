// Release without health route (bootstrap-and-structure > Gates and tests, Deployment config).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { runCli } from './fs-utils.mjs';
import { isRelease } from './release-env.mjs';

export function checkNoHealthInRelease(root, env = process.env) {
  if (!isRelease(env)) return [];
  const route = path.join(root, 'app', 'api', 'health', 'route.ts');
  return existsSync(route) ? ['app/api/health/route.ts must not exist in a release build (RELEASE=1 or production context)'] : [];
}

runCli(import.meta.url, (root) => checkNoHealthInRelease(root), 'no health route in release');

// Demo login must never reach production (spec seller-portal/design-demo-login, Production build):
//  1. a production build with DEMO_LOGIN_ENABLED=true fails, naming the setting;
//  2. the demo password (DEMO_LOGIN_PASSWORD) must not appear in .next/static (it is server-only).
// Usage: node scripts/check-no-demo-login.mjs [--production]   (`npm run verify:build` passes --production after the build)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runCli, walk } from './fs-utils.mjs';
import { isRelease } from './release-env.mjs';

export function checkNoDemoLogin(root, env = process.env, { production = false } = {}) {
  const problems = [];
  const isProduction = production || env.NODE_ENV === 'production' || isRelease(env);
  if (isProduction && env.DEMO_LOGIN_ENABLED === 'true') {
    problems.push('DEMO_LOGIN_ENABLED is true in a production build: demo login must be off in production (unset DEMO_LOGIN_ENABLED)');
  }
  const password = env.DEMO_LOGIN_PASSWORD;
  if (password && password.length >= 8) {
    for (const file of walk(path.join(root, '.next', 'static')).filter((f) => /\.(js|css|html|json|map|txt)$/.test(f))) {
      if (readFileSync(file, 'utf8').includes(password)) problems.push(`${path.relative(root, file)} contains the demo password (DEMO_LOGIN_PASSWORD must stay on the server)`);
    }
  }
  return problems;
}

runCli(import.meta.url, (root) => checkNoDemoLogin(root, process.env, { production: process.argv.includes('--production') }), 'no demo login');

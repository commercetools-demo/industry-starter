// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Demo login (workstream Q-13a, `consumer-storefront/design-demo-login`) is impossible in production: the build fails when `DEMO_LOGIN_ENABLED=true`
// in a production environment (NODE_ENV, VERCEL_ENV or CONTEXT is `production`, or RELEASE=1), and when the demo password (its name, or its value
// when set) appears anywhere in the client bundle (`.next/static`). Without a build the bundle step is skipped.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const isProductionBuild = (env) => env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' || env.CONTEXT === 'production' || env.RELEASE === '1';

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];

/** Problems with the flag in this environment. */
export function checkDemoLoginFlag(env = process.env) {
  if (env.DEMO_LOGIN_ENABLED === 'true' && isProductionBuild(env)) {
    return ['DEMO_LOGIN_ENABLED=true is not allowed in a production build: unset DEMO_LOGIN_ENABLED (demo login lists demo shoppers and signs them in with one password)'];
  }
  return [];
}

/** The demo password must never reach the browser: neither its name nor its value (8+ characters) may appear under `.next/static`. */
export function scanBundleForDemoPassword(dir, env = process.env) {
  const value = env.DEMO_LOGIN_PASSWORD && env.DEMO_LOGIN_PASSWORD.length >= 8 ? env.DEMO_LOGIN_PASSWORD : null;
  const problems = [];
  for (const file of walk(dir).filter((f) => /\.(js|css|html|json|map|txt)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    if (text.includes('DEMO_LOGIN_PASSWORD')) problems.push(`${path.relative(dir, file)} contains "DEMO_LOGIN_PASSWORD"`);
    if (value && text.includes(value)) problems.push(`${path.relative(dir, file)} contains the demo password`);
  }
  return problems;
}

export function checkNoDemoLogin(root, env = process.env) {
  return [...checkDemoLoginFlag(env), ...scanBundleForDemoPassword(path.join(root, '.next', 'static'), env)];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkNoDemoLogin(process.cwd());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('no-demo-login: OK');
}

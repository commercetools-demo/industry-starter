// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Build-time environment of a RELEASE build (workstream X, Q-X11). `next.config.ts` computes the security headers (CSP frame-src and so on)
// at BUILD time, so a value set only at start time never reaches them. In a release build (`RELEASE=1`, or a production Netlify context)
// the origins named here must be set, as bare https origins. Other builds (development, the dummy environment of README.md) are not checked.
// The storefront has the same script with its own list (PORTAL_ORIGIN, CSP_IMG_HOSTS). Usage: RELEASE=1 node scripts/check-build-env.mjs
import { pathToFileURL } from 'node:url';
import { isRelease } from './release-env.mjs';

/** What `next.config.ts` reads at build time and why a release cannot do without it. */
export const REQUIRED = [{ name: 'STOREFRONT_ORIGIN', why: 'the live preview iframe of the portal can frame nothing else (CSP frame-src)', list: false }];

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Why `value` is not a usable origin of a release, or `null`. */
function badOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return 'is not a URL';
  }
  if (url.protocol !== 'https:') return 'must be an https origin';
  if (LOCAL.has(url.hostname)) return 'must not be localhost in a release';
  if (url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) return 'must be a bare origin (scheme and host only)';
  return null;
}

export function checkBuildEnv(env = process.env) {
  const result = { problems: [], notices: [] };
  if (!isRelease(env)) return result;
  for (const { name, why, list } of REQUIRED) {
    const raw = (env[name] ?? '').trim();
    if (!raw.replace(/,/g, '').trim()) {
      result.problems.push(`${name} is not set in this release build: ${why}. next.config.ts bakes it in at build time, so set it in the BUILD environment.`);
      continue;
    }
    for (const part of list ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [raw]) {
      const why2 = badOrigin(part);
      if (why2) result.problems.push(`${name} entry "${part}" ${why2}`);
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, notices } = checkBuildEnv();
  for (const notice of notices) console.log(notice);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(isRelease(process.env) ? 'build-env: OK' : 'build-env: not a release build (RELEASE=1 not set), nothing checked');
}

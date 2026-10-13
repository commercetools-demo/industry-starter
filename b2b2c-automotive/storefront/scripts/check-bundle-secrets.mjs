// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Fails when a secret value or the word `client_secret` appears in the client bundle (.next/static).
// Secret values come from the environment and from .env.local when present; values shorter than 8 characters are ignored.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SECRET_VARS } from './app.config.mjs';

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];

export function secretValues(env, envFileText = '', names = SECRET_VARS) {
  const fromFile = Object.fromEntries(
    envFileText
      .split('\n')
      .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
  );
  return names.map((n) => env[n] || fromFile[n]).filter((v) => v && v.length >= 8);
}

/** Three base64url parts that look like a JWT (workstream X-12): a leaked Contentools or session token is greppable. */
export const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/;

export function scanBundle(dir, secrets) {
  const problems = [];
  for (const file of walk(dir).filter((f) => /\.(js|css|html|json|map|txt)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    if (/client_secret/i.test(text)) problems.push(`${path.relative(dir, file)} contains "client_secret"`);
    if (JWT_SHAPE.test(text)) problems.push(`${path.relative(dir, file)} contains a JWT-shaped string`);
    for (const s of secrets) if (text.includes(s)) problems.push(`${path.relative(dir, file)} contains a secret value`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const envFile = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
  const secrets = secretValues(process.env, envFile);
  const problems = [...scanBundle('.next/static', secrets), ...scanBundle('public', secrets).map((p) => 'public/' + p)];
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('bundle secrets: OK');
}

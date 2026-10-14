// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Tailwind v4 guard: no config file, v4 import first, @tailwindcss/postcss plugin.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkTailwind(root) {
  const problems = [];
  const configs = readdirSync(root).filter((f) => /^tailwind\.config\.(js|cjs|mjs|ts)$/.test(f));
  if (configs.length) problems.push(`Tailwind v4 uses no config file; remove ${configs.join(', ')}`);
  const css = path.join(root, 'app', 'globals.css');
  if (!existsSync(css)) problems.push('app/globals.css is missing');
  else if (!/^\s*@import\s+['"]tailwindcss['"];/.test(readFileSync(css, 'utf8'))) problems.push("app/globals.css must start with @import 'tailwindcss';");
  const postcss = path.join(root, 'postcss.config.mjs');
  if (!existsSync(postcss)) problems.push('postcss.config.mjs is missing');
  else if (!readFileSync(postcss, 'utf8').includes('@tailwindcss/postcss')) problems.push('postcss.config.mjs must use @tailwindcss/postcss');
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkTailwind(process.cwd());
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('tailwind: OK');
}

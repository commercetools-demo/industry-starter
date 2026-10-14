// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkTailwind } from './check-tailwind.mjs';
import { tmpApp } from './test-utils.mjs';

const OK = { 'app/globals.css': "@import 'tailwindcss';\n", 'postcss.config.mjs': "export default { plugins: { '@tailwindcss/postcss': {} } };" };

describe('Scaffold with the pinned stack: Tailwind v3 guard', () => {
  it('Tailwind v3 guard passes on the scaffold', () => expect(checkTailwind(tmpApp(OK))).toEqual([]));
  it('Tailwind v3 guard fails on a config file', () => {
    expect(checkTailwind(tmpApp({ ...OK, 'tailwind.config.ts': 'export default {}' })).join('\n')).toMatch(/no config file/);
  });
  it('Tailwind v3 guard fails without the v4 import', () => {
    expect(checkTailwind(tmpApp({ ...OK, 'app/globals.css': '@tailwind base;' })).join('\n')).toMatch(/must start with @import/);
  });
  it('Tailwind v3 guard fails on the v3 postcss plugin', () => {
    expect(checkTailwind(tmpApp({ ...OK, 'postcss.config.mjs': 'export default { plugins: { tailwindcss: {} } };' })).join('\n')).toMatch(/@tailwindcss\/postcss/);
  });
});

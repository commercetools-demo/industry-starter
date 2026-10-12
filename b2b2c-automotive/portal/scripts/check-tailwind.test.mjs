import { describe, expect, it } from 'vitest';
import { checkTailwind } from './check-tailwind.mjs';
import { tmp } from './test-utils.mjs';

const ok = {
  'app/globals.css': "@import 'tailwindcss';\n",
  'postcss.config.mjs': "export default { plugins: { '@tailwindcss/postcss': {} } };",
};

describe('Tailwind v3 guard', () => {
  it('Tailwind v3 guard passes on the scaffold', () => expect(checkTailwind(tmp(ok))).toEqual([]));
  it('Tailwind v3 guard fails on a config file', () => {
    expect(checkTailwind(tmp({ ...ok, 'tailwind.config.ts': 'export default {}' })).join('\n')).toMatch(/remove tailwind\.config\.ts/);
  });
  it('Tailwind v3 guard fails without the v4 import', () => {
    expect(checkTailwind(tmp({ ...ok, 'app/globals.css': '@tailwind base;' })).join('\n')).toMatch(/must start with @import/);
  });
  it('Tailwind v3 guard fails without the v4 postcss plugin', () => {
    expect(checkTailwind(tmp({ ...ok, 'postcss.config.mjs': 'export default { plugins: { tailwindcss: {} } };' })).join('\n')).toMatch(/@tailwindcss\/postcss/);
  });
});

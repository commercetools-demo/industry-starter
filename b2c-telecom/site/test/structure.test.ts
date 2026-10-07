// @vitest-environment node
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SITE = path.resolve(__dirname, '..');

const DIRECTORIES = [
  'app/[locale]',
  ...['auth', 'account', 'cart', 'checkout', 'offers', 'orders', 'search'].map((name) => `app/api/${name}`),
  ...['ct', 'mappers', 'offers', 'pricing', 'devices', 'config'].map((name) => `lib/${name}`),
  'hooks',
  'context',
  ...['ui', 'layout', 'offers', 'bundle', 'label', 'account', 'checkout', 'content'].map((name) => `components/${name}`),
  'i18n',
  'messages',
  'content',
  'test',
  'scripts',
];

describe('directory skeleton', () => {
  it.each(DIRECTORIES)('%s exists', (dir) => {
    const full = path.join(SITE, dir);
    expect(existsSync(full), dir).toBe(true);
    expect(statSync(full).isDirectory()).toBe(true);
  });
});

describe('README', () => {
  it('New feature added: README names one location and one example per layer', () => {
    const readme = readFileSync(path.join(SITE, 'README.md'), 'utf8');
    expect(readme).toContain('## Where code goes');
    const rows: Array<[string, string, string]> = [
      ['commercetools helper (server-only)', 'lib/ct/<area>.ts', 'lib/ct/session.ts'],
      ['Route Handler', 'app/api/<area>/route.ts', 'app/api/auth/session/route.ts'],
      ['SWR hook (client)', 'hooks/use<Thing>.ts', 'hooks/useSession.ts'],
    ];
    for (const [layer, location, example] of rows) {
      const row = readme.split('\n').find((line) => line.startsWith('|') && line.includes(layer));
      expect(row, layer).toBeDefined();
      expect(row).toContain(`\`${location}\``);
      expect(row).toContain(`\`${example}\``);
    }
    expect(readme).toContain("never `fetch('/api/…')` inline");
  });
});

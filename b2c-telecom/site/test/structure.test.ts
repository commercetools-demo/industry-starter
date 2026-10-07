// @vitest-environment node
import { existsSync, statSync } from 'node:fs';
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

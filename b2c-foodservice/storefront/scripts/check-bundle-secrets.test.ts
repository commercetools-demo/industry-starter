import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkBundleSecrets } from './check-bundle-secrets.mjs';

const VALUE = 'fake-secret-value-12345';

function build(chunk: string): string {
  const root = mkdtempSync(join(tmpdir(), 'bundle-'));
  mkdirSync(join(root, '.next', 'static', 'chunks'), { recursive: true });
  writeFileSync(join(root, '.next', 'static', 'chunks', 'a.js'), chunk);
  return root;
}

describe('Client bundle scan', () => {
  it('Client bundle scan finds a secret value in .next/static and reports only the name', () => {
    const problems = checkBundleSecrets(build(`var s="${VALUE}";`), { CTP_CLIENT_SECRET: VALUE });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('CTP_CLIENT_SECRET');
    expect(problems[0]).toContain('a.js');
    expect(problems[0]).not.toContain(VALUE);
  });

  it('Client bundle scan passes on a clean build output', () => {
    expect(checkBundleSecrets(build('var s="nothing here";'), { CTP_CLIENT_SECRET: VALUE })).toEqual([]);
  });

  it('Short or missing values are not scanned', () => {
    expect(checkBundleSecrets(build('var s="abc";'), { SESSION_SECRET: 'abc' })).toEqual([]);
    expect(checkBundleSecrets(build('x'), {})).toEqual([]);
  });

  it('Server-rendered HTML under .next/server/app is scanned', () => {
    const root = build('x');
    mkdirSync(join(root, '.next', 'server', 'app'), { recursive: true });
    writeFileSync(join(root, '.next', 'server', 'app', 'en-US.html'), `<p>${VALUE}</p>`);
    const problems = checkBundleSecrets(root, { SESSION_SECRET: VALUE });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('SESSION_SECRET');
  });
});

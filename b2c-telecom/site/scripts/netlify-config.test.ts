// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import securityHeaders from '../config/security-headers.json';

const toml = readFileSync(path.resolve(__dirname, '../../netlify.toml'), 'utf8');

/** Value of `name = "value"` anywhere in the file (first match). */
function value(name: string): string | undefined {
  return toml.match(new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, 'm'))?.[1];
}

describe('netlify.toml', () => {
  it('netlify.toml has base site, command build:netlify, publish .next and Node 22', () => {
    expect(value('base')).toBe('site');
    expect(value('command')).toBe('npm run build:netlify');
    expect(value('publish')).toBe('.next');
    expect(value('NODE_VERSION')).toBe('22');
    expect(value('package')).toBe('@netlify/plugin-nextjs');
  });

  it('toml headers equal config/security-headers.json', () => {
    const section = toml.slice(toml.indexOf('[headers.values]') + '[headers.values]'.length);
    const pairs = [...section.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"/gm)].map((match) => ({ key: match[1], value: match[2] }));
    expect(pairs).toEqual(securityHeaders);
  });

  it('SECRETS_SCAN_OMIT_KEYS excludes CTP_CLIENT_SECRET and SESSION_SECRET', () => {
    const names = (value('SECRETS_SCAN_OMIT_KEYS') ?? '').split(',');
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('CTP_CLIENT_SECRET');
    expect(names).not.toContain('SESSION_SECRET');
  });
});
